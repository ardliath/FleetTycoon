/**
 * Deterministically derive a sub-seed for a specific (day, purpose) pair
 * from a session's master seed. This is what lets game state survive a
 * reload correctly: rather than persisting an RNG's internal position (this
 * project's Rng doesn't expose one, deliberately — see rng.ts), each day's
 * weather roll and each day's captain-resolution roll are independently
 * reproducible from (masterSeed, day, purpose) alone. "Day 5's weather" is
 * always the same value no matter how many times the page reloads.
 */

/** FNV-1a-ish mix — small, dependency-free, good enough for gameplay (this
 * is not cryptographic). Same inputs always produce the same output. */
export function deriveSeed(masterSeed: number, day: number, purpose: string): number {
  let h = (0x811c9dc5 ^ masterSeed) >>> 0
  h = Math.imul(h ^ day, 0x01000193)
  for (let i = 0; i < purpose.length; i++) {
    h = Math.imul(h ^ purpose.charCodeAt(i), 0x01000193)
  }
  return h >>> 0
}
