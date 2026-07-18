import { useCallback, useEffect, useRef, useState } from 'react'
import { PhaserGame } from '../PhaserGame'
import { dockingConfig } from '../game/dockingConfig'
import { EventBus } from '../game/EventBus'
import type { DockingResult } from '../game/scenes/DockingScene'
import { CLYDE_HAZARD_ZONES, CLYDE_ROUTES, findClydePort, findClydeRoute, type RouteDefinition } from '../map/clyde'
import { HERO_SHIPS } from '../ship/presets'
import { advanceCalendar, dayProgress, forecastLabel, rollWeather, DAY_DURATION_MS } from '../sim/calendar'
import { resolveAutomatedSailing } from '../sim/captain'
import { dailyWage, experienceOf, recordSailing } from '../sim/crew'
import { mapDockingResultToSailingOutcome } from '../sim/dockingOutcome'
import { DEFAULT_DAILY_COSTS, netForDay, shipPurchasePrice, type DailyCosts, type RouteEconomics } from '../sim/economy'
import { distanceBetweenPorts, projectPort } from '../sim/geography'
import { hazardForRoute } from '../sim/hazard'
import { computeReliability, isContractLost, recordSailingOutcome, type SailingOutcome } from '../sim/reliability'
import { createRng } from '../sim/rng'
import { fareForRoute, fuelCostForRoute, subsidyForRoute } from '../sim/routeEconomics'
import { deriveSeed } from '../sim/seed'
import { applyWear, drydockRepairCost, isInDrydock, needsDrydock, releaseIfDue, sendToDrydock } from '../sim/shipCondition'
import {
  gameStateStore,
  newContractState,
  type ContractGameState,
} from '../storage/gameStateStore'
import './routeOverview.css'

/**
 * The route/day loop, now for several routes at once (Phase 4): one shared
 * calendar and cash purse, each active route resolves its own sailing
 * independently against that same day-progress clock — forecast -> notice
 * -> manual takeover or automated resolution -> outcome -> reliability +
 * economy + ship/crew updated. Losing a route's contract only ends that
 * route (re-tendered away), not the whole company — you can always
 * propose a new one.
 *
 * `SHIP_SUITABILITY` is still a flat constant: every hero preset is a Big
 * Ship and every Clyde crossing suits one, so there's no genuine mismatch
 * to model yet — that needs Island/Loch class ships, still unmodelled
 * (see docs/GAME_DESIGN.md's Fleet & ship building section).
 */
const SHIP_SUITABILITY = 1

/** Day-progress fraction at which a route's notice fires. */
const NOTICE_AT = 0.7
/** Day-progress fraction by which a route's captain resolves automatically
 * if the player hasn't taken control. */
const AUTO_RESOLVE_AT = 0.88

const TICK_INTERVAL_MS = 200 // coarse UI clock — not the Phase 0/1 physics tick

type NoticeState = 'none' | 'shown' | 'resolved'

const OUTCOME_LABEL: Record<SailingOutcome, string> = {
  onTime: 'Alongside on time.',
  late: 'She made it, but late.',
  damaged: 'Damaged coming alongside — repairs needed.',
  severelyDamaged: 'Badly damaged — she needs drydock.',
  cancelled: "Didn't sail today.",
}

function loadOrCreateContract(): ContractGameState {
  return gameStateStore.load() ?? newContractState(Date.now())
}

function shipDesignFor(presetName: string) {
  return HERO_SHIPS.find((s) => s.name === presetName)
}

function routeGeometry(route: RouteDefinition) {
  const portA = findClydePort(route.portAId)
  const portB = findClydePort(route.portBId)
  if (!portA || !portB) return null
  return { portA, portB, a: projectPort(portA), b: projectPort(portB) }
}

function routeDistanceKm(route: RouteDefinition): number {
  const geom = routeGeometry(route)
  return geom ? distanceBetweenPorts(geom.portA, geom.portB) : 0
}

function routeHazard(route: RouteDefinition): number {
  const geom = routeGeometry(route)
  return geom ? hazardForRoute(geom.a, geom.b, CLYDE_HAZARD_ZONES) : 0
}

