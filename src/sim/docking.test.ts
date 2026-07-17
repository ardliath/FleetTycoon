import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCKING_PARAMS,
  advanceControls,
  initialDockingState,
  speedOverGround,
  stepDocking,
  type DockingControls,
  type DockingInputs,
  type Wind,
} from './docking'

const DT = 0.1 // one 100ms tick
const NO_WIND: Wind = { fx: 0, fy: 0 }
const noControls: DockingControls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }

function run(
  state = initialDockingState(),
  controls: DockingControls,
  wind: Wind,
  ticks: number,
) {
  let s = state
  for (let i = 0; i < ticks; i++) s = stepDocking(s, controls, wind, DEFAULT_DOCKING_PARAMS, DT)
  return s
}

const noInputs: DockingInputs = {
  portAhead: false,
  portAstern: false,
  stbdAhead: false,
  stbdAstern: false,
  bowLeft: false,
  bowRight: false,
  enginesStop: false,
}

describe('stepDocking — determinism', () => {
  it('same inputs always produce the same output', () => {
    const controls: DockingControls = { portEngine: 0.7, stbdEngine: 0.3, bowThruster: -0.5 }
    const wind: Wind = { fx: 3, fy: -2 }
    const a = run(initialDockingState(), controls, wind, 50)
    const b = run(initialDockingState(), controls, wind, 50)
    expect(a).toEqual(b)
  })
})

describe('stepDocking — engines', () => {
  it('both engines ahead drive the ship forward along its heading', () => {
    const s = run(initialDockingState(), { portEngine: 1, stbdEngine: 1, bowThruster: 0 }, NO_WIND, 30)
    expect(s.surge).toBeGreaterThan(0)
    expect(s.x).toBeGreaterThan(0) // heading 0 = +x
    expect(Math.abs(s.y)).toBeLessThan(1e-6) // no sideways drift, dead ahead
    expect(Math.abs(s.yawRate)).toBeLessThan(1e-9) // balanced engines, no turn
  })

  it('reaches a stable terminal speed under constant full power', () => {
    const controls: DockingControls = { portEngine: 1, stbdEngine: 1, bowThruster: 0 }
    const long = run(initialDockingState(), controls, NO_WIND, 4000)
    const expectedTerminal =
      (2 * DEFAULT_DOCKING_PARAMS.engineThrust) / DEFAULT_DOCKING_PARAMS.surgeDrag
    expect(long.surge).toBeCloseTo(expectedTerminal, 1)
  })

  it('differential thrust (port ahead, starboard astern) turns the ship almost on the spot', () => {
    const s = run(initialDockingState(), { portEngine: 1, stbdEngine: -1, bowThruster: 0 }, NO_WIND, 30)
    expect(Math.abs(s.yawRate)).toBeGreaterThan(0.01) // it's turning
    expect(s.heading).not.toBe(0)
    // net forward force cancels, so it barely translates compared with a real transit
    expect(Math.hypot(s.x, s.y)).toBeLessThan(1)
  })

  it('port ahead + starboard astern yaws CCW (bow swings to port)', () => {
    const s = run(initialDockingState(), { portEngine: 1, stbdEngine: -1, bowThruster: 0 }, NO_WIND, 10)
    expect(s.heading).toBeGreaterThan(0) // CCW positive
  })
})

describe('stepDocking — momentum (the heavy feel)', () => {
  it('keeps coasting after power is cut, then eventually comes to rest', () => {
    const moving = run(initialDockingState(), { portEngine: 1, stbdEngine: 1, bowThruster: 0 }, NO_WIND, 100)
    expect(moving.surge).toBeGreaterThan(1)

    // one tick after cutting power: still moving nearly as fast (real momentum)
    const justAfter = stepDocking(moving, noControls, NO_WIND, DEFAULT_DOCKING_PARAMS, DT)
    expect(justAfter.surge).toBeGreaterThan(moving.surge * 0.9)

    // long after: effectively stopped
    const later = run(moving, noControls, NO_WIND, 2000)
    expect(later.surge).toBeLessThan(0.05)
  })
})

describe('stepDocking — wind', () => {
  it('a dead ship drifts downwind', () => {
    const wind: Wind = { fx: 5, fy: 0 }
    const s = run(initialDockingState(), noControls, wind, 100)
    expect(s.x).toBeGreaterThan(0) // pushed in +x, the wind direction
  })

  it('stronger wind pushes harder', () => {
    const weak = run(initialDockingState(), noControls, { fx: 3, fy: 0 }, 100)
    const strong = run(initialDockingState(), noControls, { fx: 9, fy: 0 }, 100)
    expect(strong.x).toBeGreaterThan(weak.x)
  })
})

describe('stepDocking — bow thruster', () => {
  it('produces both a lateral push and a yaw', () => {
    const s = run(initialDockingState(), { portEngine: 0, stbdEngine: 0, bowThruster: 1 }, NO_WIND, 20)
    expect(Math.abs(s.sway)).toBeGreaterThan(0) // lateral push
    expect(Math.abs(s.yawRate)).toBeGreaterThan(0) // and a turn
  })

  it('opposite thruster directions mirror each other', () => {
    const left = run(initialDockingState(), { portEngine: 0, stbdEngine: 0, bowThruster: -1 }, NO_WIND, 20)
    const right = run(initialDockingState(), { portEngine: 0, stbdEngine: 0, bowThruster: 1 }, NO_WIND, 20)
    expect(left.yawRate).toBeCloseTo(-right.yawRate, 6)
  })
})

describe('advanceControls', () => {
  it('ramps a persistent engine lever up while ahead is held, and holds it when released', () => {
    let c: DockingControls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }
    const aheadInputs = { ...noInputs, portAhead: true }
    for (let i = 0; i < 5; i++) c = advanceControls(c, aheadInputs, DEFAULT_DOCKING_PARAMS, DT)
    const rampedTo = c.portEngine
    expect(rampedTo).toBeGreaterThan(0)
    expect(rampedTo).toBeLessThan(1)
    // release: lever holds its setting (telegraph, not spring-return)
    c = advanceControls(c, noInputs, DEFAULT_DOCKING_PARAMS, DT)
    expect(c.portEngine).toBe(rampedTo)
  })

  it('clamps engine levers to [-1, 1]', () => {
    let c: DockingControls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }
    const aheadInputs = { ...noInputs, portAhead: true }
    for (let i = 0; i < 500; i++) c = advanceControls(c, aheadInputs, DEFAULT_DOCKING_PARAMS, DT)
    expect(c.portEngine).toBe(1)
  })

  it('enginesStop eases both levers back toward zero', () => {
    let c: DockingControls = { portEngine: 0.8, stbdEngine: -0.6, bowThruster: 0 }
    const stopInputs = { ...noInputs, enginesStop: true }
    for (let i = 0; i < 500; i++) c = advanceControls(c, stopInputs, DEFAULT_DOCKING_PARAMS, DT)
    expect(c.portEngine).toBe(0)
    expect(c.stbdEngine).toBe(0)
  })

  it('bow thruster is momentary — active only while held', () => {
    const params = DEFAULT_DOCKING_PARAMS
    let c: DockingControls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }
    c = advanceControls(c, { ...noInputs, bowRight: true }, params, DT)
    expect(c.bowThruster).toBe(1)
    c = advanceControls(c, noInputs, params, DT)
    expect(c.bowThruster).toBe(0)
  })
})

describe('speedOverGround', () => {
  it('combines surge and sway', () => {
    expect(speedOverGround(initialDockingState({ surge: 3, sway: 4 }))).toBeCloseTo(5, 6)
  })
})
