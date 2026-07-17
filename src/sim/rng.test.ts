import { describe, expect, it } from 'vitest'
import { createRng, rngChance, rngInt, rngRange } from './rng'

describe('createRng', () => {
  it('is deterministic: same seed produces the same sequence', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('produces values in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is not degenerate (does not repeat immediately, varies across draws)', () => {
    const rng = createRng(123)
    const values = Array.from({ length: 50 }, () => rng.next())
    expect(new Set(values).size).toBeGreaterThan(45)
  })
})

describe('rngRange', () => {
  it('stays within [min, max)', () => {
    const rng = createRng(5)
    for (let i = 0; i < 200; i++) {
      const v = rngRange(rng, 10, 20)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThan(20)
    }
  })
})

describe('rngInt', () => {
  it('stays within [min, max] inclusive and is always an integer', () => {
    const rng = createRng(9)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = rngInt(rng, 1, 3)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    // with 500 draws over {1,2,3} we should see all three
    expect(seen).toEqual(new Set([1, 2, 3]))
  })
})

describe('rngChance', () => {
  it('p=0 is always false, p=1 is always true', () => {
    const rng = createRng(11)
    for (let i = 0; i < 20; i++) {
      expect(rngChance(rng, 0)).toBe(false)
      expect(rngChance(rng, 1)).toBe(true)
    }
  })

  it('roughly matches its probability over many draws', () => {
    const rng = createRng(2024)
    let trues = 0
    const n = 2000
    for (let i = 0; i < n; i++) if (rngChance(rng, 0.3)) trues++
    expect(trues / n).toBeGreaterThan(0.24)
    expect(trues / n).toBeLessThan(0.36)
  })
})
