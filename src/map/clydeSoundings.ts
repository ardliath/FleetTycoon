/**
 * Real depth soundings for the Clyde pilot — point queries against
 * EMODnet Bathymetry's mean depth grid (https://emodnet.ec.europa.eu/,
 * WMS GetFeatureInfo, © EMODnet Bathymetry Consortium), not invented.
 * Positions are a filtered subset of a query grid: land/near-shore
 * points (positive elevation, or shallow enough to be ambiguous mud/
 * tidal-flat pixels) dropped, remainder spaced apart and kept clear of
 * ports and the map's chrome corners. Same km-space as
 * sim/geography.ts's projectPort. Regenerate by re-querying the same
 * grid if the pilot's bounding box changes.
 */
import type { Point } from '../sim/geography'

export interface Sounding extends Point {
  depthM: number
}

export const CLYDE_SOUNDINGS: Sounding[] = [
  { x: -317.22, y: 6166.82, depthM: 51 },
  { x: -309.59, y: 6166.82, depthM: 65 },
  { x: -301.96, y: 6166.82, depthM: 63 },
  { x: -294.32, y: 6166.82, depthM: 56 },
  { x: -301.96, y: 6175.01, depthM: 94 },
  { x: -294.32, y: 6175.01, depthM: 69 },
  { x: -332.49, y: 6183.20, depthM: 14 },
  { x: -324.86, y: 6183.20, depthM: 29 },
  { x: -301.96, y: 6183.20, depthM: 92 },
  { x: -294.32, y: 6183.20, depthM: 76 },
  { x: -286.69, y: 6183.20, depthM: 23 },
  { x: -309.59, y: 6191.38, depthM: 50 },
  { x: -301.96, y: 6191.38, depthM: 143 },
  { x: -324.86, y: 6199.57, depthM: 103 },
  { x: -309.59, y: 6199.57, depthM: 165 },
  { x: -301.96, y: 6199.57, depthM: 76 },
  { x: -317.22, y: 6207.75, depthM: 157 },
  { x: -309.59, y: 6207.75, depthM: 26 },
  { x: -301.96, y: 6207.75, depthM: 94 },
  { x: -301.96, y: 6215.94, depthM: 48 },
  { x: -324.86, y: 6224.12, depthM: 29 },
  { x: -324.86, y: 6232.31, depthM: 53 },
]
