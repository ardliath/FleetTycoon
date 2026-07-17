/**
 * Fixed-timestep simulation clock. sim/ state must only ever advance in
 * whole ticks, never by a variable frame delta — otherwise outcomes depend
 * on frame rate and nothing is reproducible (see docs/ROADMAP.md,
 * "The sim advances by fixed ticks, never by frame delta").
 *
 * Usage: the render loop (Phaser) accumulates real elapsed time and calls
 * `consumeTicks` each frame, which returns how many whole ticks to run.
 * Call your sim's step() that many times; render the result. Phaser may
 * interpolate visually between ticks, but game truth only changes here.
 *
 * The same accumulator drives offline/idle catch-up later: feed it a large
 * elapsed duration and run the returned tick count in a tight loop, with
 * no rendering in between — identical code path, just not drawn.
 */

/** Milliseconds of simulated game time per tick. 10 ticks/sec is a starting
 * point, not a mandate — Phase 1 should retune this against actual docking
 * feel once there's something to feel. */
export const TICK_MS = 100

export interface TickAccumulator {
  /** Feed real elapsed milliseconds; returns how many whole ticks to run now. */
  consumeTicks(elapsedMs: number): number
  /** Leftover partial-tick time, for render interpolation (0..1 fraction of a tick). */
  readonly alpha: number
}

export function createTickAccumulator(tickMs: number = TICK_MS): TickAccumulator {
  let carry = 0
  return {
    consumeTicks(elapsedMs: number): number {
      carry += elapsedMs
      const ticks = Math.floor(carry / tickMs)
      carry -= ticks * tickMs
      return ticks
    },
    get alpha() {
      return carry / tickMs
    },
  }
}
