/**
 * Day-to-day money for Phase 3's fleet — fares/subsidy in, fuel/wages/
 * maintenance out. Pure, deterministic bookkeeping; no RNG needed here,
 * the risk side of the ledger lives in captain.ts.
 */
import type { SailingOutcome } from './reliability'

/** How much of a sailing's fare a given outcome actually earns, 0..1 — a
 * cancelled or wrecked crossing carries no paying passengers, a late one
 * still does but at a discount. */
const FARE_FRACTION: Record<SailingOutcome, number> = {
  onTime: 1,
  late: 0.9,
  damaged: 1,
  severelyDamaged: 0,
  cancelled: 0,
}

export interface RouteEconomics {
  farePerSailing: number
  /** Flat lifeline top-up per day, per the confirmed design decision —
   * lands regardless of whether the sailing happened. */
  subsidyPerDay: number
}

/** Untuned starting point for the one existing route — a modest lifeline
 * crossing, not a flagship one. Expect to revisit once there's a played
 * economy to balance against. */
export const DEFAULT_ROUTE_ECONOMICS: RouteEconomics = {
  farePerSailing: 1800,
  subsidyPerDay: 400,
}

export function revenueForDay(outcome: SailingOutcome, econ: RouteEconomics = DEFAULT_ROUTE_ECONOMICS): number {
  return econ.subsidyPerDay + econ.farePerSailing * FARE_FRACTION[outcome]
}

export interface DailyCosts {
  fuelPerSailing: number
  /** Sum of assigned crew's daily wage — see crew.ts's dailyWage. */
  crewWagePerDay: number
  maintenancePerDay: number
}

export const DEFAULT_DAILY_COSTS: Omit<DailyCosts, 'crewWagePerDay'> = {
  fuelPerSailing: 350,
  maintenancePerDay: 120,
}

/** One day's running costs. Fuel only burns if the ship actually put to
 * sea — a cancelled day doesn't. */
export function costsForDay(outcome: SailingOutcome, costs: DailyCosts): number {
  const fuel = outcome === 'cancelled' ? 0 : costs.fuelPerSailing
  return fuel + costs.crewWagePerDay + costs.maintenancePerDay
}

export function netForDay(outcome: SailingOutcome, econ: RouteEconomics, costs: DailyCosts): number {
  return revenueForDay(outcome, econ) - costsForDay(outcome, costs)
}

/** Purchase price for a hero-preset ship — a simple proxy from length until
 * Phase 4 gives ships a real class/spec to price against. Untuned. */
const PRICE_PER_METRE = 1800

export function shipPurchasePrice(lengthM: number): number {
  return Math.round(lengthM * PRICE_PER_METRE)
}

export function canAfford(cash: number, price: number): boolean {
  return cash >= price
}
