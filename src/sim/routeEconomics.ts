/**
 * Per-route fare, subsidy, and fuel cost, derived from crossing distance
 * rather than hand-tagged — per the confirmed design answer, which routes
 * need a subsidy should fall out of the model, not be authored per route.
 * Short, dense crossings (the Clyde) are close to commercially viable on
 * fares alone; long, thin crossings need proportionally more lifeline
 * top-up — the same shape as real CalMac economics without needing real
 * passenger-count data this project doesn't have. Figures are aggregate
 * per-sailing revenue/cost (many passengers/vehicles), the same scale
 * Phase 3's flat per-route constants used, not a per-ticket price.
 */

const BASE_FARE = 400
const FARE_PER_KM = 50

export function fareForRoute(distanceKm: number): number {
  return Math.round(BASE_FARE + distanceKm * FARE_PER_KM)
}

/** Below this distance, a crossing is short/dense enough (a Clyde-length
 * hop) to need no lifeline top-up at all. */
const SUBSIDY_FREE_KM = 8
const SUBSIDY_PER_KM = 20

export function subsidyForRoute(distanceKm: number): number {
  const excess = Math.max(0, distanceKm - SUBSIDY_FREE_KM)
  return Math.round(excess * SUBSIDY_PER_KM)
}

const BASE_FUEL = 50
const FUEL_PER_KM = 15

/** Fuel cost for one sailing of this route — replaces sim/economy.ts's
 * flat `fuelPerSailing` default once a route has a real distance. */
export function fuelCostForRoute(distanceKm: number): number {
  return Math.round(BASE_FUEL + distanceKm * FUEL_PER_KM)
}
