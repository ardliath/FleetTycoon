import { useGame } from '../game/GameContext'
import { findRoute } from '../map/regions'
import { HERO_SHIPS } from '../ship/presets'
import { canAfford, shipPurchasePrice } from '../sim/economy'
import { dailyWage, experienceOf, hireCost, newCaptain, type Captain, type CaptainTier } from '../sim/crew'
import { CLEAN_DOCKINGS_TO_ADVANCE, type LicenceTier } from '../sim/licence'
import { applyMaintenance, isInDrydock, newShipCondition } from '../sim/shipCondition'
import type { OwnedShip } from '../storage/gameStateStore'
import './companyOverview.css'

/** Fixed maintenance spend per click — a simple lever rather than a free-
 * entry amount, matching the tier-based hiring UI below. Untuned. */
const MAINTENANCE_SPEND = 500

const TIERS: CaptainTier[] = ['green', 'seasoned', 'veteran']

const LICENCE_LABEL: Record<LicenceTier, string> = {
  island: 'Island class',
  loch: 'Loch class',
  bigShip: 'Big Ships',
}

/** The tier after this one, or null already at the top — mirrors
 * sim/licence.ts's TIER_ORDER (kept local since that list isn't exported;
 * it's an implementation detail of the pure module, not part of its
 * public surface). */
const NEXT_TIER: Record<LicenceTier, LicenceTier | null> = {
  island: 'loch',
  loch: 'bigShip',
  bigShip: null,
}

function shipDesignFor(presetName: string) {
  return HERO_SHIPS.find((s) => s.name === presetName)
}

