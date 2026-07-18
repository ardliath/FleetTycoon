import { describe, expect, it } from 'vitest'
import { distanceBetweenPorts, projectPort, type Port } from '../sim/geography'
import { hazardForRoute, routeCrossesZone } from '../sim/hazard'
import { CLYDE_HAZARD_ZONES, CLYDE_PORTS, CLYDE_ROUTES } from './clyde'

function portById(id: string): Port {
  const port = CLYDE_PORTS.find((p) => p.id === id)
  if (!port) throw new Error(`unknown port ${id}`)
  return port
}

describe('CLYDE_PORTS', () => {
  it('has 6 distinct ports with distinct ids', () => {
    expect(CLYDE_PORTS).toHaveLength(6)
    expect(new Set(CLYDE_PORTS.map((p) => p.id)).size).toBe(6)
  })
})

describe('CLYDE_ROUTES', () => {
  it('has 3 routes, each referencing real ports', () => {
    expect(CLYDE_ROUTES).toHaveLength(3)
    for (const route of CLYDE_ROUTES) {
      expect(() => portById(route.portAId)).not.toThrow()
      expect(() => portById(route.portBId)).not.toThrow()
    }
  })

  it('every route is a plausible short/regional crossing distance (<50km)', () => {
    for (const route of CLYDE_ROUTES) {
      const km = distanceBetweenPorts(portById(route.portAId), portById(route.portBId))
      expect(km).toBeGreaterThan(0)
      expect(km).toBeLessThan(50)
    }
  })
})

describe('CLYDE_HAZARD_ZONES', () => {
  it('the outer Firth zone crosses Ardrossan-Brodick but not the other two routes', () => {
    const zones = CLYDE_HAZARD_ZONES
    const ardrossanBrodick = CLYDE_ROUTES.find((r) => r.id === 'ardrossan-brodick')!
    const wemyssBayRothesay = CLYDE_ROUTES.find((r) => r.id === 'wemyss-bay-rothesay')!
    const gourockDunoon = CLYDE_ROUTES.find((r) => r.id === 'gourock-dunoon')!

    const crosses = (route: { portAId: string; portBId: string }) =>
      zones.some((z) => routeCrossesZone(projectPort(portById(route.portAId)), projectPort(portById(route.portBId)), z))

    expect(crosses(ardrossanBrodick)).toBe(true)
    expect(crosses(wemyssBayRothesay)).toBe(false)
    expect(crosses(gourockDunoon)).toBe(false)
  })

  it('the sheltered short crossings resolve to baseline hazard, not the named zone severity', () => {
    const wemyssBayRothesay = CLYDE_ROUTES.find((r) => r.id === 'wemyss-bay-rothesay')!
    const hazard = hazardForRoute(
      projectPort(portById(wemyssBayRothesay.portAId)),
      projectPort(portById(wemyssBayRothesay.portBId)),
      CLYDE_HAZARD_ZONES,
    )
    expect(hazard).toBeLessThan(CLYDE_HAZARD_ZONES[0].severity)
  })

  it("this pilot's hazard is honestly milder than a real named danger like Leverburgh/Berneray would be", () => {
    for (const zone of CLYDE_HAZARD_ZONES) {
      expect(zone.severity).toBeLessThan(0.5)
    }
  })
})
