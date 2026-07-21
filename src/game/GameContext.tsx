import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { findRoute } from '../map/regions'
import { advanceCalendar, dayProgress, rollWeather, DAY_DURATION_MS } from '../sim/calendar'
import { resolveAutomatedSailing } from '../sim/captain'
import { dailyWage, experienceOf, recordSailing } from '../sim/crew'
import { mapDockingResultToSailingOutcome } from '../sim/dockingOutcome'
import { DEFAULT_DAILY_COSTS, netForDay, shipPurchasePrice, type DailyCosts, type RouteEconomics } from '../sim/economy'
import { recordManualDocking } from '../sim/licence'
import { isContractLost, recordSailingOutcome, type SailingOutcome } from '../sim/reliability'
import { createRng } from '../sim/rng'
import { fareForSailing, fuelCostForRoute, subsidyForRoute } from '../sim/routeEconomics'
import { deriveSeed } from '../sim/seed'
import { applyWear, drydockRepairCost, isInDrydock, needsDrydock, releaseIfDue, sendToDrydock } from '../sim/shipCondition'
import { gameStateStore, newContractState, type ContractGameState } from '../storage/gameStateStore'
import { EventBus } from './EventBus'
import type { DockingResult } from './scenes/DockingScene'
import { AUTO_RESOLVE_AT, NOTICE_AT } from './routeTiming'
import { OUTCOME_LABEL, routeDistanceKm, routeHazard, shipDesignFor, type NoticeState } from './routeHelpers'

/**
 * The single live source of truth for the company's state — contract,
 * fleet, crew, and the shared day clock. Lives above the tab switch (see
 * App.tsx) so the clock keeps ticking and routes keep resolving no matter
 * which tab is on screen; before this, the clock only ran while the
 * Routes tab happened to be mounted, which made live ship positions on
 * the Map tab meaningless.
 *
 * `SHIP_SUITABILITY` is still a flat constant: every hero preset is a Big
 * Ship and every Clyde crossing suits one, so there's no genuine mismatch
 * to model yet — that needs Island/Loch class ships, still unmodelled
 * (see docs/GAME_DESIGN.md's Fleet & ship building section).
 */
const SHIP_SUITABILITY = 1

const TICK_INTERVAL_MS = 200 // coarse UI clock — not the Phase 0/1 physics tick

function loadOrCreateContract(): ContractGameState {
  return gameStateStore.load() ?? newContractState(Date.now())
}

export interface GameContextValue {
  contract: ContractGameState
  noticeByRoute: Record<string, NoticeState>
  dockingRouteId: string | null
  lastOutcomeByRoute: Record<string, string>
  routeLostMessage: string | null
  handleCancelToday: (routeId: string) => void
  handleTakeControl: (routeId: string) => void
  handleStartNewContract: () => void
  handleProposeRoute: (routeId: string) => void
  /** Save a whole next contract state — for callers (Company tab) making
   * ad-hoc edits (buying a ship, hiring crew) that don't warrant their own
   * named handler here. Goes through the same ref+setState+localStorage
   * path everything else does, so it stays visible to the always-running
   * day clock immediately rather than only after a remount. */
  persist: (next: ContractGameState) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [contract, setContract] = useState<ContractGameState>(loadOrCreateContract)
  const [noticeByRoute, setNoticeByRoute] = useState<Record<string, NoticeState>>({})
  const [dockingRouteId, setDockingRouteId] = useState<string | null>(null)
  const [lastOutcomeByRoute, setLastOutcomeByRoute] = useState<Record<string, string>>({})
  const [routeLostMessage, setRouteLostMessage] = useState<string | null>(null)

  // mirrors the latest state into the ticking interval without needing to
  // re-register it on every change (interval only depends on pause flags)
  const contractRef = useRef(contract)
  const noticeRef = useRef(noticeByRoute)
  contractRef.current = contract
  noticeRef.current = noticeByRoute

  /** Updates `contractRef.current` synchronously (not just via React's own
   * render cycle) — necessary because a single tick can resolve several
   * routes back to back (each calling this), and each of those calls
   * reads `contractRef.current` to compute its own update. Without this,
   * only the last route resolved in a tick would "win"; the others'
   * cash/history/crew changes would be silently overwritten. */
  const persist = useCallback((next: ContractGameState) => {
    contractRef.current = next
    setContract(next)
    gameStateStore.save(next)
  }, [])

