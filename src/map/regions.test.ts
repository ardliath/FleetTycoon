import { describe, expect, it } from 'vitest'
import { ARGYLL_PORTS, ARGYLL_ROUTES } from './argyll'
import { CLYDE_PORTS, CLYDE_ROUTES } from './clyde'
import { ALL_HAZARD_ZONES, ALL_PORTS, ALL_ROUTES, findPort, findRoute } from './regions'

describe('ALL_PORTS / ALL_ROUTES', () => {
  it('merges every region without dropping or duplicating anything', () => {
    expect(ALL_PORTS).toHaveLength(CLYDE_PORTS.length + ARGYLL_PORTS.length)
    expect(ALL_ROUTES).toHaveLength(CLYDE_ROUTES.length + ARGYLL_ROUTES.length)
  })

  it('every port id is unique across regions', () => {
    expect(new Set(ALL_PORTS.map((p) => p.id)).size).toBe(ALL_PORTS.length)
  })

  it('every route id is unique across regions', () => {
    expect(new Set(ALL_ROUTES.map((r) => r.id)).size).toBe(ALL_ROUTES.length)
  })
})

describe('findPort / findRoute', () => {
  it('finds a port from any region', () => {
    expect(findPort('brodick')?.name).toBe('Brodick')
    expect(findPort('oban')?.name).toBe('Oban')
    expect(findPort('nonexistent')).toBeUndefined()
  })

  it('finds a route from any region', () => {
    expect(findRoute('wemyss-bay-rothesay')?.name).toBe('Wemyss Bay – Rothesay')
    expect(findRoute('oban-colonsay')?.name).toBe('Oban – Colonsay')
    expect(findRoute('nonexistent')).toBeUndefined()
  })
})

describe('ALL_HAZARD_ZONES', () => {
  it('includes every region’s hazard zones', () => {
    expect(ALL_HAZARD_ZONES.length).toBeGreaterThanOrEqual(2)
  })
})
