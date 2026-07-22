import type { RouteDefinition } from '../map/clyde'
import { ALL_COASTLINE, ALL_HAZARD_ZONES, findPort } from '../map/regions'
import { ROUTE_PATHS } from '../map/routePaths'
import { HERO_SHIPS } from '../ship/presets'
import { pathLengthKm, projectPort, type Point } from '../sim/geography'
import { hazardForRoute } from '../sim/hazard'
import type { SailingOutcome } from '../sim/reliability'
import { findSeaRoute } from '../sim/seaRoute'

/** Pure helpers shared by GameContext and any view that needs to describe
 * a route/ship without touching live state — split out from
 * GameContext.tsx so that file can stay component+hook only (mixing
 * plain exports into a context file breaks React Fast Refresh). */

export type NoticeState = 'none' | 'shown' | 'resolved'

export const OUTCOME_LABEL: Record<SailingOutcome, string> = {
  onTime: 'Alongside on time.',
  late: 'She made it, but late.',
  damaged: 'Damaged coming alongside — repairs needed.',
  severelyDamaged: 'Badly damaged — she needs drydock.',
  cancelled: "Didn't sail today.",
}

export function shipDesignFor(presetName: string) {
  return HERO_SHIPS.find((s) => s.name === presetName)
}

function routeGeometry(route: RouteDefinition) {
  const portA = findPort(route.portAId)
  const portB = findPort(route.portBId)
  if (!portA || !portB) return null
  return { portA, portB, a: projectPort(portA), b: projectPort(portB) }
}

/** Fallback cache for any route not yet in the baked ROUTE_PATHS — e.g. one
 * just added and not yet baked (`npx tsx scripts/bakeRoutePaths.ts`). The
 * pathfind is still a real cost, just no longer one the browser normally
 * pays: routePaths.test.ts guards that every route in ALL_ROUTES has a
 * baked entry, so hitting this fallback in production would mean that
 * guard was bypassed, not the intended path. */
const seaPathFallbackCache = new Map<string, Point[]>()

/** The route's real sailing path — a straight crossing where open water
 * already allows it, or a sequence of waypoints threading around land
 * where it doesn't. This is what every distance/hazard/rendering
 * consumer should use instead of the two ports' straight-line distance,
 * so sailing time, fuel, and the map itself are honest to the geography.
 * Reads the baked data (scripts/bakeRoutePaths.ts) rather than computing
 * the pathfind live — that computation scales with coastline complexity
 * and was the map's slow-and-slowing-further first-load cost. */
export function routeSeaPath(route: RouteDefinition): Point[] | null {
  const baked = ROUTE_PATHS[route.id]
  if (baked) return baked

  const geom = routeGeometry(route)
  if (!geom) return null
  const cached = seaPathFallbackCache.get(route.id)
  if (cached) return cached
  const path = findSeaRoute(geom.a, geom.b, ALL_COASTLINE)
  seaPathFallbackCache.set(route.id, path)
  return path
}

export function routeDistanceKm(route: RouteDefinition): number {
  const path = routeSeaPath(route)
  return path ? pathLengthKm(path) : 0
}

/** Worst hazard along any leg of the route's real sailing path — zones
 * combine by max within a leg (hazardForRoute) and across legs too, same
 * "reckon with your worst stretch" reasoning either way. */
export function routeHazard(route: RouteDefinition): number {
  const path = routeSeaPath(route)
  if (!path) return 0
  let worst = 0
  for (let i = 0; i < path.length - 1; i++) {
    worst = Math.max(worst, hazardForRoute(path[i], path[i + 1], ALL_HAZARD_ZONES))
  }
  return worst
}
