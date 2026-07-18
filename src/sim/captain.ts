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
   * Minch" per docs/GAME_DESIGN.md). */
  shipSuitability: number
}

/** Below this suitability, the captain won't take her out at all — the
 * structural-mismatch refusal from docs/GAME_DESIGN.md, resolved as a
 * cancellation rather than a doomed attempt. */
const REFUSE_SUITABILITY_THRESHOLD = 0.3

/** How much a max-skill captain reduces effective risk versus an unskilled
 * one. 0.7 means a skill-1 captain faces 30% of the raw hazard*weather risk
 * a skill-0 captain would; skill never fully eliminates risk. */
const CAPTAIN_SKILL_MITIGATION = 0.7

/** Worst-case (risk=1) probability of each bad tier. These three must sum
 * to <= 1 — the remainder is onTime. At risk=1 here: 25% severe, 35%
 * damaged, 40% late, 0% onTime; at risk=0, 100% onTime. */
const SEVERE_SCALE = 0.25
const DAMAGE_SCALE = 0.35
const LATE_SCALE = 0.4

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Effective risk, 0..1, from raw danger tempered by crew competence. */
export function effectiveRisk(params: CaptainResolutionParams): number {
  const { hazard, weather, captainSkill } = params
  return clamp(hazard * weather * (1 - CAPTAIN_SKILL_MITIGATION * captainSkill), 0, 1)
}

/**
 * Resolve one automated sailing. `rng.next()` is called at most once — this
 * matters for determinism tests (a known seed's Nth draw always means the
 * same thing) and for the offline catch-up simulation this buys later.
 */
export function resolveAutomatedSailing(params: CaptainResolutionParams, rng: Rng): SailingOutcome {
  if (params.shipSuitability < REFUSE_SUITABILITY_THRESHOLD) {
    return 'cancelled' // the captain refuses to sail — a structural mismatch, not bad luck
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
