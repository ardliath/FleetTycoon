/**
 * Automated captain risk resolution — the formula every later phase's
 * economy balances against, so its *shape* matters more than its exact
 * constants (those are expected to move once Phase 2 is actually played).
 *
 * Pure and deterministic: same inputs + same rng draw always give the same
 * outcome. No Math.random, no Date.now — see src/sim/README.md.
 */
import type { Rng } from './rng'
import type { SailingOutcome } from './reliability'

export interface CaptainResolutionParams {
  /** Fixed danger of this route/crossing, 0..1. Phase 2 hardcodes one value
   * for the single route; Phase 4's hazard zones replace this with a real
   * per-route calculation. */
  hazard: number
  /** Today's weather severity, 0..1 (see calendar.ts's rollWeather). */
  weather: number
  /** Captain competence, 0..1. Phase 2 hardcodes one captain; Phase 3's
   * crew hiring makes this a real, purchasable stat. */
  captainSkill: number
  /** How well-suited the ship is to this route/crossing, 0..1. Phase 2
   * hardcodes near-1 (the one ship suits the one route); Phase 4's hazard
   * zones + varied fleet make mismatches real ("tiny Loch class on the
   * Minch" per docs/GAME_DESIGN.md). This is a structural mismatch gate,
   * not wear — see `shipCondition` below for the ship's own upkeep. */
  shipSuitability: number
  /** The assigned ship's own condition, 0..1 (see sim/shipCondition.ts) —
   * age and damage history, independent of whether she suits the route at
   * all. A worn ship is a riskier ship even on a route she's built for. */
  shipCondition: number
}

/** Below this suitability, the captain won't take her out at all — the
 * structural-mismatch refusal from docs/GAME_DESIGN.md, resolved as a
 * cancellation rather than a doomed attempt. */
const REFUSE_SUITABILITY_THRESHOLD = 0.3

/** Condition at/above which a ship never suffers a mechanical breakdown —
 * a reasonably-kept ship simply doesn't fail of her own accord. Below it,
 * breakdown chance rises as she deteriorates (see `breakdownChance`). */
const CONDITION_BREAKDOWN_THRESHOLD = 0.5

/** Breakdown chance at condition 0 (a derelict). The curve is quadratic
 * from the threshold down to here, so it stays gentle just under the
 * threshold and only bites hard once a ship is genuinely run-down. */
const CONDITION_BREAKDOWN_SCALE = 0.4

/**
 * Probability that a worn ship simply fails to sail today — a mechanical
 * breakdown, independent of route hazard or weather. This is Phase 6 chunk
 * 1's teeth: passive condition decay (sim/shipCondition.ts) alone barely
 * changes outcomes on a sheltered route, because effectiveRisk multiplies
 * by hazard and doubling a tiny number is still tiny. A breakdown channel
 * that doesn't care about the weather is what makes neglect bite
 * everywhere — "broken ships and nothing sailing." A breakdown resolves as
 * a `cancelled` sailing (0 reliability credit), so a neglected fleet loses
 * its contracts rather than quietly printing money.
 *
 * Zero at/above CONDITION_BREAKDOWN_THRESHOLD; quadratic below it up to
 * CONDITION_BREAKDOWN_SCALE at condition 0. So ~1.6% at condition 0.4,
 * ~6% at 0.3, ~14% at 0.2, ~40% at 0 — a gradient that erodes reliability
 * visibly (giving the player warning) rather than a sudden cliff.
 */
export function breakdownChance(shipCondition: number): number {
  const deficit = (CONDITION_BREAKDOWN_THRESHOLD - shipCondition) / CONDITION_BREAKDOWN_THRESHOLD
  const t = clamp(deficit, 0, 1)
  return CONDITION_BREAKDOWN_SCALE * t * t
}

/** How much a max-skill captain reduces effective risk versus an unskilled
 * one. 0.7 means a skill-1 captain faces 30% of the raw hazard*weather risk
 * a skill-0 captain would; skill never fully eliminates risk. */
const CAPTAIN_SKILL_MITIGATION = 0.7

/** How much a wrecked ship (condition 0) raises risk versus a pristine one
 * (condition 1, multiplier 1x — no change from Phase 2's behaviour). 1.0
 * means a condition-0 ship faces double the raw risk. */
const CONDITION_RISK_WEIGHT = 1.0

/** Worst-case (risk=1) probability of each bad tier. These three must sum
 * to <= 1 — the remainder is onTime. At risk=1 here: 25% severe, 35%
 * damaged, 40% late, 0% onTime; at risk=0, 100% onTime. */
const SEVERE_SCALE = 0.25
const DAMAGE_SCALE = 0.35
const LATE_SCALE = 0.4

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Effective risk, 0..1, from raw danger tempered by crew competence. */
export function effectiveRisk(params: CaptainResolutionParams): number {
  const { hazard, weather, captainSkill, shipCondition } = params
  const conditionMultiplier = 1 + (1 - shipCondition) * CONDITION_RISK_WEIGHT
  return clamp(hazard * weather * conditionMultiplier * (1 - CAPTAIN_SKILL_MITIGATION * captainSkill), 0, 1)
}

/**
 * Resolve one automated sailing. Deterministic: same inputs + same rng
 * sequence always give the same outcome. Draws from `rng` in a fixed order
 * — the breakdown check first, then (only if she sails) the weather-risk
 * roll — so a known seed's draws always mean the same thing, which is what
 * the offline catch-up simulation will lean on later.
 */
export function resolveAutomatedSailing(params: CaptainResolutionParams, rng: Rng): SailingOutcome {
  if (params.shipSuitability < REFUSE_SUITABILITY_THRESHOLD) {
    return 'cancelled' // the captain refuses to sail — a structural mismatch, not bad luck
  }

  // a run-down ship may simply break down and not sail at all — hazard-
  // and weather-independent, unlike the risk roll below. Drawn first so
  // the draw order is fixed regardless of condition.
  if (rng.next() < breakdownChance(params.shipCondition)) {
    return 'cancelled'
  }

  const risk = effectiveRisk(params)
  const pSevere = risk ** 3 * SEVERE_SCALE
  const pDamaged = risk ** 2 * DAMAGE_SCALE
  const pLate = risk * LATE_SCALE

  const roll = rng.next()
  if (roll < pSevere) return 'severelyDamaged'
  if (roll < pSevere + pDamaged) return 'damaged'
  if (roll < pSevere + pDamaged + pLate) return 'late'
  return 'onTime'
}
