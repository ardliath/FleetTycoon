/**
 * Seeded, deterministic PRNG for sim/. Never use Math.random() in this
 * directory — every function that needs randomness takes an Rng instance
 * as an argument instead, so a given seed always reproduces the same run.
 * This matters for debugging today and is the only sane foundation for
 * offline/idle catch-up simulation later (see docs/ROADMAP.md).
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number
}

/** mulberry32 — small, fast, good-enough statistical quality for gameplay
 * (not cryptographic). Same seed always produces the same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return {
    next(): number {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** Float in [min, max). */
export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min)
}

/** Integer in [min, max] inclusive. */
export function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rngRange(rng, min, max + 1))
}

/** True with probability `p` (0–1). */
export function rngChance(rng: Rng, p: number): boolean {
  return rng.next() < p
}
