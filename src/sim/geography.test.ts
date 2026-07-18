import { describe, expect, it } from 'vitest'
import { distanceBetweenPorts, distanceKm, projectPort } from './geography'

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
