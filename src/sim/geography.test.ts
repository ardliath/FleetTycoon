import { describe, expect, it } from 'vitest'
import {
  crossingFraction,
  distanceBetweenPorts,
  distanceKm,
  pathLengthKm,
  positionAlongPath,
  positionAlongRoute,
  projectPort,
  shipPositionForDay,
  unprojectPoint,
} from './geography'

describe('projectPort', () => {
  it('is deterministic for the same input', () => {
    const a = projectPort({ lat: 55.87, lon: -4.89 })
    const b = projectPort({ lat: 55.87, lon: -4.89 })
    expect(a).toEqual(b)
  })

  it('further north (higher latitude) projects further along y', () => {
    const south = projectPort({ lat: 55, lon: -5 })
    const north = projectPort({ lat: 60, lon: -5 })
    expect(north.y).toBeGreaterThan(south.y)
  })

  it('further east (less negative/more positive longitude) projects further along x', () => {
    const west = projectPort({ lat: 57, lon: -6 })
    const east = projectPort({ lat: 57, lon: -4 })
    expect(east.x).toBeGreaterThan(west.x)
  })
})

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    const p = { x: 10, y: 20 }
    expect(distanceKm(p, p)).toBe(0)
  })

  it('is symmetric', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 3, y: 4 }
    expect(distanceKm(a, b)).toBe(distanceKm(b, a))
  })

  it('matches simple Pythagorean distance', () => {
    expect(distanceKm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('distanceBetweenPorts', () => {
  it('is zero for the same port', () => {
    const port = { lat: 55.87, lon: -4.89 }
    expect(distanceBetweenPorts(port, port)).toBe(0)
  })

  it('roughly matches known real-world distances at a small regional scale', () => {
    // Wemyss Bay -> Rothesay is a short ~5-6km crossing in reality.
    const wemyssBay = { lat: 55.8747, lon: -4.8859 }
    const rothesay = { lat: 55.8382, lon: -5.0533 }
    const km = distanceBetweenPorts(wemyssBay, rothesay)
    expect(km).toBeGreaterThan(3)
    expect(km).toBeLessThan(15)
  })

  it('a longer real-world crossing produces a proportionally longer distance', () => {
    const wemyssBay = { lat: 55.8747, lon: -4.8859 }
    const rothesay = { lat: 55.8382, lon: -5.0533 }
    // Ardrossan -> Brodick is a longer ~23-26km crossing in reality.
    const ardrossan = { lat: 55.6386, lon: -4.8166 }
    const brodick = { lat: 55.5763, lon: -5.1447 }
    const shortCrossing = distanceBetweenPorts(wemyssBay, rothesay)
    const longCrossing = distanceBetweenPorts(ardrossan, brodick)
    expect(longCrossing).toBeGreaterThan(shortCrossing)
  })
})

describe('unprojectPoint', () => {
  it('round-trips through projectPort', () => {
    const original = { lat: 55.8747, lon: -4.8859 }
    const roundTripped = unprojectPoint(projectPort(original))
    expect(roundTripped.lat).toBeCloseTo(original.lat, 9)
    expect(roundTripped.lon).toBeCloseTo(original.lon, 9)
  })
})

describe('positionAlongRoute', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 20 }

  it('is a at fraction 0', () => {
    expect(positionAlongRoute(a, b, 0)).toEqual(a)
  })

  it('is b at fraction 1', () => {
    expect(positionAlongRoute(a, b, 1)).toEqual(b)
  })

  it('is the midpoint at fraction 0.5', () => {
    expect(positionAlongRoute(a, b, 0.5)).toEqual({ x: 5, y: 10 })
  })
})

describe('crossingFraction', () => {
  it('is null before departure', () => {
    expect(crossingFraction(0.3, 0.55, 0.88)).toBeNull()
  })

  it('is null at or after arrival', () => {
    expect(crossingFraction(0.88, 0.55, 0.88)).toBeNull()
    expect(crossingFraction(0.95, 0.55, 0.88)).toBeNull()
  })

  it('is 0 exactly at departure', () => {
    expect(crossingFraction(0.55, 0.55, 0.88)).toBe(0)
  })

  it('rises linearly across the crossing window', () => {
    const mid = crossingFraction(0.715, 0.55, 0.88)! // (0.88-0.55)/2 + 0.55
    expect(mid).toBeCloseTo(0.5, 1)
  })
})

describe('pathLengthKm', () => {
  it('is the straight distance for a two-point path', () => {
    expect(pathLengthKm([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5, 9)
  })

  it('sums each leg for a multi-point path, longer than the straight distance it detours from', () => {
    const path = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 0 }]
    const straight = distanceKm(path[0], path[2])
    expect(pathLengthKm(path)).toBeGreaterThan(straight)
    expect(pathLengthKm(path)).toBeCloseTo(10, 9)
  })

  it('is 0 for a single-point path', () => {
    expect(pathLengthKm([{ x: 5, y: 5 }])).toBe(0)
  })
})

describe('positionAlongPath', () => {
  const path = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }] // legs of 5km and 3km, 8km total

  it('is the first point at fraction 0 and the last at fraction 1', () => {
    expect(positionAlongPath(path, 0)).toEqual(path[0])
    expect(positionAlongPath(path, 1)).toEqual(path[2])
  })

  it('is a waypoint exactly at the distance fraction it sits at', () => {
    // the first leg is 5 of the 8km total
    const atFirstWaypoint = positionAlongPath(path, 5 / 8)
    expect(atFirstWaypoint.x).toBeCloseTo(3, 6)
    expect(atFirstWaypoint.y).toBeCloseTo(4, 6)
  })

  it('interpolates within a leg proportionally to distance, not waypoint count', () => {
    // halfway by distance (4km) is partway along the first (5km) leg only
    const halfway = positionAlongPath(path, 0.5)
    expect(halfway.x).toBeLessThan(3)
    expect(halfway.y).toBeLessThan(4)
  })
})

