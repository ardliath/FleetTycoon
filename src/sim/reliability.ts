/**
 * Reliability bookkeeping for a single route's contract — the core tycoon
 * tension made measurable. Pure: given a history of sailing outcomes,
 * compute a reliability score and whether the contract is lost.
 */

/**
 * How a single scheduled sailing resolved. Two different mechanisms produce
 * this (see captain.ts for automated resolution, docking.ts's outcome
 * mapping for manual takeover), but both speak this one vocabulary — that's
 * what lets the reliability bar not care which one happened.
 *
 * Deliberately NOT modelling multi-day ship-unavailability here (a
 * `severelyDamaged` sailing doesn't block future days) — that's the actual
 * "drydock repair flow," which is Phase 3 scope (ship condition/wear model).
 * Phase 2 only records severity for the reliability bar.
 */
export type SailingOutcome = 'onTime' | 'late' | 'damaged' | 'severelyDamaged' | 'cancelled'

/** How much reliability credit each outcome earns, 0..1. Tuned by feel, not
 * physics — expect these to move once Phase 2 is actually played. */
export const RELIABILITY_CREDIT: Record<SailingOutcome, number> = {
  onTime: 1,
  late: 0.6,
  damaged: 0.4,
  severelyDamaged: 0.1,
  cancelled: 0,
}

export interface ReliabilityParams {
  /** How many of the most recent sailings count toward the score. */
  windowSize: number
  /** Below this rolling score, the contract is lost. */
  lossThreshold: number
  /** Contract can't be lost until at least this many sailings have happened
   * — guards against an unlucky day one ending the game before it starts. */
  minSailingsBeforeLoss: number
}

export const DEFAULT_RELIABILITY_PARAMS: ReliabilityParams = {
  windowSize: 10,
  lossThreshold: 0.6,
  minSailingsBeforeLoss: 5,
}

/** Rolling reliability score over the most recent `windowSize` sailings,
 * 0..1. Empty history scores 1 (nothing's gone wrong yet). */
export function computeReliability(
  history: readonly SailingOutcome[],
  params: ReliabilityParams = DEFAULT_RELIABILITY_PARAMS,
): number {
  if (history.length === 0) return 1
  const windowed = history.slice(-params.windowSize)
  const total = windowed.reduce((sum, o) => sum + RELIABILITY_CREDIT[o], 0)
  return total / windowed.length
}

/** Whether the contract should be considered lost given the full history. */
export function isContractLost(
  history: readonly SailingOutcome[],
  params: ReliabilityParams = DEFAULT_RELIABILITY_PARAMS,
): boolean {
  if (history.length < params.minSailingsBeforeLoss) return false
  return computeReliability(history, params) < params.lossThreshold
}

/** Append an outcome to a route's history — trivial, but keeps callers from
 * reaching for array spread everywhere and gives us one place to change the
 * representation later (e.g. capping stored history length). */
export function recordSailingOutcome(
  history: readonly SailingOutcome[],
  outcome: SailingOutcome,
): SailingOutcome[] {
  return [...history, outcome]
}
