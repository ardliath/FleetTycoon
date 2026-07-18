import Phaser from 'phaser'
import { HERO_SHIPS } from '../../ship/presets'
import { shipTopDataUri, SHIP_TEXTURE_VIEWBOX } from '../shipTexture'
import { createTickAccumulator, TICK_MS } from '../../sim/tick'
import { HeldIntents } from '../../input/intents'
import { bindKeyboardIntents, readDockingInputs } from '../../input/keyboardIntents'
import { EventBus } from '../EventBus'
import {
  DEFAULT_DOCKING_PARAMS,
  advanceControls,
  initialDockingState,
  speedOverGround,
  stepDocking,
  type DockingControls,
  type DockingState,
  type Wind,
} from '../../sim/docking'

/**
 * Phase 1 docking minigame. Bring the Isle of Arran alongside the quay by
 * hand — twin-screw differential thrust + bow thruster, against a steady
 * wind, with the ship carrying real momentum.
 *
 * The sim (src/sim/docking) is the single source of truth for ship motion;
 * this scene only reads intents, advances the sim on the fixed tick, draws
 * the result (interpolated between ticks), and judges berth/contact. All the
 * world maths is in metres, y-up; screen conversion (y-down) happens at the
 * draw boundary.
 */

// --- harbour layout, world metres (y up) ---
const WORLD = { w: 320, h: 220 }
const QUAY = { x0: 40, x1: 280, ySouth: 158, yNorth: 200 } // solid quay across the top
const BERTH = { x0: 120, x1: 205, y0: 146, y1: 158 } // target zone just off the quay
const START: Partial<DockingState> = { x: 62, y: 74, heading: 0.42 }
const WIND: Wind = { fx: 2, fy: -3.5 } // gentle offshore breeze — work her onto the berth

// --- berthing tolerances (tuned by feel) ---
const BERTH_SPEED = 0.45 // m/s: must be nearly stopped
const BERTH_HEADING_TOL = Phaser.Math.DEG_TO_RAD * 32 // within this of parallel to quay
const HARD_CONTACT_SPEED = 1.3 // m/s into the quay = damage

const SHIP = HERO_SHIPS[0] // Isle of Arran
const SHIP_TEX = 'ship-arran-top'

type Outcome = 'sailing' | 'berthed' | 'damaged' | 'adrift'

/** Emitted on EventBus when a docking attempt concludes — the Route
 * overview (Phase 2) listens for this to map the result onto a
 * SailingOutcome; the standalone Docking tab (Phase 1 free-play) ignores
 * it, since nothing there listens. `impactSpeed` (m/s) is only meaningful
 * for 'damaged' and is what Phase 2's outcome mapping tiers severity on. */
export interface DockingResult {
  outcome: Exclude<Outcome, 'sailing'>
  impactSpeed?: number
}

export class DockingScene extends Phaser.Scene {
  private accumulator = createTickAccumulator(TICK_MS)
  private intents = new HeldIntents()
  private unbindKeys?: () => void

