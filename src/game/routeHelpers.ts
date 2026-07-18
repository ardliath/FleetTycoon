import type { RouteDefinition } from '../map/clyde'
import { ALL_HAZARD_ZONES, findPort } from '../map/regions'
import { HERO_SHIPS } from '../ship/presets'
import { distanceBetweenPorts, projectPort } from '../sim/geography'
import { hazardForRoute } from '../sim/hazard'
import type { SailingOutcome } from '../sim/reliability'

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

export function routeDistanceKm(route: RouteDefinition): number {
  const geom = routeGeometry(route)
  return geom ? distanceBetweenPorts(geom.portA, geom.portB) : 0
}

export function routeHazard(route: RouteDefinition): number {
  const geom = routeGeometry(route)
  return geom ? hazardForRoute(geom.a, geom.b, ALL_HAZARD_ZONES) : 0
}

export function routePoints(route: RouteDefinition) {
  const geom = routeGeometry(route)
  return geom ? { a: geom.a, b: geom.b } : null
}
