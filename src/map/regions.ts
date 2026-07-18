/**
 * Aggregates every region's ports/routes/hazards/coastline/depth-contours
 * into single shared lists — the map is one continuous chart of Scottish
 * waters, not a sheet per region (see MapView.tsx's pan/zoom camera), and
 * a route is playable regardless of which region authored it. Each
 * region's own file (clyde.ts, argyll.ts, ...) stays the thing that gets
 * authored/reviewed; this file only merges. Add a new region by adding
 * its four imports and spreading them into the four lists below — nothing
 * else here should need to change per region.
 */
import { ARGYLL_HAZARD_ZONES, ARGYLL_PORTS, ARGYLL_ROUTES } from './argyll'
import { ARGYLL_COASTLINE } from './argyllCoastline'
import { ARGYLL_DEPTH_CONTOURS } from './argyllDepthContours'
import { CLYDE_HAZARD_ZONES, CLYDE_PORTS, CLYDE_ROUTES, type RouteDefinition } from './clyde'
import { CLYDE_COASTLINE } from './clydeCoastline'
import { CLYDE_DEPTH_CONTOURS } from './clydeDepthContours'
import type { Port } from '../sim/geography'
import type { HazardZone } from '../sim/hazard'

export const ALL_PORTS: Port[] = [...CLYDE_PORTS, ...ARGYLL_PORTS]
export const ALL_ROUTES: RouteDefinition[] = [...CLYDE_ROUTES, ...ARGYLL_ROUTES]
export const ALL_HAZARD_ZONES: HazardZone[] = [...CLYDE_HAZARD_ZONES, ...ARGYLL_HAZARD_ZONES]
export const ALL_COASTLINE = [...CLYDE_COASTLINE, ...ARGYLL_COASTLINE]
export const ALL_DEPTH_CONTOURS = [...CLYDE_DEPTH_CONTOURS, ...ARGYLL_DEPTH_CONTOURS]

export function findPort(id: string): Port | undefined {
  return ALL_PORTS.find((p) => p.id === id)
}

export function findRoute(id: string): RouteDefinition | undefined {
  return ALL_ROUTES.find((r) => r.id === id)
}
