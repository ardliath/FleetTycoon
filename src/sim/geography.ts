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

/** Reference latitude for the longitude cosine correction below. Balanced
 * between the Clyde (~55.6°N) and Shetland (~60.8°N) — the full range this
 * map now covers — rather than sitting close to either end, so east-west
 * distortion is roughly even at both extremes (~7-8%) instead of small at
 * one end and much larger at the other. Changing this rescales every
 * projected x-coordinate; any baked/static geometry (coastline, depth
 * contours) generated under the old value needs its x-coordinates rescaled
 * by cos(newRef)/cos(oldRef) to stay aligned with ports and routes, which
 * are projected live from lat/lon and pick up the new value automatically. */
const REFERENCE_LAT_DEG = 58

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

/** Inverse of projectPort — a projected point back to lat/lon. Used to
 * label the map's graticule with real coordinates rather than made-up
 * ones. */
export function unprojectPoint(p: Point): { lat: number; lon: number } {
  const lat = p.y / KM_PER_LAT_DEGREE
  const lon = p.x / (Math.cos((REFERENCE_LAT_DEG * Math.PI) / 180) * KM_PER_LAT_DEGREE)
  return { lat, lon }
}

export function distanceKm(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distanceBetweenPorts(a: Pick<Port, 'lat' | 'lon'>, b: Pick<Port, 'lat' | 'lon'>): number {
  return distanceKm(projectPort(a), projectPort(b))
}

/**
 * Where a ship sits along a crossing, 0..1 -> a point between `a` and `b`.
 * Straight-line interpolation — the map is stylised, not a real transit
 * simulation with currents/headings, so a lerp is honest to what this is.
 */
export function positionAlongRoute(a: Point, b: Point, fraction: number): Point {
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction }
}

/**
 * Maps today's day-progress (0..1, see sim/calendar.ts's dayProgress) onto
 * a crossing fraction (0..1) for the departAt..arriveAt window, or null
 * outside it — meaning the ship is resting at her origin port, not
 * mid-crossing. Pure function of the same three numbers; see
 * src/game/routeTiming.ts for what values the app actually uses.
 */
export function crossingFraction(dayProgress: number, departAt: number, arriveAt: number): number | null {
  if (dayProgress < departAt || dayProgress >= arriveAt) return null
  return (dayProgress - departAt) / (arriveAt - departAt)
}

/** Total length of a multi-point path — the sum of its segment lengths,
 * not the straight distance between its ends. This is a route's real
 * sailing distance once it threads around land (see sim/seaRoute.ts). */
export function pathLengthKm(path: Point[]): number {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += distanceKm(path[i], path[i + 1])
  return total
}

/**
 * Where a ship sits along a multi-point path, 0..1 by distance travelled
 * (not by waypoint count) — a long leg between two waypoints covers more
 * of the fraction than a short one, same as sailing it for real would.
 */
export function positionAlongPath(path: Point[], fraction: number): Point {
  if (path.length === 1) return path[0]
  const total = pathLengthKm(path)
  if (total === 0) return path[0]
  const target = Math.min(1, Math.max(0, fraction)) * total

  let covered = 0
  for (let i = 0; i < path.length - 1; i++) {
    const segLen = distanceKm(path[i], path[i + 1])
    if (i === path.length - 2 || covered + segLen >= target) {
      const segFraction = segLen === 0 ? 0 : Math.min(1, Math.max(0, (target - covered) / segLen))
      return positionAlongRoute(path[i], path[i + 1], segFraction)
    }
    covered += segLen
  }
  return path[path.length - 1]
}

/**
 * Where a ship sits for the *whole* day, out and back — real ferries
 * return to their home port the same day, they don't sail once and vanish.
 * She rests at the origin before departure, sails out along `path` during
 * departAt..arriveAt (arriveAt matches the notice/auto-resolve window),
 * then sails back along the same path over an *equal-length* return leg
 * (same distance each way, so the same time each way), and rests at the
 * origin again for the rest of the day. `path` is the route's real sailing
 * path (sim/seaRoute.ts) — a straight two-point crossing is just the
 * one-segment case. The caller sizes the outbound leg per route (see
 * routeTiming.ts's `departAtForDistance`); with arrival pinned near 0.88
 * and the leg capped so the equal return finishes by the day boundary, she
 * is always home before the day rolls over — no visual snap back to origin.
 */
export function shipPositionForDay(path: Point[], dayProgress: number, departAt: number, arriveAt: number): Point {
  const legDuration = arriveAt - departAt
  if (legDuration <= 0 || dayProgress < departAt) return path[0]
  if (dayProgress < arriveAt) {
    return positionAlongPath(path, (dayProgress - departAt) / legDuration)
  }
  const returnEnd = arriveAt + legDuration
  if (dayProgress < returnEnd) {
    const returning = [...path].reverse()
    return positionAlongPath(returning, (dayProgress - arriveAt) / legDuration)
  }
  return path[0] // home again, resting until the next day
}
