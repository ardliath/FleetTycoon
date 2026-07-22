/**
 * Phase 6 chunk 1's exit bar: "neglect must bite." An unattended fleet has
 * to measurably decline, not print money forever — the same "measurable,
 * not just vibes" standard Phase 3's balance.test.ts set. Proves a real
 * magnitude effect across a simulated run, not just a directional nudge:
 *   1. an untended ship visibly rots over a run, while a maintained one
 *      holds — the deliberate-upkeep lever genuinely matters;
 *   2. that decline turns into real failures (a neglected ship on a
 *      sheltered Clyde-grade route loses far more sailings to breakdown
 *      than a kept one) — "broken ships and nothing sailing," on exactly
 *      the low-hazard routes where the weather channel alone wouldn't bite.
 */
import { describe, expect, it } from 'vitest'
import { resolveAutomatedSailing, type CaptainResolutionParams } from './captain'
import { createRng } from './rng'
import type { SailingOutcome } from './reliability'
import { applyMaintenance, applyPassiveDecay, applyRoutineUpkeep, newShipCondition } from './shipCondition'

/** One day of an actively-sailing ship's passive condition change: routine
 * upkeep offsets some passive decay (see shipCondition.ts). Outcome wear is
 * left out here — this isolates the passive drift that's the new mechanism;
 * outcome wear only makes an active ship decline faster still. */
function oneDayUntended(condition: ReturnType<typeof newShipCondition>) {
  return applyRoutineUpkeep(applyPassiveDecay(condition))
}

describe('balance sanity: an untended ship rots, a maintained one holds', () => {
  it('over 30 game-days, an untended ship loses most of her condition while a maintained one stays healthy', () => {
    let untended = newShipCondition()
    let maintained = newShipCondition()

    for (let day = 0; day < 30; day++) {
      untended = oneDayUntended(untended)
      maintained = oneDayUntended(maintained)
      // a modest, deliberate upkeep spend every few days — the "pay ahead
      // of trouble" lever a present player uses.
      if (day % 5 === 0) maintained = applyMaintenance(maintained, 500)
    }

    // the untended ship has genuinely rotted — well past the point where
    // breakdowns start (condition 0.5), not just drifted a little.
    expect(untended.score).toBeLessThan(0.6)
    // the maintained ship is still in good order.
    expect(maintained.score).toBeGreaterThan(0.85)
    // and the gap is large, not a rounding difference.
    expect(maintained.score - untended.score).toBeGreaterThan(0.3)
  })

  it('routine upkeep alone does not save a ship — she still trends down without deliberate maintenance', () => {
    let condition = newShipCondition()
    for (let day = 0; day < 20; day++) condition = oneDayUntended(condition)
    expect(condition.score).toBeLessThan(1) // strictly declining
    // ~0.014/day net over 20 days ~= 0.28 lost.
    expect(condition.score).toBeLessThan(0.75)
  })
})

describe('balance sanity: neglect turns into failures on a sheltered route', () => {
  // a Clyde-grade sheltered crossing: low hazard, average weather, a
  // competent captain. The weather risk channel alone barely moves here —
  // the breakdown channel is what makes condition matter.
  const shelteredRoute = { hazard: 0.05, weather: 0.4, captainSkill: 0.6, shipSuitability: 1 }
  const N = 4000

  function failureRate(shipCondition: number, seed: number): number {
    const rng = createRng(seed)
    const params: CaptainResolutionParams = { ...shelteredRoute, shipCondition }
    let failures = 0
    for (let i = 0; i < N; i++) {
      const outcome: SailingOutcome = resolveAutomatedSailing(params, rng)
      if (outcome === 'cancelled' || outcome === 'damaged' || outcome === 'severelyDamaged') failures++
    }
    return failures / N
  }

  it('a neglected ship loses many more sailings than a kept one on the same sheltered route', () => {
    const neglected = failureRate(0.1, 11) // run-down
    const kept = failureRate(0.95, 12) // well maintained

    // the kept ship almost never fails on a calm, low-hazard crossing.
    expect(kept).toBeLessThan(0.02)
    // the neglected ship fails a large fraction of sailings — this is the
    // reliability-cratering "nothing sailing" bite, and it's several times
    // the kept ship's rate, not a marginal nudge.
    expect(neglected).toBeGreaterThan(0.15)
    expect(neglected).toBeGreaterThan(kept * 5)
  })
})
