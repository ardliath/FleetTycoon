/**
 * Phase 5's economy exit bar: freight/passenger demand and the seasonal
 * curve need to be *real mechanics*, not flavour — provably moving actual
 * route economics, the same "measurable, not just vibes" standard Phase
 * 3's balance.test.ts set for crew/condition against incident rate.
 */
import { describe, expect, it } from 'vitest'
import { demandForRouteOnDay, fareForRoute, fareForSailing, shipCapacity } from './routeEconomics'

// day-of-year 195 (routeEconomics.ts's PEAK_DAY_OF_YEAR) vs six months later.
const MIDSUMMER_DAY = 195
const MIDWINTER_DAY = 195 + 182

describe('balance sanity: seasonal demand is a real, meaningful swing', () => {
  it('a route earns noticeably more at midsummer than midwinter, uncapped by capacity', () => {
    const distanceKm = 30
    const summer = fareForRoute(distanceKm, MIDSUMMER_DAY)
    const winter = fareForRoute(distanceKm, MIDWINTER_DAY)
    expect(summer).toBeGreaterThan(winter)
    // not just statistically greater — a real double-digit-percent swing.
    expect(summer / winter).toBeGreaterThan(1.2)
  })

  it('freight demand barely moves with the season while passenger demand swings hard', () => {
    const distanceKm = 30
    const summer = demandForRouteOnDay(distanceKm, MIDSUMMER_DAY)
    const winter = demandForRouteOnDay(distanceKm, MIDWINTER_DAY)

    const passengerSwing = (summer.passengers - winter.passengers) / winter.passengers
    const freightSwing = Math.abs(summer.freightUnits - winter.freightUnits) / winter.freightUnits

    expect(passengerSwing).toBeGreaterThan(0.3) // real lifeline goods
    expect(freightSwing).toBeLessThan(0.3) // don't stop needing groceries in January
    expect(passengerSwing).toBeGreaterThan(freightSwing * 3)
  })
})

describe('balance sanity: ship capacity is a real economic ceiling', () => {
  it('a small ship on a long, popular route at seasonal peak leaves real revenue on the table', () => {
    const distanceKm = 55 // Oban-Colonsay scale: high base demand
    const smallShipM = 40
    const bigShipM = 100

    const potential = fareForRoute(distanceKm, MIDSUMMER_DAY)
    const smallShipEarns = fareForSailing(distanceKm, smallShipM, MIDSUMMER_DAY)
    const bigShipEarns = fareForSailing(distanceKm, bigShipM, MIDSUMMER_DAY)

    // the small ship is genuinely capacity-constrained: she earns
    // meaningfully less than the route's full potential.
    expect(smallShipEarns).toBeLessThan(potential * 0.9)
    // the big ship comes close to capturing the full potential.
    expect(bigShipEarns).toBeGreaterThan(potential * 0.9)
    // and the gap between them is a real, sizeable chunk of revenue, not
    // a rounding error — this is what makes ship size a genuine per-route
    // economic decision, not just a docking-risk one.
    expect(bigShipEarns - smallShipEarns).toBeGreaterThan(potential * 0.1)
  })

  it('a ship comfortably above demand is never capacity-constrained', () => {
    const distanceKm = 5 // Wemyss Bay-Rothesay scale: modest demand
    const bigShipM = 100
    expect(fareForSailing(distanceKm, bigShipM, MIDSUMMER_DAY)).toBe(fareForRoute(distanceKm, MIDSUMMER_DAY))
  })

  it('capacity scales with ship length', () => {
    const small = shipCapacity(40)
    const big = shipCapacity(100)
    expect(big.passengers).toBeGreaterThan(small.passengers)
    expect(big.freightUnits).toBeGreaterThan(small.freightUnits)
  })
})
