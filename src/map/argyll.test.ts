import { describe, expect, it } from 'vitest'
import { distanceBetweenPorts, projectPort, type Port } from '../sim/geography'
import { hazardForRoute } from '../sim/hazard'
import { ARGYLL_HAZARD_ZONES, ARGYLL_PORTS, ARGYLL_ROUTES } from './argyll'

function portById(id: string): Port {
  const port = ARGYLL_PORTS.find((p) => p.id === id)
  if (!port) throw new Error(`unknown port ${id}`)
  return port
}

describe('ARGYLL_PORTS', () => {
  it('has 12 distinct ports with distinct ids', () => {
    expect(ARGYLL_PORTS).toHaveLength(12)
    expect(new Set(ARGYLL_PORTS.map((p) => p.id)).size).toBe(12)
  })
})

describe('ARGYLL_ROUTES', () => {
  it('has 8 routes, each referencing real ports', () => {
    expect(ARGYLL_ROUTES).toHaveLength(8)
    for (const route of ARGYLL_ROUTES) {
      expect(() => portById(route.portAId)).not.toThrow()
      expect(() => portById(route.portBId)).not.toThrow()
    }
  })

  it('every route is a plausible regional crossing distance (<70km)', () => {
    for (const route of ARGYLL_ROUTES) {
      const km = distanceBetweenPorts(portById(route.portAId), portById(route.portBId))
      expect(km).toBeGreaterThan(0)
      expect(km).toBeLessThan(70)
    }
  })
})

describe('ARGYLL_HAZARD_ZONES', () => {
  it('the Firth of Lorn zone crosses Oban-Colonsay but not the short sheltered crossings', () => {
    const zones = ARGYLL_HAZARD_ZONES
    const obanColonsay = ARGYLL_ROUTES.find((r) => r.id === 'oban-colonsay')!
    const claonaigLochranza = ARGYLL_ROUTES.find((r) => r.id === 'claonaig-lochranza')!
    const tarbertPortavadie = ARGYLL_ROUTES.find((r) => r.id === 'tarbert-portavadie')!

    const hazard = (route: { portAId: string; portBId: string }) =>
      hazardForRoute(projectPort(portById(route.portAId)), projectPort(portById(route.portBId)), zones)

    expect(hazard(obanColonsay)).toBeGreaterThan(hazard(claonaigLochranza))
    expect(hazard(obanColonsay)).toBeGreaterThan(hazard(tarbertPortavadie))
  })

  it("stays honestly milder than a real named danger like the Minch would be", () => {
    for (const zone of ARGYLL_HAZARD_ZONES) {
      expect(zone.severity).toBeLessThan(0.5)
    }
  })
})