export function RoutesOverview() {
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
    (routeId: string, outcome: SailingOutcome, opts: { logCrewExperience: boolean }) => {
      const current = contractRef.current
      const route = current.routes.find((r) => r.routeId === routeId)
      const routeDef = findClydeRoute(routeId)
      if (!route) return

      const history = recordSailingOutcome(route.history, outcome)
      const ship = current.fleet.find((s) => s.id === route.assignedShipId)
      const captain = current.crew.find((c) => c.id === route.assignedCaptainId)

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
      const econ: RouteEconomics = { farePerSailing: fareForRoute(distanceKm), subsidyPerDay: subsidyForRoute(distanceKm) }
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

      const next: ContractGameState = { ...current, cash, fleet, crew, routes }
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
      const routeDef = findClydeRoute(routeId)
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

  // the shared day clock — paused while docking or with no routes at all
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

  const handleCancelToday = (routeId: string) => {
    resolveSailingDay(routeId, 'cancelled', { logCrewExperience: false })
  }

  const handleTakeControl = (routeId: string) => {
    setNoticeByRoute((prev) => ({ ...prev, [routeId]: 'resolved' }))
    setDockingRouteId(routeId)
  }

  const handleStartNewContract = () => {
    gameStateStore.clear()
    const fresh = newContractState(Date.now())
    setLastOutcomeByRoute({})
    setRouteLostMessage(null)
    persist(fresh)
  }

  const handleProposeRoute = (routeId: string) => {
    const current = contractRef.current
    if (current.routes.some((r) => r.routeId === routeId)) return
    const next: ContractGameState = {
      ...current,
      routes: [...current.routes, { routeId, history: [], assignedShipId: null, assignedCaptainId: null }],
    }
    persist(next)
  }

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
        resolveSailingDay(routeId, outcome, { logCrewExperience: false })
      }, 1800)
    }
    EventBus.on('docking-result', onResult)
    return () => {
      EventBus.off('docking-result', onResult)
    }
  }, [dockingRouteId, resolveSailingDay])

  if (dockingRouteId) {
    return (
      <div className="route-overview route-overview--docking">
        <PhaserGame config={dockingConfig} />
      </div>
    )
  }

  const activeRouteIds = new Set(contract.routes.map((r) => r.routeId))
  const proposable = CLYDE_ROUTES.filter((r) => !activeRouteIds.has(r.id))
  const progress = dayProgress(contract.calendar)

  return (
    <div className="route-overview">
      <div className="route-overview__stats">
        <div className="route-overview__stat-block">
          <span className="route-overview__label">Day</span>
          <span className="route-overview__value">{contract.calendar.day + 1}</span>
        </div>
        <div className="route-overview__stat-block">
          <span className="route-overview__label">Cash</span>
          <span className="route-overview__value">£{contract.cash.toLocaleString()}</span>
        </div>
        <div className="route-overview__stat-block">
          <button type="button" className="route-overview__reset" onClick={handleStartNewContract}>
            Reset company
          </button>
        </div>
      </div>

      <div className="route-overview__day-progress">
        <div className="route-overview__day-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {routeLostMessage && <p className="route-overview__last-outcome">{routeLostMessage}</p>}

      {contract.routes.length === 0 && (
        <p className="route-overview__last-outcome">No active routes — propose one below to get sailing.</p>
      )}

      {contract.routes.map((route) => {
        const routeDef = findClydeRoute(route.routeId)
        if (!routeDef) return null
        const ship = contract.fleet.find((s) => s.id === route.assignedShipId) ?? null
        const captain = contract.crew.find((c) => c.id === route.assignedCaptainId) ?? null
        const shipDesign = ship ? shipDesignFor(ship.presetName) : null
        const shipUnavailable = !ship || isInDrydock(ship.condition, contract.calendar.day)
        const reliability = computeReliability(route.history)
        const weather = rollWeather(createRng(deriveSeed(contract.masterSeed, contract.calendar.day, `weather:${route.routeId}`)))
        const notice = noticeByRoute[route.routeId] ?? 'none'
        const lastOutcome = lastOutcomeByRoute[route.routeId]

        return (
          <div className="route-overview__route-card" key={route.routeId}>
            <div className="route-overview__route-card-header">
              <span className="route-overview__route-name">{routeDef.name}</span>
              <span className={`route-overview__value route-overview__forecast--${forecastLabel(weather)}`}>
                {forecastLabel(weather)}
              </span>
            </div>

            <div className="route-overview__bar">
              <div
                className="route-overview__bar-fill"
                style={{
                  width: `${Math.round(reliability * 100)}%`,
                  background: reliability < 0.6 ? '#c0503f' : reliability < 0.8 ? '#d4a13f' : '#3ba55d',
                }}
              />
            </div>
            <span className="route-overview__label">Reliability {Math.round(reliability * 100)}%</span>

            <p className="route-overview__last-outcome">
              {shipDesign ? shipDesign.name : 'No ship assigned'}
              {captain ? ` · ${captain.name} (${Math.round(experienceOf(captain) * 100)}% exp.)` : ''}
              {shipUnavailable && ship ? ` · in drydock until day ${(ship.condition.drydockUntilDay ?? 0) + 1}` : ''}
            </p>

            {lastOutcome && <p className="route-overview__last-outcome">Yesterday: {lastOutcome}</p>}

            {shipUnavailable ? (
              <p className="route-overview__last-outcome">
                {ship ? "She's in drydock — today's sailing is automatically cancelled." : 'Assign a ship on the Company tab to sail this route.'}
              </p>
            ) : notice === 'shown' ? (
              <div className="route-overview__notice">
                <p>{shipDesign?.name ?? 'The ship'} is approaching the berth.</p>
                <div className="route-overview__notice-actions">
                  <button type="button" onClick={() => handleTakeControl(route.routeId)}>
                    Take the helm
                  </button>
                  <button type="button" className="route-overview__ghost" disabled>
                    Leave it to the captain…
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="route-overview__cancel" onClick={() => handleCancelToday(route.routeId)}>
                Cancel today's sailing
              </button>
            )}
          </div>
        )
      })}

      {proposable.length > 0 && (
        <div className="route-overview__propose">
          <h3>Propose a route</h3>
          <ul className="route-overview__propose-list">
            {proposable.map((routeDef) => {
              const distanceKm = routeDistanceKm(routeDef)
              const hazard = routeHazard(routeDef)
              return (
                <li key={routeDef.id} className="route-overview__propose-row">
                  <div>
                    <span className="route-overview__route-name">{routeDef.name}</span>
                    <span className="route-overview__label">
                      {' '}
                      · {distanceKm.toFixed(1)}km · hazard {Math.round(hazard * 100)}% · fare £
                      {fareForRoute(distanceKm).toLocaleString()} · subsidy £{subsidyForRoute(distanceKm).toLocaleString()}/day
                    </span>
                  </div>
                  <button type="button" onClick={() => handleProposeRoute(routeDef.id)}>
                    Start this route
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
