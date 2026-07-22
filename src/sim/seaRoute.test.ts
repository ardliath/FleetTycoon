import { describe, expect, it } from 'vitest'
import { distanceKm } from './geography'
import { convexHull, findSeaRoute, pointInPolygon, segmentsIntersect, smoothPath } from './seaRoute'

describe('segmentsIntersect', () => {
  it('detects a proper crossing', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 })).toBe(true)
  })

  it('is false for segments that do not cross', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false)
  })

  it('is false for parallel, non-overlapping segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false)
  })
})

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ]

  it('is true for a point inside', () => {
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(true)
  })

  it('is false for a point outside', () => {
    expect(pointInPolygon({ x: 10, y: 10 }, square)).toBe(false)
  })
})

describe('convexHull', () => {
  it('is just the corners for a square with extra points along its edges', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 2 },
    ]
    expect(convexHull(square)).toHaveLength(4)
  })

  it('drops a point that sits strictly inside the hull', () => {
    const withInterior = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ]
    expect(convexHull(withInterior)).not.toContainEqual({ x: 5, y: 5 })
  })

  it('keeps every point of a shape that is already fully convex', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 4 }]
    expect(convexHull(triangle)).toHaveLength(3)
  })
})

describe('findSeaRoute performance', () => {
  it('stays fast routing around an obstacle with thousands of vertices', () => {
    // real coastline rings can run into the hundreds of points; this
    // deliberately goes further (2,000, in a dense ring around a simple
    // rectangle's edges) to prove the visibility graph doesn't blow up
    // to "every vertex of every nearby landmass" the way it used to —
    // that's what hung the browser tab before convex-hull reduction.
    const pointsPerEdge = 500
    const bigObstacle: { x: number; y: number }[] = []
    const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
      for (let i = 0; i < pointsPerEdge; i++) {
        const t = i / pointsPerEdge
        bigObstacle.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t })
      }
    }
    addEdge(-10, -10, 10, -10)
    addEdge(10, -10, 10, 10)
    addEdge(10, 10, -10, 10)
    addEdge(-10, 10, -10, -10)
    expect(bigObstacle).toHaveLength(pointsPerEdge * 4)

    const start = { x: -30, y: 0 }
    const end = { x: 30, y: 0 }

    const startTime = performance.now()
    const path = findSeaRoute(start, end, [bigObstacle])
    const elapsedMs = performance.now() - startTime

    expect(path[0]).toEqual(start)
    expect(path[path.length - 1]).toEqual(end)
    expect(path.length).toBeGreaterThan(2)
    expect(elapsedMs).toBeLessThan(2000)
  })
})

describe('findSeaRoute', () => {
  it('returns the direct two-point line when nothing blocks it', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 10, y: 0 }
    const land = [
      [
        { x: 20, y: 20 },
        { x: 24, y: 20 },
        { x: 24, y: 24 },
        { x: 20, y: 24 },
      ],
    ]
    expect(findSeaRoute(start, end, land)).toEqual([start, end])
  })

  it('routes around a headland that sits directly between start and end', () => {
    const start = { x: -10, y: 0 }
    const end = { x: 10, y: 0 }
    // a peninsula jutting down from the north, straddling the direct line
    const headland = [
      { x: -2, y: 20 },
      { x: 2, y: 20 },
      { x: 2, y: -5 },
      { x: -2, y: -5 },
    ]
    const path = findSeaRoute(start, end, [headland])

    expect(path.length).toBeGreaterThan(2)
    expect(path[0]).toEqual(start)
    expect(path[path.length - 1]).toEqual(end)

    // the detour is genuinely longer than the blocked straight line
    let pathKm = 0
    for (let i = 0; i < path.length - 1; i++) pathKm += distanceKm(path[i], path[i + 1])
    expect(pathKm).toBeGreaterThan(distanceKm(start, end))

    // and no leg of it actually cuts across the headland's own footprint
    for (let i = 0; i < path.length - 1; i++) {
      const mid = { x: (path[i].x + path[i + 1].x) / 2, y: (path[i].y + path[i + 1].y) / 2 }
      expect(pointInPolygon(mid, headland)).toBe(false)
    }
  })

  it('ignores land far outside the corridor between start and end', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 10, y: 0 }
    const distantIsland = [
      { x: 500, y: 500 },
      { x: 504, y: 500 },
      { x: 504, y: 504 },
      { x: 500, y: 504 },
    ]
    expect(findSeaRoute(start, end, [distantIsland])).toEqual([start, end])
  })
})

describe('smoothPath', () => {
  it('returns a two-point (straight) path untouched — nothing to smooth', () => {
    const straight = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    expect(smoothPath(straight, [])).toEqual(straight)
  })

  it('rounds a sharp corner that has genuine open water around it', () => {
    const waypoints = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }]
    const distantLand = [
      [
        { x: 100, y: 100 },
        { x: 104, y: 100 },
        { x: 104, y: 104 },
        { x: 100, y: 104 },
      ],
    ]
    const smoothed = smoothPath(waypoints, distantLand)

    // it's a genuine curve now, not the same three points
    expect(smoothed.length).toBeGreaterThan(waypoints.length)
    // the endpoints (the actual ports) never move
    expect(smoothed[0]).toEqual(waypoints[0])
    expect(smoothed[smoothed.length - 1]).toEqual(waypoints[waypoints.length - 1])
    // the sharp corner itself is rounded away, not still a literal vertex
    expect(smoothed).not.toContainEqual(waypoints[1])
  })

  it('declines to round a corner where the smoothed curve would cut across land, keeping it sharp instead', () => {
    // land placed exactly where a rounded version of this corner would
    // bulge through — the headland-tip situation real bent routes hit,
    // where the waypoint sits right on the coast.
    const corner = { x: 5, y: 5 }
    const blockingLand = [
      [
        { x: 3, y: 3.5 },
        { x: 7, y: 3.5 },
        { x: 7, y: 6 },
        { x: 3, y: 6 },
      ],
    ]
    const waypoints = [{ x: 0, y: 0 }, corner, { x: 10, y: 0 }]
    expect(smoothPath(waypoints, blockingLand)).toEqual(waypoints)
  })
})
