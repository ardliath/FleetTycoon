import { describe, expect, it } from 'vitest'
import { ARRIVE_AT, crossingLegFraction, departAtForDistance } from './routeTiming'

describe('crossingLegFraction', () => {
  it('a longer crossing occupies more of the day than a shorter one', () => {
    // Claonaig–Lochranza (~8km) vs Kennacraig–Port Ellen (~46km): Adam's
    // own example of two routes that used to take the same time.
    const shortHop = crossingLegFraction(8)
    const longPassage = crossingLegFraction(46)
    expect(longPassage).toBeGreaterThan(shortHop)
  })

  it('is monotonic in distance across the mid range', () => {
    expect(crossingLegFraction(30)).toBeGreaterThan(crossingLegFraction(20))
    expect(crossingLegFraction(20)).toBeGreaterThan(crossingLegFraction(15))
  })

  it('clamps so the very shortest hops stay visible and the longest still fits the day', () => {
    // a tiny crossing never blinks out of existence...
    expect(crossingLegFraction(0)).toBeGreaterThan(0)
    expect(crossingLegFraction(1)).toBe(crossingLegFraction(0))
    // ...and even an unrealistically long one can't overrun the day: an
    // equal return leg after arrival at ARRIVE_AT must still finish by 1.0.
    expect(crossingLegFraction(10_000)).toBeLessThanOrEqual(1 - ARRIVE_AT)
  })
})

describe('departAtForDistance', () => {
  it('a longer route departs earlier (leaving arrival pinned at ARRIVE_AT)', () => {
    expect(departAtForDistance(46)).toBeLessThan(departAtForDistance(8))
  })

  it('is always before arrival, and the equal-length return finishes within the day', () => {
    for (const km of [0, 5, 8, 25, 46, 57, 1000]) {
      const departAt = departAtForDistance(km)
      expect(departAt).toBeLessThan(ARRIVE_AT)
      const leg = ARRIVE_AT - departAt
      expect(ARRIVE_AT + leg).toBeLessThanOrEqual(1)
    }
  })
})