describe('shipPositionForDay', () => {
  const straight = [{ x: 0, y: 0 }, { x: 10, y: 20 }]
  const a = straight[0]
  const b = straight[1]
  // departAt/arriveAt as the real model uses them: an equal-length return
  // leg has to finish before the day rolls over (arriveAt + leg <= 1), so
  // departure sits close to arrival. leg = 0.08, return ends at 0.96.
  const departAt = 0.8
  const arriveAt = 0.88
  const returnEnd = arriveAt + (arriveAt - departAt) // 0.96

  it('rests at the origin before departure', () => {
    expect(shipPositionForDay(straight, 0, departAt, arriveAt)).toEqual(a)
    expect(shipPositionForDay(straight, 0.3, departAt, arriveAt)).toEqual(a)
  })

  it('sails out from a to b across the outbound window', () => {
    expect(shipPositionForDay(straight, departAt, departAt, arriveAt)).toEqual(a)
    expect(shipPositionForDay(straight, arriveAt, departAt, arriveAt)).toEqual(b)
  })

  it('sails back from b to a over an equal-length return leg, then rests home the rest of the day', () => {
    const justAfterArrival = shipPositionForDay(straight, arriveAt + 0.001, departAt, arriveAt)
    expect(justAfterArrival.x).toBeLessThan(b.x)
    // home exactly when the equal return leg completes...
    expect(shipPositionForDay(straight, returnEnd, departAt, arriveAt)).toEqual(a)
    // ...and still home for the remainder of the day, no snap.
    expect(shipPositionForDay(straight, 1, departAt, arriveAt)).toEqual(a)
  })

  it('the return leg takes the same time as the outbound — symmetric about arrival', () => {
    const intoOutbound = shipPositionForDay(straight, arriveAt - 0.02, departAt, arriveAt)
    const sameIntoReturn = shipPositionForDay(straight, arriveAt + 0.02, departAt, arriveAt)
    // 0.02 before arrival (outbound) and 0.02 after (return) are the same
    // distance from the far berth, so the same point in space.
    expect(sameIntoReturn.x).toBeCloseTo(intoOutbound.x, 6)
    expect(sameIntoReturn.y).toBeCloseTo(intoOutbound.y, 6)
  })

  it('never jumps: position is continuous at both the departure and arrival boundaries', () => {
    const justBeforeDepart = shipPositionForDay(straight, departAt - 0.001, departAt, arriveAt)
    const atDepart = shipPositionForDay(straight, departAt, departAt, arriveAt)
    expect(justBeforeDepart).toEqual(atDepart)

    const justBeforeArrive = shipPositionForDay(straight, arriveAt - 0.0001, departAt, arriveAt)
    const atArrive = shipPositionForDay(straight, arriveAt, departAt, arriveAt)
    expect(justBeforeArrive.x).toBeCloseTo(atArrive.x, 1)
    expect(justBeforeArrive.y).toBeCloseTo(atArrive.y, 1)
  })

  it('follows a multi-waypoint path, not just its endpoints', () => {
    const bent = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }]
    // partway through the outbound leg, still on the first segment (x should stay 0)
    const early = shipPositionForDay(bent, departAt + (arriveAt - departAt) * 0.1, departAt, arriveAt)
    expect(early.x).toBeCloseTo(0, 6)
    expect(early.y).toBeGreaterThan(0)
    // fully arrived, at the far end of the bend
    expect(shipPositionForDay(bent, arriveAt, departAt, arriveAt)).toEqual(bent[2])
    // home again once the return leg completes
    expect(shipPositionForDay(bent, returnEnd, departAt, arriveAt)).toEqual(bent[0])
  })
})
