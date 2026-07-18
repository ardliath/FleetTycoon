import { describe, expect, it } from 'vitest'
import {
  canAfford,
  costsForDay,
  DEFAULT_DAILY_COSTS,
  DEFAULT_ROUTE_ECONOMICS,
  netForDay,
  revenueForDay,
  shipPurchasePrice,
  type DailyCosts,
} from './economy'

const costs: DailyCosts = { ...DEFAULT_DAILY_COSTS, crewWagePerDay: 150 }

describe('revenueForDay', () => {
  it('a cancelled day still earns the flat subsidy, no fare', () => {
    const revenue = revenueForDay('cancelled')
    expect(revenue).toBe(DEFAULT_ROUTE_ECONOMICS.subsidyPerDay)
  })

  it('an onTime day earns full fare plus subsidy', () => {
    const revenue = revenueForDay('onTime')
    expect(revenue).toBe(DEFAULT_ROUTE_ECONOMICS.subsidyPerDay + DEFAULT_ROUTE_ECONOMICS.farePerSailing)
  })

  it('a severelyDamaged day earns no fare, only subsidy', () => {
    const revenue = revenueForDay('severelyDamaged')
    expect(revenue).toBe(DEFAULT_ROUTE_ECONOMICS.subsidyPerDay)
  })

  it('a late day earns less fare than onTime but more than cancelled', () => {
    const late = revenueForDay('late')
    const onTime = revenueForDay('onTime')
    const cancelled = revenueForDay('cancelled')
    expect(late).toBeLessThan(onTime)
    expect(late).toBeGreaterThan(cancelled)
  })
})

describe('costsForDay', () => {
  it('a cancelled day burns no fuel', () => {
    const cancelled = costsForDay('cancelled', costs)
    const onTime = costsForDay('onTime', costs)
    expect(cancelled).toBeLessThan(onTime)
    expect(cancelled).toBe(costs.crewWagePerDay + costs.maintenancePerDay)
  })

  it('standing costs (wages, maintenance) apply even on a sailing day', () => {
    const onTime = costsForDay('onTime', costs)
    expect(onTime).toBe(costs.fuelPerSailing + costs.crewWagePerDay + costs.maintenancePerDay)
  })
})

describe('netForDay', () => {
  it('is revenue minus costs', () => {
    const net = netForDay('onTime', DEFAULT_ROUTE_ECONOMICS, costs)
    expect(net).toBe(revenueForDay('onTime') - costsForDay('onTime', costs))
  })

  it('a bad enough day can run at a loss', () => {
    const net = netForDay('severelyDamaged', DEFAULT_ROUTE_ECONOMICS, costs)
    expect(net).toBeLessThan(revenueForDay('onTime') - costsForDay('cancelled', costs))
  })
})

describe('shipPurchasePrice', () => {
  it('scales with length', () => {
    expect(shipPurchasePrice(100)).toBeGreaterThan(shipPurchasePrice(50))
  })

  it('is a whole number', () => {
    expect(Number.isInteger(shipPurchasePrice(87))).toBe(true)
  })
})

describe('canAfford', () => {
  it('true when cash equals or exceeds price', () => {
    expect(canAfford(1000, 1000)).toBe(true)
    expect(canAfford(1001, 1000)).toBe(true)
  })

  it('false when cash is short', () => {
    expect(canAfford(999, 1000)).toBe(false)
  })
})
