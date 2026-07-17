import { describe, expect, it } from 'vitest'
import { createTickAccumulator, TICK_MS } from './tick'

describe('createTickAccumulator', () => {
  it('emits zero ticks for elapsed time under one tick', () => {
    const acc = createTickAccumulator(100)
    expect(acc.consumeTicks(40)).toBe(0)
  })

  it('emits exactly one tick once enough time accumulates', () => {
    const acc = createTickAccumulator(100)
    acc.consumeTicks(40)
    expect(acc.consumeTicks(60)).toBe(1)
  })

  it('emits multiple whole ticks for a large elapsed jump', () => {
    const acc = createTickAccumulator(100)
    expect(acc.consumeTicks(350)).toBe(3)
  })

  it('carries remainder forward across calls (never loses or invents time)', () => {
    const acc = createTickAccumulator(100)
    let totalTicks = 0
    // 37ms per frame is deliberately not a clean divisor of 100
    for (let i = 0; i < 100; i++) totalTicks += acc.consumeTicks(37)
    // 100 frames * 37ms = 3700ms = exactly 37 ticks of 100ms
    expect(totalTicks).toBe(37)
  })

  it('alpha reflects the leftover fraction of a tick, for render interpolation', () => {
    const acc = createTickAccumulator(100)
    acc.consumeTicks(25)
    expect(acc.alpha).toBeCloseTo(0.25, 5)
  })

  it('same sequence of elapsed-time inputs always produces the same tick counts (determinism)', () => {
    const frames = [16, 16, 17, 16, 16, 17, 50, 12]
    const run = () => {
      const acc = createTickAccumulator(100)
      return frames.map((f) => acc.consumeTicks(f))
    }
    expect(run()).toEqual(run())
  })

  it('defaults to TICK_MS when no tick size is given', () => {
    const acc = createTickAccumulator()
    expect(acc.consumeTicks(TICK_MS)).toBe(1)
  })
})
