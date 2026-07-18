/**
 * Hazard zones and route-risk intersection — pure geometry, no rendering.
 * A zone is a circle (centre + radius, in the km space geography.ts
 * projects into): a `passage` is a small, specific, notoriously dangerous
 * stretch (Leverburgh/Berneray, the Corryvreckan); `openWater` is a wider,
 * more exposed stretch that's simply rougher going (the Minch, the Little
 * Minch) rather than a named pinch-point. Both combine the same way — the
 * distinction is authoring metadata, not different maths.
 */
import type { Point } from './geography'

export type HazardKind = 'passage' | 'openWater'

export interface HazardZone {
  id: string
  name: string
  kind: HazardKind
  center: Point
  radiusKm: number
  /** Contribution to a crossing route's hazard if crossed, 0..1 — feeds
   * captain.ts's `hazard` parameter directly. */
  severity: number
}

/** Ambient hazard for a route that crosses no authored zone at all — open
 * water always carries some baseline risk, just not enough to name. */
const BASELINE_HAZARD = 0.05

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Shortest distance from a point to a line segment [a, b], in the same
 * units as the points (km, per geography.ts's projection). */
export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y) // a and b coincide
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq
  t = clamp(t, 0, 1)
  const closest = { x: a.x + t * abx, y: a.y + t * aby }
  return Math.hypot(p.x - closest.x, p.y - closest.y)
}

export function routeCrossesZone(a: Point, b: Point, zone: HazardZone): boolean {
  return distancePointToSegment(zone.center, a, b) <= zone.radiusKm
}

/** Combined hazard, 0..1, for a route's line segment against a set of
 * authored zones. Zones combine by max, not sum — crossing two moderate
 * zones isn't worse than crossing the worse of the two; a route either
 * has to reckon with its most dangerous stretch or it doesn't. */
export function hazardForRoute(a: Point, b: Point, zones: readonly HazardZone[]): number {
  const crossed = zones.filter((z) => routeCrossesZone(a, b, z))
  if (crossed.length === 0) return BASELINE_HAZARD
  return clamp(Math.max(...crossed.map((z) => z.severity)), 0, 1)
}
