import { describe, expect, it } from 'vitest'
import { distancePointToSegment, hazardForRoute, routeCrossesZone, type HazardZone } from './hazard'

describe('distancePointToSegment', () => {
  it('is zero when the point lies on the segment', () => {
    expect(distancePointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0)
  })

  it('is the perpendicular distance when closest point is mid-segment', () => {
    expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3)
  })

  it('clamps to the nearest endpoint when the closest point is beyond the segment', () => {
    // point is "before" a, not between a and b
    expect(distancePointToSegment({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
    // point is "after" b
    expect(distancePointToSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5)
  })

  it('handles a degenerate segment (a === b) as point-to-point distance', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5)
  })
})

const zone = (overrides: Partial<HazardZone> = {}): HazardZone => ({
  id: 'z1',
  name: 'Test Zone',
  kind: 'passage',
  center: { x: 5, y: 0 },
  radiusKm: 2,
  severity: 0.8,
  ...overrides,
})

describe('routeCrossesZone', () => {
  it('true when the route passes through the zone', () => {
    expect(routeCrossesZone({ x: 0, y: 0 }, { x: 10, y: 0 }, zone())).toBe(true)
  })

  it('false when the route passes well clear of the zone', () => {
    expect(routeCrossesZone({ x: 0, y: 10 }, { x: 10, y: 10 }, zone())).toBe(false)
  })

  it('true exactly at the radius boundary', () => {
    expect(routeCrossesZone({ x: 0, y: 2 }, { x: 10, y: 2 }, zone({ radiusKm: 2 }))).toBe(true)
  })
})

describe('hazardForRoute', () => {
  it('returns a low baseline when no zone is crossed', () => {
    const hazard = hazardForRoute({ x: 0, y: 10 }, { x: 10, y: 10 }, [zone()])
    expect(hazard).toBeGreaterThan(0)
    expect(hazard).toBeLessThan(0.2)
  })

  it("returns a crossed zone's severity", () => {
    const hazard = hazardForRoute({ x: 0, y: 0 }, { x: 10, y: 0 }, [zone({ severity: 0.8 })])
    expect(hazard).toBe(0.8)
  })

  it('combines multiple crossed zones by the maximum severity, not the sum', () => {
    const mild = zone({ id: 'mild', center: { x: 3, y: 0 }, radiusKm: 2, severity: 0.3 })
    const severe = zone({ id: 'severe', center: { x: 7, y: 0 }, radiusKm: 2, severity: 0.9 })
    const hazard = hazardForRoute({ x: 0, y: 0 }, { x: 10, y: 0 }, [mild, severe])
    expect(hazard).toBe(0.9)
  })

  it('is bounded to [0, 1] even if a severity is authored out of range', () => {
    const hazard = hazardForRoute({ x: 0, y: 0 }, { x: 10, y: 0 }, [zone({ severity: 1.5 })])
    expect(hazard).toBeLessThanOrEqual(1)
  })
})
