/**
 * Ship condition/wear for Phase 3's fleet — age and damage history lower a
 * ship's condition, which feeds captain.ts's effectiveRisk (a worn ship is
 * a riskier ship), and a severe knock sends her to drydock: unavailable for
 * a stretch, and a real cash cost to bring back. Pure bookkeeping, no RNG.
 */
import type { SailingOutcome } from './reliability'

export interface ShipCondition {
  /** 0..1, 1 = pristine. */
  score: number
  /** Last day (inclusive) the ship is unavailable for, or null if she's
   * fit to sail. Set by `sendToDrydock`, cleared by `releaseIfDue`. */
  drydockUntilDay: number | null
}

export function newShipCondition(): ShipCondition {
  return { score: 1, drydockUntilDay: null }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Baseline wear from ordinary use, plus extra for a rough one — a
 * cancelled day (never left the berth) costs nothing. Untuned constants,
 * same as the risk-tier scales in captain.ts. */
const WEAR_BY_OUTCOME: Record<SailingOutcome, number> = {
  onTime: 0.01,
  late: 0.01,
  damaged: 0.09,
  severelyDamaged: 0.26,
  cancelled: 0,
}

export function applyWear(condition: ShipCondition, outcome: SailingOutcome): ShipCondition {
  return { ...condition, score: clamp01(condition.score - WEAR_BY_OUTCOME[outcome]) }
}

/** How many days a severe knock takes off the water. Untuned. */
export const DRYDOCK_DAYS = 4

export function needsDrydock(outcome: SailingOutcome): boolean {
  return outcome === 'severelyDamaged'
}

export function isInDrydock(condition: ShipCondition, currentDay: number): boolean {
  return condition.drydockUntilDay !== null && currentDay <= condition.drydockUntilDay
}

export function sendToDrydock(condition: ShipCondition, currentDay: number): ShipCondition {
  return { ...condition, drydockUntilDay: currentDay + DRYDOCK_DAYS }
}

/** Once a drydock stint's time has passed, the ship comes back at full
 * condition — call this on every day advance for every owned ship. */
export function releaseIfDue(condition: ShipCondition, currentDay: number): ShipCondition {
  if (condition.drydockUntilDay !== null && currentDay > condition.drydockUntilDay) {
    return { score: 1, drydockUntilDay: null }
  }
  return condition
}

/** Cash cost of a drydock repair, scaled off the ship's own value — a
 * newer/pricier ship costs more to put right. Untuned. */
export function drydockRepairCost(shipValue: number): number {
  return Math.round(shipValue * 0.3)
}

/** Proactive maintenance spend restores some condition without a drydock
 * stint — the "pay ahead of trouble" lever, separate from repair-after-
 * the-fact. Untuned conversion rate. */
const MAINTENANCE_RESTORE_PER_POUND = 0.0004

export function applyMaintenance(condition: ShipCondition, spend: number): ShipCondition {
  return { ...condition, score: clamp01(condition.score + spend * MAINTENANCE_RESTORE_PER_POUND) }
}

/**
 * Passive decay applied once per calendar day to every owned ship —
 * whether she sailed or not, and independent of how well any given
 * sailing went. Phase 6 chunk 1's "neglect must bite": before this, a
 * ship only ever wore from `applyWear`'s outcome-based amounts, which are
 * small enough (see WEAR_BY_OUTCOME) that a fleet sailing cleanly every
 * day effectively never degraded — an unattended company just accrued
 * cash forever. This is the other half of the loop: existence and routine
 * use cost something on their own, and only deliberate upkeep — the
 * automatic routine-upkeep offset below, and the player's own manual
 * `applyMaintenance` spend — keeps a ship ahead of it.
 *
 * PLACEHOLDER — set to 0 (a genuine no-op) pending a real curve-design
 * pass with Adam; see docs/ROADMAP.md's Phase 6 chunk 1, which flags this
 * specific constant (and ROUTINE_UPKEEP_RESTORE_PER_DAY below, its
 * counterweight) as worth a heavier model's judgement, the same category
 * as the Phase 2/3 risk and economy formulas. Don't set a real number
 * here without that pass — the two constants have to be designed
 * together, not independently guessed.
 */
const PASSIVE_DECAY_PER_DAY = 0

export function applyPassiveDecay(condition: ShipCondition): ShipCondition {
  return { ...condition, score: clamp01(condition.score - PASSIVE_DECAY_PER_DAY) }
}

/**
 * Small automatic restoration representing routine upkeep the crew do
 * without being asked — the counterpart to the flat daily running-cost
 * charge already deducted per active route
 * (`DEFAULT_DAILY_COSTS.maintenancePerDay` in sim/economy.ts), which
 * previously had no effect on condition at all: cash left the company
 * every day for "maintenance" that didn't actually maintain anything.
 * Deliberately meant to land *below* PASSIVE_DECAY_PER_DAY once both are
 * set for real, so a ship still trends downward without the player's own
 * deliberate `applyMaintenance` spend — this only closes the dead-
 * mechanic gap, it isn't meant to cancel out neglect on its own.
 *
 * PLACEHOLDER — see PASSIVE_DECAY_PER_DAY above; same pending pass.
 */
const ROUTINE_UPKEEP_RESTORE_PER_DAY = 0

export function applyRoutineUpkeep(condition: ShipCondition): ShipCondition {
  return { ...condition, score: clamp01(condition.score + ROUTINE_UPKEEP_RESTORE_PER_DAY) }
}