  /** Resolves one route's sailing for today: records the outcome, settles
   * cash (fare/subsidy in, fuel/wages/maintenance out) for that route's
   * real distance, wears the assigned ship (sending her to drydock on a
   * severe knock), and — automated sailings only — logs the captain's
   * experience. A route whose reliability falls too far is dropped
   * entirely (re-tendered away) rather than ending the whole company. */
  const resolveSailingDay = useCallback(
    (
      routeId: string,
      outcome: SailingOutcome,
      opts: { logCrewExperience: boolean; recordLicenceProgress?: boolean },
    ) => {
      const current = contractRef.current
      const route = current.routes.find((r) => r.routeId === routeId)
      const routeDef = findRoute(routeId)
      if (!route) return

      const history = recordSailingOutcome(route.history, outcome)
      const ship = current.fleet.find((s) => s.id === route.assignedShipId)
      const captain = current.crew.find((c) => c.id === route.assignedCaptainId)

      // manual takeovers only — this is the player's own hand on the
      // controls, not the automated captain's, so it's the one place
      // sim/licence.ts's progress can come from.
      let licence = current.licence
      if (opts.recordLicenceProgress && ship) {
        const design = shipDesignFor(ship.presetName)
        if (design) licence = recordManualDocking(licence, design.shipClass, outcome)
      }

      let cash = current.cash
      let fleet = current.fleet
      if (ship) {
        let condition = applyWear(ship.condition, outcome)
        if (needsDrydock(outcome)) {
          const design = shipDesignFor(ship.presetName)
          cash -= drydockRepairCost(shipPurchasePrice(design?.lengthM ?? 90))
          condition = sendToDrydock(condition, current.calendar.day)
        }
        fleet = fleet.map((s) => (s.id === ship.id ? { ...s, condition } : s))
      }

      let crew = current.crew
      if (opts.logCrewExperience && captain) {
        crew = crew.map((c) => (c.id === captain.id ? recordSailing(c) : c))
      }

      const distanceKm = routeDef ? routeDistanceKm(routeDef) : 0
      const shipLengthM = ship ? (shipDesignFor(ship.presetName)?.lengthM ?? 90) : 90
      const econ: RouteEconomics = {
        farePerSailing: fareForSailing(distanceKm, shipLengthM, current.calendar.day),
        subsidyPerDay: subsidyForRoute(distanceKm),
      }
      const costs: DailyCosts = {
        fuelPerSailing: fuelCostForRoute(distanceKm),
        crewWagePerDay: captain ? dailyWage(captain.tier) : 0,
        maintenancePerDay: DEFAULT_DAILY_COSTS.maintenancePerDay,
      }
      cash += netForDay(outcome, econ, costs)

      let routes = current.routes.map((r) => (r.routeId === routeId ? { ...r, history } : r))
      if (isContractLost(history)) {
        routes = routes.filter((r) => r.routeId !== routeId)
        setRouteLostMessage(`${routeDef?.name ?? routeId}: reliability fell too far — re-tendered away.`)
      }

      const next: ContractGameState = { ...current, cash, fleet, crew, routes, licence }
      setLastOutcomeByRoute((prev) => ({ ...prev, [routeId]: OUTCOME_LABEL[outcome] }))
      setNoticeByRoute((prev) => ({ ...prev, [routeId]: 'resolved' }))
      persist(next)
    },
    [persist],
  )

  const resolveAutomatically = useCallback(
    (routeId: string) => {
      const current = contractRef.current
      const route = current.routes.find((r) => r.routeId === routeId)
      const routeDef = findRoute(routeId)
      if (!route || !routeDef) return
      const ship = current.fleet.find((s) => s.id === route.assignedShipId)
      const captain = current.crew.find((c) => c.id === route.assignedCaptainId)
      const weather = rollWeather(createRng(deriveSeed(current.masterSeed, current.calendar.day, `weather:${routeId}`)))
      const rng = createRng(deriveSeed(current.masterSeed, current.calendar.day, `captain:${routeId}`))
      const outcome = resolveAutomatedSailing(
        {
          hazard: routeHazard(routeDef),
          weather,
          captainSkill: captain ? experienceOf(captain) : 0,
          shipSuitability: SHIP_SUITABILITY,
          shipCondition: ship ? ship.condition.score : 0,
        },
        rng,
      )
      resolveSailingDay(routeId, outcome, { logCrewExperience: true })
    },
    [resolveSailingDay],
  )

