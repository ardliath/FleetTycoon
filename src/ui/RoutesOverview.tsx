import { PhaserGame } from '../PhaserGame'
import { dockingConfig } from '../game/dockingConfig'
import { useGame } from '../game/GameContext'
import { routeDistanceKm, routeHazard, shipDesignFor } from '../game/routeHelpers'
import { CLYDE_ROUTES, findClydeRoute } from '../map/clyde'
import { dayProgress, forecastLabel, rollWeather } from '../sim/calendar'
import { experienceOf } from '../sim/crew'
import { computeReliability } from '../sim/reliability'
import { createRng } from '../sim/rng'
import { fareForRoute, subsidyForRoute } from '../sim/routeEconomics'
import { deriveSeed } from '../sim/seed'
import { isInDrydock } from '../sim/shipCondition'
import './routeOverview.css'

/**
 * Renders the live company/route state from GameContext — see
 * src/game/GameContext.tsx for the day clock, resolution logic, and why
 * it now lives above the tab switch instead of inside this component.
 */
export function RoutesOverview() {
  const {
    contract,
    noticeByRoute,
    dockingRouteId,
    lastOutcomeByRoute,
    routeLostMessage,
    handleCancelToday,
    handleTakeControl,
    handleStartNewContract,
    handleProposeRoute,
  } = useGame()

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
                  background: reliability < 0.6 ? 'var(--danger)' : reliability < 0.8 ? 'var(--brass)' : '#3f7a52',
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
