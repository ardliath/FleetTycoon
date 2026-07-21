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

/**
 * Freight/passenger split and seasonal demand — real capacity-to-demand
 * matching, not a flavour multiplier on top of a flat fare (the confirmed
 * design answer). A route's demand is two independent streams derived
 * from distance (the existing "derive from the route, don't hand-tag"
 * principle) each carrying their own seasonal curve: passenger/tourist
 * traffic swings hard with the season, real lifeline freight (mail,
 * groceries, goods) barely does — islands need supplies year-round. A
 * sailing only earns for whichever of demand/ship-capacity is smaller per
 * stream: you can't sell space you don't have, and empty capacity nobody
 * filled earns nothing either. That's what makes ship size a genuine
 * economic decision per route, not just a docking-risk one.
 */
export interface RouteDemand {
  passengers: number
  freightUnits: number
}

export interface ShipCapacity {
  passengers: number
  freightUnits: number
}

const DAYS_PER_YEAR = 365
/** Day-of-year a season's demand peaks — mid-July, matching CalMac's real
 * summer-timetable high season. */
const PEAK_DAY_OF_YEAR = 195

/** Seasonal multiplier for one demand stream, centred on 1.0. `amplitude`
 * of 0.4 swings +/-40% between midsummer peak and midwinter trough; 0.1
 * is the much gentler freight curve. A sine wave over the calendar year —
 * stylised, not a real tourist-arrival model. */
function seasonalMultiplier(day: number, amplitude: number): number {
  const dayOfYear = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR
  const phase = ((dayOfYear - PEAK_DAY_OF_YEAR) / DAYS_PER_YEAR) * 2 * Math.PI
  return 1 + amplitude * Math.cos(phase)
}

const PASSENGER_SEASONAL_AMPLITUDE = 0.4
const FREIGHT_SEASONAL_AMPLITUDE = 0.1

const BASE_PASSENGER_DEMAND = 80
const PASSENGER_DEMAND_PER_KM = 6
const BASE_FREIGHT_DEMAND = 8
const FREIGHT_DEMAND_PER_KM = 0.6

/** A route's demand on a given calendar day — the two streams' own
 * seasonal curves applied to a distance-derived base level. */
export function demandForRouteOnDay(distanceKm: number, day: number): RouteDemand {
  const passengers = BASE_PASSENGER_DEMAND + distanceKm * PASSENGER_DEMAND_PER_KM
  const freightUnits = BASE_FREIGHT_DEMAND + distanceKm * FREIGHT_DEMAND_PER_KM
  return {
    passengers: Math.round(passengers * seasonalMultiplier(day, PASSENGER_SEASONAL_AMPLITUDE)),
    freightUnits: Math.round(freightUnits * seasonalMultiplier(day, FREIGHT_SEASONAL_AMPLITUDE)),
  }
}

const PASSENGER_CAPACITY_PER_METRE = 6
const FREIGHT_CAPACITY_PER_METRE = 0.5

/** A ship's capacity for each demand stream — a simple proxy from length,
 * same spirit as economy.ts's shipPurchasePrice, until ships carry a real
 * spec. */
export function shipCapacity(lengthM: number): ShipCapacity {
  return {
    passengers: Math.round(lengthM * PASSENGER_CAPACITY_PER_METRE),
    freightUnits: Math.round(lengthM * FREIGHT_CAPACITY_PER_METRE),
  }
}

const FARE_PER_PASSENGER = 5
const FARE_PER_FREIGHT_UNIT = 15

/** Full potential fare for this route on this day — demand fully served,
 * no ship-capacity ceiling. For contexts with no assigned ship to check
 * capacity against (the propose-a-route preview) — actual daily earnings
 * depend on the ship you assign, see `fareForSailing`. */
export function fareForRoute(distanceKm: number, day: number): number {
  const demand = demandForRouteOnDay(distanceKm, day)
  return Math.round(demand.passengers * FARE_PER_PASSENGER + demand.freightUnits * FARE_PER_FREIGHT_UNIT)
}

/** The fare one sailing actually earns: each demand stream capped at the
 * assigned ship's capacity for it before applying its per-unit fare. */
export function fareForSailing(distanceKm: number, shipLengthM: number, day: number): number {
  const demand = demandForRouteOnDay(distanceKm, day)
  const capacity = shipCapacity(shipLengthM)
  const passengers = Math.min(demand.passengers, capacity.passengers)
  const freightUnits = Math.min(demand.freightUnits, capacity.freightUnits)
  return Math.round(passengers * FARE_PER_PASSENGER + freightUnits * FARE_PER_FREIGHT_UNIT)
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
