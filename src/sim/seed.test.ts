import { describe, expect, it } from 'vitest'
import { deriveSeed } from './seed'

describe('deriveSeed', () => {
  it('is deterministic: same inputs always produce the same seed', () => {
    expect(deriveSeed(42, 5, 'weather')).toBe(deriveSeed(42, 5, 'weather'))
  })

  it('different days produce different seeds', () => {
    expect(deriveSeed(42, 5, 'weather')).not.toBe(deriveSeed(42, 6, 'weather'))
  })

  it('different purposes produce different seeds for the same day (independent draws)', () => {
    expect(deriveSeed(42, 5, 'weather')).not.toBe(deriveSeed(42, 5, 'captain'))
  })

  it('different master seeds produce different sessions entirely', () => {
    expect(deriveSeed(1, 5, 'weather')).not.toBe(deriveSeed(2, 5, 'weather'))
  })

  it('always returns a non-negative 32-bit integer, safe to feed into createRng', () => {
    for (let day = 0; day < 50; day++) {
      const s = deriveSeed(123456, day, 'weather')
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
    }
  })
})
