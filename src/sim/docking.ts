/**
 * Docking physics — a 2D rigid-body model of a twin-screw ferry manoeuvring
 * at close quarters. Pure and deterministic: no React/Phaser/DOM, no
 * Math.random, no Date.now. State advances one fixed tick per `stepDocking`
 * call (see src/sim/tick.ts and the sim README for why).
 *
 * COORDINATES: standard maths convention — x right, y UP, angle CCW, heading
 * 0 = bow pointing +x. The renderer (Phaser, y-down) converts at its boundary;
 * keeping the sim in maths coords keeps the physics readable and engine-free.
 *
 * MODEL: three degrees of freedom in the body frame —
 *   surge  = velocity along the hull axis (bow-positive), m/s
 *   sway   = velocity across the hull (starboard-positive), m/s
 *   yawRate = rotation rate, rad/s (CCW positive)
 * Forces: two independent engines at the stern (differential thrust turns the
 * ship without headway — the whole point of twin screws), a bow thruster for
 * lateral push, a steady wind, and hydrodynamic damping. Sway is heavily
 * damped (a hull grips the water sideways); surge and yaw carry real momentum
 * (the "heavy & deliberate" feel — managing that inertia is the skill).
 */

export interface DockingState {
  /** Position of the centre of gravity, metres. */
  x: number
  y: number
  /** Heading, radians. 0 = bow pointing +x, CCW positive. */
  heading: number
  /** Velocity along the hull axis (bow-positive), m/s. */
  surge: number
  /** Velocity across the hull (starboard-positive), m/s. */
  sway: number
  /** Rotation rate, rad/s (CCW positive). */
  yawRate: number
}

export interface DockingControls {
  /** Port engine setting, -1 (full astern) .. +1 (full ahead). Persistent. */
  portEngine: number
  /** Starboard engine setting, -1 .. +1. Persistent. */
  stbdEngine: number
  /** Bow thruster, -1 (push bow to port) .. +1 (push bow to starboard). */
  bowThruster: number
}

/** Steady wind as a world-frame force vector (already scaled to sim units). */
export interface Wind {
  fx: number
  fy: number
}

export interface DockingParams {
  /** Translational inertia. Higher = slower to gather way and to stop. */
  mass: number
  /** Rotational inertia. Higher = slower to start/stop turning. */
  inertia: number
  /** Peak force of one engine at full ahead/astern. */
  engineThrust: number
  /** Lateral moment arm of the engines — sets differential-thrust turn power. */
  engineYawArm: number
  /** Peak lateral force of the bow thruster. */
  bowThrust: number
  /** Longitudinal distance from CG to the bow thruster — its turning leverage. */
  bowArm: number
  /** Linear damping of forward motion (higher = shorter coast). */
  surgeDrag: number
  /** Linear damping of sideways motion (high — hulls resist sway). */
  swayDrag: number
  /** Angular damping (higher = turning bleeds off faster). */
  yawDrag: number
  /** How fast an engine lever ramps toward its ordered setting, per second. */
  leverRampPerSec: number
}

/**
 * Starting parameters for the Isle of Arran (~85m). Tuned for a heavy,
 * deliberate feel: ~12s surge time constant, ~4 m/s full-ahead terminal
 * speed, a slow (~6 deg/s) full-differential turn, and a bow thruster punchy
 * enough for fine aim at zero speed. These are FEEL numbers — expect Phase 1
 * playtesting to move them; that's the point of tuning them here.
 */
export const DEFAULT_DOCKING_PARAMS: DockingParams = {
  mass: 100,
  inertia: 8000,
  engineThrust: 16,
  engineYawArm: 3.5,
  bowThrust: 5,
  bowArm: 34,
  surgeDrag: 8,
  swayDrag: 34,
  yawDrag: 1100,
  leverRampPerSec: 0.9,
}

export function initialDockingState(partial: Partial<DockingState> = {}): DockingState {
  return { x: 0, y: 0, heading: 0, surge: 0, sway: 0, yawRate: 0, ...partial }
}

