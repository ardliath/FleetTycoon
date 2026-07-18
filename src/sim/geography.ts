/**
 * Geography for the map — real port positions projected onto a stylized
 * 2D plane that preserves real relative distances at this regional scale.
 * Pure, no DOM/Phaser: positions and distances are simulation inputs
 * (route economics, hazard-zone intersection), not rendering concerns.
 */

export interface Port {
  id: string
  name: string
  /** Real-world latitude/longitude, decimal degrees — the source of truth
   * for position. Drafted from known geography; if a port looks visually
   * wrong once rendered, correct the lat/lon here, don't hand-tune xy. */
  lat: number
  lon: number
}

export interface Point {
  x: number
  y: number
}

/** Reference latitude for the longitude cosine correction below — chosen
 * near the centre of Scotland's west coast so east-west distances don't
 * distort much across the range this map eventually covers (Clyde up to
 * Shetland). */
const REFERENCE_LAT_DEG = 57

/** Roughly km per degree of latitude — scales both axes into a consistent
 * unit (km) rather than raw degrees, so distances read as actual
 * kilometres rather than an arbitrary map-space unit. */
const KM_PER_LAT_DEGREE = 111.32

/** Project a lat/lon onto a flat plane in kilometres — equirectangular
 * with a cosine correction for longitude. Accurate enough at Scotland's
 * regional scale (a few hundred km), not a survey projection. Y grows
 * north; screen renderers should negate it themselves, not this function
 * — this is simulation space, not screen space. */
export function projectPort(port: Pick<Port, 'lat' | 'lon'>): Point {
  const x = port.lon * Math.cos((REFERENCE_LAT_DEG * Math.PI) / 180) * KM_PER_LAT_DEGREE
  const y = port.lat * KM_PER_LAT_DEGREE
  return { x, y }
}

export function distanceKm(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distanceBetweenPorts(a: Pick<Port, 'lat' | 'lon'>, b: Pick<Port, 'lat' | 'lon'>): number {
  return distanceKm(projectPort(a), projectPort(b))
}