  // the shared day clock — always running (paused only while docking),
  // regardless of which tab is on screen.
  useEffect(() => {
    if (dockingRouteId) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const elapsed = now - last
      last = now

      const current = contractRef.current
      const { state: nextCalendar, daysAdvanced } = advanceCalendar(current.calendar, elapsed, DAY_DURATION_MS)
      const nextProgress = dayProgress(nextCalendar, DAY_DURATION_MS)

      if (daysAdvanced > 0) {
        // a new day started — every ship whose drydock stint has passed
        // comes back, and every route gets a fresh notice cycle.
        const fleet = current.fleet.map((s) => ({ ...s, condition: releaseIfDue(s.condition, nextCalendar.day) }))
        persist({ ...current, calendar: nextCalendar, fleet })
        setNoticeByRoute({})
        return
      }

      setContract((prev) => ({ ...prev, calendar: nextCalendar }))

      for (const route of current.routes) {
        const state = noticeRef.current[route.routeId] ?? 'none'
        if (state === 'resolved') continue
        const ship = current.fleet.find((s) => s.id === route.assignedShipId)
        const unavailable = !ship || isInDrydock(ship.condition, current.calendar.day)

        if (state === 'none' && nextProgress >= NOTICE_AT) {
          if (unavailable) {
            resolveSailingDay(route.routeId, 'cancelled', { logCrewExperience: false })
          } else {
            setNoticeByRoute((prev) => ({ ...prev, [route.routeId]: 'shown' }))
          }
        } else if (state === 'shown' && nextProgress >= AUTO_RESOLVE_AT) {
          resolveAutomatically(route.routeId)
        }
      }
    }, TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [dockingRouteId, persist, resolveAutomatically, resolveSailingDay])

  const handleCancelToday = useCallback(
    (routeId: string) => {
      resolveSailingDay(routeId, 'cancelled', { logCrewExperience: false })
    },
    [resolveSailingDay],
  )

  const handleTakeControl = useCallback((routeId: string) => {
    setNoticeByRoute((prev) => ({ ...prev, [routeId]: 'resolved' }))
    setDockingRouteId(routeId)
  }, [])

  const handleStartNewContract = useCallback(() => {
    gameStateStore.clear()
    const fresh = newContractState(Date.now())
    setLastOutcomeByRoute({})
    setRouteLostMessage(null)
    persist(fresh)
  }, [persist])

  const handleProposeRoute = useCallback(
    (routeId: string) => {
      const current = contractRef.current
      if (current.routes.some((r) => r.routeId === routeId)) return
      const next: ContractGameState = {
        ...current,
        routes: [...current.routes, { routeId, history: [], assignedShipId: null, assignedCaptainId: null }],
      }
      persist(next)
    },
    [persist],
  )

  // capture the docking minigame's result once, when it fires
  useEffect(() => {
    if (!dockingRouteId) return
    const routeId = dockingRouteId
    const onResult = (result: DockingResult) => {
      const outcome = mapDockingResultToSailingOutcome(result)
      // let the DockingScene's own "Alongside!" / "Too hard!" banner be
      // readable for a moment before switching back to the overview.
      setTimeout(() => {
        setDockingRouteId(null)
        resolveSailingDay(routeId, outcome, { logCrewExperience: false, recordLicenceProgress: true })
      }, 1800)
    }
    EventBus.on('docking-result', onResult)
    return () => {
      EventBus.off('docking-result', onResult)
    }
  }, [dockingRouteId, resolveSailingDay])

  return (
    <GameContext.Provider
      value={{
        contract,
        noticeByRoute,
        dockingRouteId,
        lastOutcomeByRoute,
        routeLostMessage,
        handleCancelToday,
        handleTakeControl,
        handleStartNewContract,
        handleProposeRoute,
        persist,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}
