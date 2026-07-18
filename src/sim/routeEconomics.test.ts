import { describe, expect, it } from 'vitest'
import { fareForRoute, fuelCostForRoute, subsidyForRoute } from './routeEconomics'

describe('fareForRoute', () => {
  it('rises with distance', () => {
    expect(fareForRoute(30)).toBeGreaterThan(fareForRoute(5))
  })

  it('is positive even for a zero-distance edge case', () => {
    expect(fareForRoute(0)).toBeGreaterThan(0)
  })
})

describe('subsidyForRoute', () => {
  it('is zero for a short, dense crossing', () => {
    expect(subsidyForRoute(5)).toBe(0)
  })

  it('is positive and rises with distance for a long crossing', () => {
    const short = subsidyForRoute(10)
    const long = subsidyForRoute(40)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeGreaterThan(0)
  })

  it('a Clyde-scale route (Wemyss Bay-Rothesay, ~5km) needs no subsidy while a long thin one does', () => {
    const clyde = subsidyForRoute(5)
    const remote = subsidyForRoute(60)
    expect(clyde).toBe(0)
    expect(remote).toBeGreaterThan(0)
  })
})

describe('fuelCostForRoute', () => {
  it('rises with distance', () => {
    expect(fuelCostForRoute(30)).toBeGreaterThan(fuelCostForRoute(5))
  })

  it('is positive even for a zero-distance edge case', () => {
    expect(fuelCostForRoute(0)).toBeGreaterThan(0)
  })
})
