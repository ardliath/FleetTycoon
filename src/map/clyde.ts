/**
 * The Clyde pilot — Phase 4's proving ground before the rest of Scotland
 * gets added region by region. Real ports at real relative positions, per
 * docs/GAME_DESIGN.md's "stylised... at real relative distances." Lat/lon
 * are each port's town-centre coordinate per that town's English Wikipedia
 * infobox (verified 2026-07-18) — not the literal pier, which Wikipedia
 * doesn't give separately, but within ~1km of it for every port here,
 * comfortably inside the "recognisably right" bar this map is held to.
 * If a port still looks visually wrong once rendered, correct the lat/lon
 * here against a better source, this is public factual geography rather
 * than the subjective photo-matching the ship builder needs.
 *
 * Deliberately has no Leverburgh/Berneray- or Corryvreckan-grade hazard:
 * those are real Hebridean/Argyll dangers that don't belong on a Clyde
 * crossing. The one hazard zone here is honest to the geography — a
 * milder stretch of open water on the outer firth between Ardrossan and
 * Brodick, not a named danger.
 */
import { projectPort, type Port } from '../sim/geography'
import type { HazardZone } from '../sim/hazard'

export const CLYDE_PORTS: Port[] = [
  { id: 'wemyss-bay', name: 'Wemyss Bay', lat: 55.8839, lon: -4.8869 },
  { id: 'rothesay', name: 'Rothesay', lat: 55.8333, lon: -5.05 },
  { id: 'ardrossan', name: 'Ardrossan', lat: 55.6433, lon: -4.8097 },
  { id: 'brodick', name: 'Brodick', lat: 55.5761, lon: -5.1511 },
  { id: 'gourock', name: 'Gourock', lat: 55.953763, lon: -4.8173176 },
  { id: 'dunoon', name: 'Dunoon', lat: 55.9508, lon: -4.9261 },
]

export interface RouteDefinition {
  id: string
  name: string
  portAId: string
  portBId: string
}

export const CLYDE_ROUTES: RouteDefinition[] = [
  { id: 'wemyss-bay-rothesay', name: 'Wemyss Bay – Rothesay', portAId: 'wemyss-bay', portBId: 'rothesay' },
  { id: 'ardrossan-brodick', name: 'Ardrossan – Brodick', portAId: 'ardrossan', portBId: 'brodick' },
  { id: 'gourock-dunoon', name: 'Gourock – Dunoon', portAId: 'gourock', portBId: 'dunoon' },
]

export const CLYDE_HAZARD_ZONES: HazardZone[] = [
  {
    id: 'outer-firth-chop',
    name: 'Outer Firth of Clyde',
    kind: 'openWater',
    center: projectPort({ lat: 55.605, lon: -4.95 }),
    radiusKm: 8,
    severity: 0.25,
  },
]

export function findClydePort(id: string): Port | undefined {
  return CLYDE_PORTS.find((p) => p.id === id)
}

export function findClydeRoute(id: string): RouteDefinition | undefined {
  return CLYDE_ROUTES.find((r) => r.id === id)
}
