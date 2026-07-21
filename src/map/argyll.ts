/**
 * Argyll & the Southern Hebrides — the second region, added after the
 * Clyde pilot proved the pattern (see docs/ROADMAP.md Phase 4 and the
 * regional-chart-import skill). Real ports at real relative positions,
 * same standard as clyde.ts: lat/lon are each port's town-centre
 * coordinate per that town's English Wikipedia infobox (verified
 * 2026-07-18), not the literal pier.
 *
 * Ports/routes chosen: Kennacraig–Islay (both piers), Tayinloan–Gigha,
 * Tarbert–Portavadie, Claonaig–Lochranza and Oban–Colonsay — the real
 * CalMac network here, confirmed with Adam before sourcing any data.
 * Port Askaig–Colonsay (part of the real Oban–Colonsay–Port Askaig–
 * Kennacraig triangle) and Oban–Lismore (Achnacroish) were added later,
 * both real CalMac routes, both within ports/waters already in scope —
 * no new region data needed. Achnacroish's coordinate is its own English
 * Wikipedia infobox entry (verified 2026-07-21), same standard as every
 * other port here.
 *
 * Lochranza is on Arran, whose coastline is already fully drawn by
 * clydeCoastline.ts (the whole island falls inside that region's query
 * box) — argyllCoastline.ts deliberately excludes it to avoid a
 * duplicate/clipped copy; see that file's doc comment.
 *
 * Hazard zone: the Oban–Colonsay crossing is the one genuinely exposed
 * route in this set (open Firth of Lorn water, Atlantic swell) — the
 * others are short, sheltered crossings much like the Clyde's. Severity
 * kept modest, same "honest, not overstated" approach as Clyde's outer
 * Firth zone; real named Hebridean hazards (the Minch, Leverburgh/
 * Berneray) are reserved for the region that actually has them.
 */
import { projectPort, type Port } from '../sim/geography'
import type { HazardZone } from '../sim/hazard'
import type { RouteDefinition } from './clyde'

export const ARGYLL_PORTS: Port[] = [
  { id: 'kennacraig', name: 'Kennacraig', lat: 55.803296, lon: -5.4736237 },
  { id: 'port-ellen', name: 'Port Ellen', lat: 55.6333, lon: -6.1833 },
  { id: 'port-askaig', name: 'Port Askaig', lat: 55.848, lon: -6.106 },
  { id: 'tayinloan', name: 'Tayinloan', lat: 55.65722, lon: -5.66472 },
  { id: 'ardminish', name: 'Ardminish', lat: 55.6667, lon: -5.75 },
  { id: 'tarbert-argyll', name: 'Tarbert', lat: 55.863246, lon: -5.415608 },
  { id: 'portavadie', name: 'Portavadie', lat: 55.8735, lon: -5.3103 },
  { id: 'claonaig', name: 'Claonaig', lat: 55.7572, lon: -5.3932 },
  { id: 'lochranza', name: 'Lochranza', lat: 55.705, lon: -5.295 },
  { id: 'oban', name: 'Oban', lat: 56.412, lon: -5.472 },
  { id: 'colonsay', name: 'Colonsay', lat: 56.07, lon: -6.19 },
  { id: 'achnacroish', name: 'Achnacroish', lat: 56.51111, lon: -5.49444 },
]

export const ARGYLL_ROUTES: RouteDefinition[] = [
  { id: 'kennacraig-port-ellen', name: 'Kennacraig – Port Ellen', portAId: 'kennacraig', portBId: 'port-ellen' },
  { id: 'kennacraig-port-askaig', name: 'Kennacraig – Port Askaig', portAId: 'kennacraig', portBId: 'port-askaig' },
  { id: 'tayinloan-ardminish', name: 'Tayinloan – Gigha', portAId: 'tayinloan', portBId: 'ardminish' },
  { id: 'tarbert-portavadie', name: 'Tarbert – Portavadie', portAId: 'tarbert-argyll', portBId: 'portavadie' },
  { id: 'claonaig-lochranza', name: 'Claonaig – Lochranza', portAId: 'claonaig', portBId: 'lochranza' },
  { id: 'oban-colonsay', name: 'Oban – Colonsay', portAId: 'oban', portBId: 'colonsay' },
  { id: 'port-askaig-colonsay', name: 'Port Askaig – Colonsay', portAId: 'port-askaig', portBId: 'colonsay' },
  { id: 'oban-lismore', name: 'Oban – Lismore', portAId: 'oban', portBId: 'achnacroish' },
]

export const ARGYLL_HAZARD_ZONES: HazardZone[] = [
  {
    id: 'firth-of-lorn-approaches',
    name: 'Firth of Lorn approaches',
    kind: 'openWater',
    center: projectPort({ lat: 56.24, lon: -5.83 }),
    radiusKm: 10,
    severity: 0.3,
  },
]

export function findArgyllPort(id: string): Port | undefined {
  return ARGYLL_PORTS.find((p) => p.id === id)
}

export function findArgyllRoute(id: string): RouteDefinition | undefined {
  return ARGYLL_ROUTES.find((r) => r.id === id)
}
