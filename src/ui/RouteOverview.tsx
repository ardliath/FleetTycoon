import { useCallback, useEffect, useRef, useState } from 'react'
import { PhaserGame } from '../PhaserGame'
import { dockingConfig } from '../game/dockingConfig'
import { EventBus } from '../game/EventBus'
import type { DockingResult } from '../game/scenes/DockingScene'
import { HERO_SHIPS } from '../ship/presets'
import { advanceCalendar, dayProgress, forecastLabel, rollWeather, DAY_DURATION_MS } from '../sim/calendar'
import { resolveAutomatedSailing } from '../sim/captain'
import { dailyWage, experienceOf, recordSailing } from '../sim/crew'
import { mapDockingResultToSailingOutcome } from '../sim/dockingOutcome'
import { DEFAULT_DAILY_COSTS, DEFAULT_ROUTE_ECONOMICS, netForDay, shipPurchasePrice, type DailyCosts } from '../sim/economy'
import { computeReliability, isContractLost, recordSailingOutcome, type SailingOutcome } from '../sim/reliability'
import { createRng } from '../sim/rng'
import { deriveSeed } from '../sim/seed'
import { applyWear, drydockRepairCost, isInDrydock, needsDrydock, releaseIfDue, sendToDrydock } from '../sim/shipCondition'
import { gameStateStore, newContractState, type ContractGameState } from '../storage/gameStateStore'
import './routeOverview.css'

/**
 * The route/day loop: forecast -> (proactive cancel, or) the docking notice
 * -> manual takeover (Phase 1's DockingScene) or automated resolution ->
 * outcome recorded -> reliability + economy + ship/crew updated -> next day.
 *
 * `ROUTE_HAZARD`/`SHIP_SUITABILITY` are still hardcoded — Phase 4's hazard
 * zones + varied fleet are what make these route- and ship-dependent.
 * Captain skill and ship condition, by contrast, now come from the actual
 * assigned crew/ship (see CompanyOverview.tsx) rather than a flat constant.
 */
const ROUTE_HAZARD = 0.4
const SHIP_SUITABILITY = 1

/** Day-progress fraction at which the notice fires. */
const NOTICE_AT = 0.7
/** Day-progress fraction by which the captain resolves automatically if the
 * player hasn't taken control. Gives roughly (AUTO_RESOLVE_AT-NOTICE_AT) of
 * a day, in real seconds, as the response window. */
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