  private state: DockingState = initialDockingState(START)
  private prevState: DockingState = this.state
  private controls: DockingControls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }
  private outcome: Outcome = 'sailing'

  // view transform (metres -> screen px), recomputed on resize
  private ppm = 1
  private ox = 0
  private oy = 0

  private harbour!: Phaser.GameObjects.Graphics
  private ship?: Phaser.GameObjects.Image
  private hud!: Phaser.GameObjects.Graphics
  private hudText!: Phaser.GameObjects.Text
  private banner!: Phaser.GameObjects.Text

  constructor() {
    super('DockingScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#25506e') // sea

    this.harbour = this.add.graphics()
    // The in-game ship IS the builder's render, rasterised to a texture.
    // addBase64 just loads the data URI as an Image (SVG works); it's async,
    // so we make the sprite once the texture is ready.
    if (this.textures.exists(SHIP_TEX)) {
      this.createShipSprite()
    } else {
      this.textures.once(`addtexture-${SHIP_TEX}`, () => this.createShipSprite())
      this.textures.addBase64(SHIP_TEX, shipTopDataUri(SHIP))
    }
    this.hud = this.add.graphics()
    this.hudText = this.add
      .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#eaf2f8' })
      .setDepth(10)
    this.banner = this.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20)

    this.computeView()
    this.drawHarbour()

    this.unbindKeys = bindKeyboardIntents(this.intents)
    this.input.keyboard?.on('keydown-R', () => this.reset())

    this.scale.on('resize', this.onResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unbindKeys?.()
      this.scale.off('resize', this.onResize, this)
    })
  }

  private createShipSprite() {
    this.ship = this.add.image(0, 0, SHIP_TEX).setOrigin(0.5, 0.5).setDepth(5)
  }

  private onResize() {
    this.computeView()
    this.drawHarbour()
  }

  /** Fit the world rectangle into the current viewport, centred. */
  private computeView() {
    const vw = this.scale.width
    const vh = this.scale.height
    const pad = 24
    this.ppm = Math.min((vw - pad * 2) / WORLD.w, (vh - pad * 2) / WORLD.h)
    this.ox = (vw - WORLD.w * this.ppm) / 2
    this.oy = (vh - WORLD.h * this.ppm) / 2
  }

  private sx(x: number): number {
    return this.ox + x * this.ppm
  }
  /** world y is up; screen y is down. */
  private sy(y: number): number {
    return this.oy + (WORLD.h - y) * this.ppm
  }

  private drawHarbour() {
    const g = this.harbour
    g.clear()

    // sea (world rect, slightly lighter than camera bg for a subtle frame)
    g.fillStyle(0x2b5a7c, 1)
    g.fillRect(this.sx(0), this.sy(WORLD.h), WORLD.w * this.ppm, WORLD.h * this.ppm)

    // berth target zone
    g.fillStyle(0x3ba55d, 0.18)
    g.lineStyle(1.5, 0x5fe08a, 0.7)
    const bx = this.sx(BERTH.x0)
    const by = this.sy(BERTH.y1)
    g.fillRect(bx, by, (BERTH.x1 - BERTH.x0) * this.ppm, (BERTH.y1 - BERTH.y0) * this.ppm)
    g.strokeRect(bx, by, (BERTH.x1 - BERTH.x0) * this.ppm, (BERTH.y1 - BERTH.y0) * this.ppm)

    // quay (solid stone)
    g.fillStyle(0x6b7178, 1)
    g.fillRect(
      this.sx(QUAY.x0),
      this.sy(QUAY.yNorth),
      (QUAY.x1 - QUAY.x0) * this.ppm,
      (QUAY.yNorth - QUAY.ySouth) * this.ppm,
    )
    g.fillStyle(0x4a4f54, 1) // fender strip along the quay edge
    g.fillRect(this.sx(QUAY.x0), this.sy(QUAY.ySouth) - 2, (QUAY.x1 - QUAY.x0) * this.ppm, 3)

    // channel buoys marking the approach (green to port, red to starboard,
    // in the direction of the berth — decoration + readability for now)
    this.drawBuoy(g, 95, 55, 0x22aa44)
    this.drawBuoy(g, 150, 60, 0xcc2222)
    this.drawBuoy(g, 120, 108, 0x22aa44)
    this.drawBuoy(g, 178, 112, 0xcc2222)
  }

  private drawBuoy(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    g.fillStyle(color, 1)
    g.fillCircle(this.sx(x), this.sy(y), Math.max(3, 1.6 * this.ppm))
  }

  update(_time: number, deltaMs: number) {
    if (this.outcome === 'sailing') {
      const dt = TICK_MS / 1000
      const inputs = readDockingInputs(this.intents)
      const ticks = this.accumulator.consumeTicks(deltaMs)
      for (let i = 0; i < ticks; i++) {
        this.prevState = this.state
        this.controls = advanceControls(this.controls, inputs, DEFAULT_DOCKING_PARAMS, dt)
        this.state = stepDocking(this.state, this.controls, WIND, DEFAULT_DOCKING_PARAMS, dt)
      }
      this.judge()
    }

    this.drawShip()
    this.drawHud()
  }

  /** Interpolate between the last two sim states for smooth rendering. */
  private drawShip() {
    if (!this.ship) return // texture still loading
    const a = this.accumulator.alpha
    const x = Phaser.Math.Linear(this.prevState.x, this.state.x, a)
    const y = Phaser.Math.Linear(this.prevState.y, this.state.y, a)
    const heading = Phaser.Math.Linear(this.prevState.heading, this.state.heading, a)

    this.ship.setPosition(this.sx(x), this.sy(y))
    // texture bow points -x; sim heading 0 = +x, CCW; screen y is flipped.
    this.ship.setRotation(-(heading + Math.PI))
    this.ship.setDisplaySize(
      SHIP_TEXTURE_VIEWBOX.widthM * this.ppm,
      SHIP_TEXTURE_VIEWBOX.heightM * this.ppm,
    )
  }

  /** Sample hull extremities in world coords (bow, stern, port/stbd beam). */
  private hullPoints(): Array<{ x: number; y: number }> {
    const halfL = SHIP.lengthM / 2
    const halfB = Math.min(Math.max(SHIP.lengthM * 0.16, 9.5), 18) / 2
    const c = Math.cos(this.state.heading)
    const s = Math.sin(this.state.heading)
    const pts: Array<{ x: number; y: number }> = []
    for (const along of [halfL, 0, -halfL]) {
      for (const across of [halfB, -halfB]) {
        pts.push({
          x: this.state.x + along * c + across * s,
          y: this.state.y + along * s - across * c,
        })
      }
    }
    return pts
  }

  private judge() {
    // out of bounds -> adrift
    if (
      this.state.x < -10 ||
      this.state.x > WORLD.w + 10 ||
      this.state.y < -10 ||
      this.state.y > WORLD.h + 10
    ) {
      return this.finish('adrift')
    }

    const speed = speedOverGround(this.state)
    const touchingQuay = this.hullPoints().some(
      (p) => p.y >= QUAY.ySouth && p.x >= QUAY.x0 && p.x <= QUAY.x1,
    )
    if (touchingQuay && speed > HARD_CONTACT_SPEED) {
      return this.finish('damaged', speed)
    }

    // parallel to the quay = heading near 0 or pi
    const h = Phaser.Math.Angle.Wrap(this.state.heading)
    const parallel = Math.min(Math.abs(h), Math.abs(Math.abs(h) - Math.PI)) < BERTH_HEADING_TOL
    const inBerth =
      this.state.x > BERTH.x0 &&
      this.state.x < BERTH.x1 &&
      this.state.y > BERTH.y0 &&
      this.state.y < BERTH.y1
    if (inBerth && parallel && speed < BERTH_SPEED) {
      return this.finish('berthed')
    }
  }

  private finish(outcome: Exclude<Outcome, 'sailing'>, impactSpeed?: number) {
    this.outcome = outcome
    const msg =
      outcome === 'berthed'
        ? 'Alongside!\nNicely done.'
        : outcome === 'damaged'
          ? 'Too hard!\nYou would have damaged the ship.'
          : 'Adrift!\nLost her out of the harbour.'
    this.banner.setText(`${msg}\n\nPress R to try again`)
    EventBus.emit('docking-result', { outcome, impactSpeed } satisfies DockingResult)
  }

  private reset() {
    this.state = initialDockingState(START)
    this.prevState = this.state
    this.controls = { portEngine: 0, stbdEngine: 0, bowThruster: 0 }
    this.outcome = 'sailing'
    this.accumulator = createTickAccumulator(TICK_MS)
    this.intents.clear()
    this.banner.setText('')
  }

  private drawHud() {
    // banner centred
    this.banner.setPosition(this.scale.width / 2, this.scale.height / 2)

    const g = this.hud
    g.clear()

    // engine levers (two vertical gauges bottom-left)
    const baseX = 24
    const baseY = this.scale.height - 24
    const gaugeH = 90
    const gaugeW = 16
    this.drawLever(g, baseX, baseY, gaugeW, gaugeH, this.controls.portEngine, 'P')
    this.drawLever(g, baseX + 34, baseY, gaugeW, gaugeH, this.controls.stbdEngine, 'S')

    // bow thruster indicator
    const bt = this.controls.bowThruster
    if (bt !== 0) {
      g.fillStyle(0xffd24a, 1)
      const cx = baseX + 90
      const cy = baseY - gaugeH / 2
      g.fillTriangle(cx, cy - 8, cx, cy + 8, cx + Math.sign(bt) * 16, cy)
    }

    // wind arrow (top-right)
    const wx = this.scale.width - 60
    const wy = 50
    const wmag = Math.hypot(WIND.fx, WIND.fy)
    const wang = Math.atan2(-WIND.fy, WIND.fx) // screen angle (y flipped)
    g.lineStyle(3, 0x9fd0ff, 1)
    const len = 22
    const ex = wx + Math.cos(wang) * len
    const ey = wy + Math.sin(wang) * len
    g.lineBetween(wx - Math.cos(wang) * len, wy - Math.sin(wang) * len, ex, ey)
    g.fillStyle(0x9fd0ff, 1)
    g.fillTriangle(
      ex,
      ey,
      ex - Math.cos(wang - 0.4) * 8,
      ey - Math.sin(wang - 0.4) * 8,
      ex - Math.cos(wang + 0.4) * 8,
      ey - Math.sin(wang + 0.4) * 8,
    )

    const speed = speedOverGround(this.state)
    this.hudText.setPosition(this.scale.width - 150, 66)
    this.hudText.setText(
      [
        `Wind  ${wmag.toFixed(0)}`,
        `Speed ${speed.toFixed(2)} m/s`,
        '',
        'Q/A port  E/D stbd',
        'Z/C bow thruster',
        'X stop  R reset',
      ].join('\n'),
    )
  }

  private drawLever(
    g: Phaser.GameObjects.Graphics,
    x: number,
    yBottom: number,
    w: number,
    h: number,
    value: number,
    label: string,
  ) {
    const top = yBottom - h
    const mid = yBottom - h / 2
    // track
    g.fillStyle(0x14313f, 0.85)
    g.fillRect(x, top, w, h)
    g.lineStyle(1, 0x3d6377, 1)
    g.lineBetween(x, mid, x + w, mid) // stop line
    // fill from centre toward the ordered setting (green ahead, red astern)
    const fillH = (Math.abs(value) * h) / 2
    if (value >= 0) {
      g.fillStyle(0x3ba55d, 1)
      g.fillRect(x, mid - fillH, w, fillH)
    } else {
      g.fillStyle(0xc0503f, 1)
      g.fillRect(x, mid, w, fillH)
    }
    void label // labels drawn via hudText would need per-lever text; keep gauges clean for now
  }
}