/** The set of held control inputs, resolved from the input-intent layer by
 * the game before it reaches this pure module. */
export interface DockingInputs {
  portAhead: boolean
  portAstern: boolean
  stbdAhead: boolean
  stbdAstern: boolean
  bowLeft: boolean
  bowRight: boolean
  /** Convenience: pull both engine levers back to stop. */
  enginesStop: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Ramp one persistent engine lever toward what's being ordered this tick. */
function rampLever(current: number, ahead: boolean, astern: boolean, stop: boolean, step: number): number {
  if (stop) {
    // ease back toward zero
    if (current > 0) return Math.max(0, current - step)
    if (current < 0) return Math.min(0, current + step)
    return 0
  }
  let next = current
  if (ahead) next += step
  if (astern) next -= step
  return clamp(next, -1, 1)
}

/**
 * Advance the control state from held inputs. Engines are persistent levers
 * (they hold their setting when you release the key, like a real telegraph);
 * the bow thruster is momentary (spring-return to zero). Pure and
 * deterministic — dt is the fixed tick in seconds.
 */
export function advanceControls(
  controls: DockingControls,
  inputs: DockingInputs,
  params: DockingParams,
  dtSeconds: number,
): DockingControls {
  const step = params.leverRampPerSec * dtSeconds
  return {
    portEngine: rampLever(controls.portEngine, inputs.portAhead, inputs.portAstern, inputs.enginesStop, step),
    stbdEngine: rampLever(controls.stbdEngine, inputs.stbdAhead, inputs.stbdAstern, inputs.enginesStop, step),
    bowThruster: (inputs.bowRight ? 1 : 0) - (inputs.bowLeft ? 1 : 0),
  }
}

/**
 * Advance the physics by one fixed tick. Pure: same inputs always give the
 * same output. Semi-implicit Euler (velocities first, then position) — stable
 * here because every time constant is far longer than the tick.
 */
export function stepDocking(
  state: DockingState,
  controls: DockingControls,
  wind: Wind,
  params: DockingParams,
  dtSeconds: number,
): DockingState {
  const { mass, inertia, engineThrust, engineYawArm, bowThrust, bowArm, surgeDrag, swayDrag, yawDrag } = params

  const cos = Math.cos(state.heading)
  const sin = Math.sin(state.heading)

  // Wind resolved from world frame into the body frame (surge, starboard axes).
  const windSurge = wind.fx * cos + wind.fy * sin
  const windSway = wind.fx * sin - wind.fy * cos

  const portF = controls.portEngine * engineThrust
  const stbdF = controls.stbdEngine * engineThrust
  const bowF = controls.bowThruster * bowThrust

  // Body-frame forces and yaw moment, including linear hydrodynamic damping.
  const surgeForce = portF + stbdF + windSurge - surgeDrag * state.surge
  const swayForce = bowF + windSway - swayDrag * state.sway
  // Differential thrust yaws the ship; the bow thruster adds its own moment.
  const yawMoment =
    engineYawArm * (portF - stbdF) + bowArm * bowF - yawDrag * state.yawRate

  // Integrate velocities, then heading, then world position (semi-implicit).
  const surge = state.surge + (surgeForce / mass) * dtSeconds
  const sway = state.sway + (swayForce / mass) * dtSeconds
  const yawRate = state.yawRate + (yawMoment / inertia) * dtSeconds
  const heading = state.heading + yawRate * dtSeconds

  // Body velocity -> world velocity (surge along heading, sway to starboard).
  const vx = surge * cos + sway * sin
  const vy = surge * sin - sway * cos

  return {
    x: state.x + vx * dtSeconds,
    y: state.y + vy * dtSeconds,
    heading,
    surge,
    sway,
    yawRate,
  }
}

/** World-frame speed over ground, m/s — handy for berthing checks and UI. */
export function speedOverGround(state: DockingState): number {
  return Math.hypot(state.surge, state.sway)
}
