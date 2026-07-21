/**
 * Real sea-route pathfinding — a ferry crossing follows open water, not a
 * straight line drawn through the nearest headland. Given real coastline
 * polygons (the same rings MapView already renders as land), this finds
 * the shortest path from one port to another that never cuts through
 * land: a straight line where open water already allows it (most short
 * Clyde-style crossings), or a route threading around the obstructing
 * coastline via a visibility graph otherwise (Kennacraig out around West
 * Loch Tarbert's own headland, say). This is what makes route distance —
 * and so sailing time and fuel cost — honest to the geography instead of
 * "as the crow flies."
 *
 * Classic visibility-graph shortest path: land polygon vertices become
 * graph nodes alongside the start/end ports, two nodes are joined by an
 * edge if the straight segment between them doesn't cross any land, and
 * Dijkstra finds the shortest path over that graph. Candidate polygons
 * are filtered to a padded corridor around the direct crossing first —
 * with ~3,500 coastline vertices across both charted regions, checking
 * every one for every route would be needlessly slow; a route only ever
 * needs to know about the land actually near its own crossing.
 */
import { distanceKm, type Point } from './geography'

interface BBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function ringBBox(ring: Point[]): BBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of ring) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY }
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

/** Proper segment intersection (CLRS-style orientation test), including
 * collinear-overlap cases. Two segments that only touch at a shared
 * endpoint are handled by the caller, not here — see segmentCrossesRing,
 * which excludes edges sharing an endpoint with the query segment before
 * ever calling this. */
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y)

  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (d1 === 0 && onSegment(p3, p1, p4)) return true
  if (d2 === 0 && onSegment(p3, p2, p4)) return true
  if (d3 === 0 && onSegment(p1, p3, p2)) return true
  if (d4 === 0 && onSegment(p1, p4, p2)) return true
  return false
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(p: Point, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x
    const yi = ring[i].y
    const xj = ring[j].x
    const yj = ring[j].y
    const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Strict transversal crossing only — unlike segmentsIntersect, a
 * collinear/touching overlap does NOT count. Two hull corners of the same
 * ring are routinely joined by a candidate visibility edge that runs
 * exactly along a straight run of the ring's own boundary between them
 * (hugging the coast around a headland, say); that's a valid edge to
 * sail, not land the ship is cutting through, so it must not trip the
 * same "blocked" logic a genuine crossing would. */
function properlyCrosses(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** Whether segment a-b crosses this ring's boundary — edges sharing an
 * endpoint with a or b are skipped (a segment leaving exactly from a
 * polygon's own vertex isn't "crossing" that vertex's adjacent edges). */
function segmentCrossesRing(a: Point, b: Point, ring: Point[]): boolean {
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i]
    const d = ring[(i + 1) % ring.length]
    if (pointsEqual(a, c) || pointsEqual(a, d) || pointsEqual(b, c) || pointsEqual(b, d)) continue
    if (properlyCrosses(a, b, c, d)) return true
  }
  return false
}

/** Whether segment a-b is blocked by any land ring — either it crosses a
 * ring's boundary, or (the case a pure edge-crossing check alone would
 * miss) it passes entirely through a ring's interior between two of its
 * vertices without crossing any other edge, caught by checking the
 * segment's midpoint. */
function segmentBlockedByLand(a: Point, b: Point, land: Point[][]): boolean {
  for (const ring of land) {
    if (segmentCrossesRing(a, b, ring)) return true
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  for (const ring of land) {
    if (pointInPolygon(mid, ring)) return true
  }
  return false
}

/** Convex hull (monotone chain), returning a subset of `points` itself —
 * same coordinate values, not copies, so pointsEqual-based comparisons
 * elsewhere still match. Used to cut a large coastline ring's hundreds of
 * vertices down to just the handful that can ever matter for routing
 * *around* it: a shortest path skirting an obstacle only ever bends at
 * its outward-facing corners, never at a concave notch tucked into its
 * own coastline. This is what keeps the visibility graph small enough to
 * build in well under a second even for a route that has to go around a
 * genuinely large landmass like Islay or Jura, instead of the graph
 * blowing up to thousands of nodes and hanging the browser tab. */
export function convexHull(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)

  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Hard ceiling on visibility-graph nodes, applied after hull reduction —
 * belt and braces so a pathological corridor (many overlapping large
 * rings) can never make the O(n^2) graph build hang the tab, whatever
 * future coastline data looks like. Even a route needing every one of
 * these as real waypoints would still get a usable, if slightly less
 * than optimal, path — see the decimation below. */
const MAX_CANDIDATE_NODES = 80

interface Edge {
  to: number
  weight: number
}

function dijkstra(adjacency: Edge[][], startIdx: number, endIdx: number): number[] | null {
  const n = adjacency.length
  const dist = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const visited = new Array<boolean>(n).fill(false)
  dist[startIdx] = 0

  for (let iter = 0; iter < n; iter++) {
    let u = -1
    let best = Infinity
    for (let k = 0; k < n; k++) {
      if (!visited[k] && dist[k] < best) {
        best = dist[k]
        u = k
      }
    }
    if (u === -1) break
    visited[u] = true
    if (u === endIdx) break
    for (const edge of adjacency[u]) {
      const alt = dist[u] + edge.weight
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt
        prev[edge.to] = u
      }
    }
  }

  if (dist[endIdx] === Infinity) return null
  const indices: number[] = []
  for (let cur = endIdx; cur !== -1; cur = prev[cur]) indices.unshift(cur)
  return indices
}

/**
 * The shortest open-water path from `start` to `end` around the given
 * land polygons — `[start, end]` directly wherever a straight crossing
 * doesn't cut through land, which is most routes. Falls back to the
 * straight line if no path is found at all (shouldn't happen for real
 * coastal geography with a generous enough corridor, but a slightly
 * unrealistic line beats a crash).
 *
 * A port sitting exactly on the coast can end up marginally *inside* its
 * own simplified coastline ring — Douglas-Peucker simplification can
 * shift a boundary by its tolerance, enough to swallow a real quayside
 * point. Left unhandled, that ring blocks every candidate segment leaving
 * that port (its own coastline "surrounds" it), isolating the port from
 * the whole graph and silently falling back to a straight line that
 * actually does cut through land — worse than the bug this function
 * exists to fix. So: whichever ring (if any) start or end falls inside is
 * excluded from blocking checks for segments touching that specific
 * endpoint, and only that endpoint — a real crossing of a *different*
 * landmass elsewhere is still blocked normally.
 */
export function findSeaRoute(start: Point, end: Point, land: Point[][]): Point[] {
  const startRing = land.find((ring) => pointInPolygon(start, ring))
  const endRing = land.find((ring) => pointInPolygon(end, ring))

  const landFor = (touchesStart: boolean, touchesEnd: boolean): Point[][] => {
    if (!touchesStart && !touchesEnd) return land
    return land.filter((ring) => !(touchesStart && ring === startRing) && !(touchesEnd && ring === endRing))
  }

  if (!segmentBlockedByLand(start, end, landFor(true, true))) return [start, end]

  const directKm = distanceKm(start, end)
  const pad = Math.max(directKm * 0.6, 8)
  const corridor: BBox = {
    minX: Math.min(start.x, end.x) - pad,
    maxX: Math.max(start.x, end.x) + pad,
    minY: Math.min(start.y, end.y) - pad,
    maxY: Math.max(start.y, end.y) + pad,
  }

  const relevant = land.filter((ring) => bboxesOverlap(ringBBox(ring), corridor))
  if (relevant.length === 0) return [start, end]

  let candidates = relevant.flatMap((ring) => convexHull(ring))
  if (candidates.length > MAX_CANDIDATE_NODES) {
    const step = Math.ceil(candidates.length / MAX_CANDIDATE_NODES)
    candidates = candidates.filter((_, i) => i % step === 0)
  }

  const nodes: Point[] = [start, end, ...candidates]
  const n = nodes.length

  // Each candidate segment only ever needs checking against the handful
  // of rings actually near IT, not every ring in the whole (much wider)
  // corridor — precomputing each relevant ring's own bbox once turns the
  // O(pairs x total corridor edges) cost into O(pairs x nearby edges),
  // the difference between a route around a large landmass taking
  // seconds versus milliseconds.
  const relevantWithBBox = relevant.map((ring) => ({ ring, bbox: ringBBox(ring) }))

  const adjacency: Edge[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    const touchesStart = i === 0
    const touchesEnd = i === 1
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const pairTouchesStart = touchesStart || j === 0
      const pairTouchesEnd = touchesEnd || j === 1
      const segBox: BBox = {
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
      }
      const nearbyLand: Point[][] = []
      for (const { ring, bbox } of relevantWithBBox) {
        if (pairTouchesStart && ring === startRing) continue
        if (pairTouchesEnd && ring === endRing) continue
        if (bboxesOverlap(bbox, segBox)) nearbyLand.push(ring)
      }
      if (!segmentBlockedByLand(a, b, nearbyLand)) {
        const weight = distanceKm(a, b)
        adjacency[i].push({ to: j, weight })
        adjacency[j].push({ to: i, weight })
      }
    }
  }

  const indices = dijkstra(adjacency, 0, 1)
  if (!indices) return [start, end]
  return indices.map((i) => nodes[i])
}