export function CompanyOverview() {
  const { contract, persist } = useGame()

  const buyShip = (presetName: string) => {
    const design = shipDesignFor(presetName)
    if (!design) return
    const price = shipPurchasePrice(design.lengthM)
    if (!canAfford(contract.cash, price)) return
    const ship: OwnedShip = {
      id: `ship-${Date.now()}`,
      presetName,
      condition: newShipCondition(),
    }
    persist({ ...contract, cash: contract.cash - price, fleet: [...contract.fleet, ship] })
  }

  const hireCaptain = (tier: CaptainTier) => {
    const cost = hireCost(tier)
    if (!canAfford(contract.cash, cost)) return
    const captain = newCaptain(`captain-${Date.now()}`, `Captain #${contract.crew.length + 1}`, tier)
    persist({ ...contract, cash: contract.cash - cost, crew: [...contract.crew, captain] })
  }

  /** A ship/captain serves one route at a time — assigning to a new route
   * automatically frees it from wherever it was previously assigned. */
  const assignShipToRoute = (shipId: string, routeId: string | null) => {
    const routes = contract.routes.map((r) => {
      if (r.routeId === routeId) return { ...r, assignedShipId: shipId }
      if (r.assignedShipId === shipId) return { ...r, assignedShipId: null }
      return r
    })
    persist({ ...contract, routes })
  }

  const assignCaptainToRoute = (captainId: string, routeId: string | null) => {
    const routes = contract.routes.map((r) => {
      if (r.routeId === routeId) return { ...r, assignedCaptainId: captainId }
      if (r.assignedCaptainId === captainId) return { ...r, assignedCaptainId: null }
      return r
    })
    persist({ ...contract, routes })
  }

  const payMaintenance = (shipId: string) => {
    if (!canAfford(contract.cash, MAINTENANCE_SPEND)) return
    const fleet = contract.fleet.map((ship) =>
      ship.id === shipId ? { ...ship, condition: applyMaintenance(ship.condition, MAINTENANCE_SPEND) } : ship,
    )
    persist({ ...contract, cash: contract.cash - MAINTENANCE_SPEND, fleet })
  }

  const currentDay = contract.calendar.day

  return (
    <div className="company-overview">
      <div className="company-overview__cash">
        <span className="company-overview__label">Cash</span>
        <span className="company-overview__value">£{contract.cash.toLocaleString()}</span>
      </div>

      <section>
        <h2>Your licence</h2>
        <p className="company-overview__row-detail">
          Licensed for <strong>{LICENCE_LABEL[contract.licence.tier]}</strong>.{' '}
          {NEXT_TIER[contract.licence.tier] ? (
            <>
              {contract.licence.cleanDockings} of {CLEAN_DOCKINGS_TO_ADVANCE} clean manual dockings on{' '}
              {LICENCE_LABEL[contract.licence.tier]} logged toward {LICENCE_LABEL[NEXT_TIER[contract.licence.tier]!]}.
              Take the helm on the Routes tab to make progress — only on ships within your current licence.
            </>
          ) : (
            "Top tier — you're cleared to take the helm of anything in the fleet."
          )}
        </p>
      </section>

      <section>
        <h2>Fleet</h2>
        <ul className="company-overview__list">
          {contract.fleet.map((ship) => {
            const design = shipDesignFor(ship.presetName)
            const drydocked = isInDrydock(ship.condition, currentDay)
            const assignedRoute = contract.routes.find((r) => r.assignedShipId === ship.id) ?? null
            return (
              <li key={ship.id} className="company-overview__row">
                <div className="company-overview__row-main">
                  <span className="company-overview__row-name">{design?.name ?? ship.presetName}</span>
                  <span className="company-overview__row-detail">
                    Condition {Math.round(ship.condition.score * 100)}%
                    {drydocked && ` · in drydock until day ${(ship.condition.drydockUntilDay ?? 0) + 1}`}
                  </span>
                </div>
                <div className="company-overview__row-actions">
                  <button
                    type="button"
                    disabled={drydocked || ship.condition.score >= 1}
                    onClick={() => payMaintenance(ship.id)}
                  >
                    Maintain (£{MAINTENANCE_SPEND})
                  </button>
                  <select
                    disabled={drydocked}
                    value={assignedRoute?.routeId ?? ''}
                    onChange={(e) => assignShipToRoute(ship.id, e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {contract.routes.map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {findRoute(r.routeId)?.name ?? r.routeId}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>

        <h3>Buy a ship</h3>
        <ul className="company-overview__list">
          {HERO_SHIPS.map((design) => {
            const price = shipPurchasePrice(design.lengthM)
            return (
              <li key={design.name} className="company-overview__row">
                <div className="company-overview__row-main">
                  <span className="company-overview__row-name">{design.name}</span>
                  <span className="company-overview__row-detail">{design.lengthM}m</span>
                </div>
                <div className="company-overview__row-actions">
                  <button type="button" disabled={!canAfford(contract.cash, price)} onClick={() => buyShip(design.name)}>
                    Buy — £{price.toLocaleString()}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2>Crew</h2>
        <ul className="company-overview__list">
          {contract.crew.map((captain: Captain) => {
            const assignedRoute = contract.routes.find((r) => r.assignedCaptainId === captain.id) ?? null
            return (
              <li key={captain.id} className="company-overview__row">
                <div className="company-overview__row-main">
                  <span className="company-overview__row-name">{captain.name}</span>
                  <span className="company-overview__row-detail">
                    {captain.tier} · {Math.round(experienceOf(captain) * 100)}% experience · £
                    {dailyWage(captain.tier)}/day
                  </span>
                </div>
                <div className="company-overview__row-actions">
                  <select
                    value={assignedRoute?.routeId ?? ''}
                    onChange={(e) => assignCaptainToRoute(captain.id, e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {contract.routes.map((r) => (
                      <option key={r.routeId} value={r.routeId}>
                        {findRoute(r.routeId)?.name ?? r.routeId}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>

        <h3>Hire crew</h3>
        <ul className="company-overview__list">
          {TIERS.map((tier) => (
            <li key={tier} className="company-overview__row">
              <div className="company-overview__row-main">
                <span className="company-overview__row-name">{tier}</span>
                <span className="company-overview__row-detail">£{dailyWage(tier)}/day wage</span>
              </div>
              <div className="company-overview__row-actions">
                <button type="button" disabled={!canAfford(contract.cash, hireCost(tier))} onClick={() => hireCaptain(tier)}>
                  Hire — £{hireCost(tier).toLocaleString()}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