export function RouteOverview() {
  const [contract, setContract] = useState<ContractGameState>(loadOrCreateContract)
  const [notice, setNotice] = useState<NoticeState>('none')
  const [dockingActive, setDockingActive] = useState(false)
  const [lastOutcome, setLastOutcome] = useState<string | null>(null)

  // mirrors the latest state into the ticking interval without needing to
  // re-register it on every change (interval only depends on pause flags)
  const contractRef = useRef(contract)
  const noticeRef = useRef(notice)
  contractRef.current = contract
  noticeRef.current = notice

  const lost = isContractLost(contract.history)
  const reliability = computeReliability(contract.history)
  const weather = rollWeather(createRng(deriveSeed(contract.masterSeed, contract.calendar.day, 'weather')))
  const progress = dayProgress(contract.calendar)

  const assignedShip = contract.fleet.find((s) => s.id === contract.assignedShipId) ?? null
  const assignedCaptain = contract.crew.find((c) => c.id === contract.assignedCaptainId) ?? null
  const assignedShipDesign = assignedShip ? shipDesignFor(assignedShip.presetName) : null
  const shipUnavailable = !assignedShip || isInDrydock(assignedShip.condition, contract.calendar.day)

  const persist = useCallback((next: ContractGameState) => {
    setContract(next)
    gameStateStore.save(next)
  }, [])

  /** The one place a day actually resolves: records the outcome, settles
   * cash (fare/subsidy in, fuel/wages/maintenance out), wears the assigned
   * ship (and sends her to drydock on a severe knock), releases any ship
   * whose drydock stint has passed, and — for automated sailings only —
   * logs the captain's experience. Manual takeovers don't log crew
   * experience: the player did the docking, not the captain. */
  const resolveSailingDay = useCallback(
    (outcome: SailingOutcome, opts: { logCrewExperience: boolean }) => {
      const current = contractRef.current
      const history = recordSailingOutcome(current.history, outcome)
      const nextDay = current.calendar.day + 1

      const ship = current.fleet.find((s) => s.id === current.assignedShipId)
      const captain = current.crew.find((c) => c.id === current.assignedCaptainId)

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
      // any other ship whose drydock stint has passed comes back too
      fleet = fleet.map((s) => ({ ...s, condition: releaseIfDue(s.condition, nextDay) }))

      let crew = current.crew
      if (opts.logCrewExperience && captain) {
        crew = crew.map((c) => (c.id === captain.id ? recordSailing(c) : c))
      }

      const costs: DailyCosts = { ...DEFAULT_DAILY_COSTS, crewWagePerDay: captain ? dailyWage(captain.tier) : 0 }
      cash += netForDay(outcome, DEFAULT_ROUTE_ECONOMICS, costs)

      const next: ContractGameState = {
        ...current,
        history,
        calendar: { day: nextDay, msIntoDay: 0 },
        cash,
        fleet,
        crew,
      }
      setLastOutcome(OUTCOME_LABEL[outcome])
      setNotice('none')
      persist(next)
    },
    [persist],
  )

  const resolveAutomatically = useCallback(() => {
    const current = contractRef.current
    const ship = current.fleet.find((s) => s.id === current.assignedShipId)
    const captain = current.crew.find((c) => c.id === current.assignedCaptainId)
    const rng = createRng(deriveSeed(current.masterSeed, current.calendar.day, 'captain'))
    const outcome = resolveAutomatedSailing(
      {
        hazard: ROUTE_HAZARD,
        weather,
        captainSkill: captain ? experienceOf(captain) : 0,
        shipSuitability: SHIP_SUITABILITY,
        shipCondition: ship ? ship.condition.score : 0,
      },
      rng,
    )
    resolveSailingDay(outcome, { logCrewExperience: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveSailingDay, weather])

  // the day clock — paused while docking or once the contract is lost
  useEffect(() => {
    if (dockingActive || lost) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const elapsed = now - last
      last = now

      const current = contractRef.current
      const { state: nextCalendar } = advanceCalendar(current.calendar, elapsed, DAY_DURATION_MS)
      const nextProgress = dayProgress(nextCalendar, DAY_DURATION_MS)

      setContract((prev) => ({ ...prev, calendar: nextCalendar }))

      const ship = current.fleet.find((s) => s.id === current.assignedShipId)
      const unavailable = !ship || isInDrydock(ship.condition, current.calendar.day)

      if (noticeRef.current === 'none' && nextProgress >= NOTICE_AT) {
        if (unavailable) {
          setNotice('resolved')
          resolveSailingDay('cancelled', { logCrewExperience: false })
        } else {
          setNotice('shown')
        }
      } else if (noticeRef.current === 'shown' && nextProgress >= AUTO_RESOLVE_AT) {
        setNotice('resolved')
        resolveAutomatically()
      }
    }, TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [dockingActive, lost, resolveAutomatically, resolveSailingDay])

  const handleCancelToday = () => {
    setNotice('resolved')
    resolveSailingDay('cancelled', { logCrewExperience: false })
  }

  const handleTakeControl = () => {
    setNotice('resolved')
    setDockingActive(true)
  }

  const handleStartNewContract = () => {
    gameStateStore.clear()
    const fresh = newContractState(Date.now())
    setLastOutcome(null)
    persist(fresh)
  }

  // capture the docking minigame's result once, when it fires
  useEffect(() => {
    if (!dockingActive) return
    const onResult = (result: DockingResult) => {
      const outcome = mapDockingResultToSailingOutcome(result)
      // let the DockingScene's own "Alongside!" / "Too hard!" banner be
      // readable for a moment before switching back to the overview.
      setTimeout(() => {
        setDockingActive(false)
        resolveSailingDay(outcome, { logCrewExperience: false })
      }, 1800)
    }
    EventBus.on('docking-result', onResult)
    return () => {
      EventBus.off('docking-result', onResult)
    }
  }, [dockingActive, resolveSailingDay])

  if (lost) {
    return (
      <div className="route-overview route-overview--lost">
        <h2>Contract lost</h2>
        <p>Reliability fell too far — the route's been re-tendered away.</p>
        <p className="route-overview__stat">
          Sailings played: {contract.history.length} · Final reliability: {Math.round(reliability * 100)}%
        </p>
        <button type="button" onClick={handleStartNewContract}>
          Start a new contract
        </button>
      </div>
    )
  }

  if (dockingActive) {
    return (
      <div className="route-overview route-overview--docking">
        <PhaserGame config={dockingConfig} />
      </div>
    )
  }

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
          <span className="route-overview__label">Reliability</span>
          <span className="route-overview__value">{Math.round(reliability * 100)}%</span>
          <div className="route-overview__bar">
            <div
              className="route-overview__bar-fill"
              style={{
                width: `${Math.round(reliability * 100)}%`,
                background: reliability < 0.6 ? '#c0503f' : reliability < 0.8 ? '#d4a13f' : '#3ba55d',
              }}
            />
          </div>
        </div>
        <div className="route-overview__stat-block">
          <span className="route-overview__label">Forecast</span>
          <span className={`route-overview__value route-overview__forecast--${forecastLabel(weather)}`}>
            {forecastLabel(weather)}
          </span>
        </div>
      </div>

      <p className="route-overview__last-outcome">
        {assignedShipDesign ? assignedShipDesign.name : 'No ship assigned'}
        {assignedCaptain ? ` · ${assignedCaptain.name} (${Math.round(experienceOf(assignedCaptain) * 100)}% exp.)` : ''}
        {shipUnavailable && assignedShip
          ? ` · in drydock until day ${(assignedShip.condition.drydockUntilDay ?? 0) + 1}`
          : ''}
      </p>

      <div className="route-overview__day-progress">
        <div className="route-overview__day-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {lastOutcome && <p className="route-overview__last-outcome">Yesterday: {lastOutcome}</p>}

      {shipUnavailable ? (
        <p className="route-overview__last-outcome">
          {assignedShip ? "She's in drydock — today's sailing is automatically cancelled." : 'Assign a ship on the Company tab to sail this route.'}
        </p>
      ) : notice === 'shown' ? (
        <div className="route-overview__notice">
          <p>{assignedShipDesign?.name ?? 'The ship'} is approaching the berth.</p>
          <div className="route-overview__notice-actions">
            <button type="button" onClick={handleTakeControl}>
              Take the helm
            </button>
            <button type="button" className="route-overview__ghost" disabled>
              Leave it to the captain…
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="route-overview__cancel" onClick={handleCancelToday}>
          Cancel today's sailing
        </button>
      )}
    </div>
  )
}
