import type { JSX } from 'react'
import { LIVERY as C } from './palette'
import type { FunnelStyle } from './types'

/** Side-view funnels — the signature of the fleet, so they get real detail:
 * tapered/raked silhouettes, the black cap that sweeps down the trailing
 * edge (Clansman style), aft-edge shading, exhaust pipes, and a proper
 * stylised lion rampant on the yellow disc. */

/** Stylised red lion rampant, facing the bow (left). Drawn in unit space
 * (y down, extent ~±0.7) from strokes so it stays readable when tiny. */
export function LionRampant({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const s = r * 1.18
  return (
    <g
      transform={`translate(${cx} ${cy}) scale(${s})`}
      stroke={C.lionRed}
      fill="none"
      strokeLinecap="round"
    >
      {/* torso, leaning back in the rampant pose */}
      <path d="M 0.34 0.5 C 0.24 0.26, 0.12 0.04, -0.06 -0.18" strokeWidth={0.3} />
      {/* head, muzzle and ear */}
      <circle cx={-0.14} cy={-0.4} r={0.155} fill={C.lionRed} stroke="none" />
      <path d="M -0.26 -0.46 L -0.42 -0.38 L -0.26 -0.3 Z" fill={C.lionRed} stroke="none" />
      <path d="M -0.08 -0.52 l 0.02 -0.12 l 0.09 0.07 Z" fill={C.lionRed} stroke="none" />
      {/* forelegs raised */}
      <path d="M -0.02 -0.22 C -0.18 -0.3, -0.32 -0.26, -0.44 -0.14" strokeWidth={0.1} />
      <circle cx={-0.44} cy={-0.14} r={0.055} fill={C.lionRed} stroke="none" />
      <path d="M 0.04 -0.04 C -0.12 -0.06, -0.26 0, -0.38 0.1" strokeWidth={0.1} />
      <circle cx={-0.38} cy={0.1} r={0.055} fill={C.lionRed} stroke="none" />
      {/* hind legs */}
      <path d="M 0.26 0.48 C 0.12 0.58, -0.02 0.6, -0.14 0.54" strokeWidth={0.11} />
      <circle cx={-0.14} cy={0.54} r={0.06} fill={C.lionRed} stroke="none" />
      <path d="M 0.36 0.54 C 0.32 0.66, 0.22 0.7, 0.1 0.68" strokeWidth={0.11} />
      <circle cx={0.1} cy={0.68} r={0.06} fill={C.lionRed} stroke="none" />
      {/* tail curling over the back */}
      <path d="M 0.38 0.34 C 0.6 0.16, 0.58 -0.12, 0.42 -0.18 C 0.56 -0.3, 0.7 -0.18, 0.64 0" strokeWidth={0.07} />
      <circle cx={0.64} cy={0} r={0.05} fill={C.lionRed} stroke="none" />
    </g>
  )
}

export function LionDisc({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.discYellow} />
      <LionRampant cx={cx} cy={cy} r={r} />
    </g>
  )
}

interface FunnelProps {
  style: FunnelStyle
  /** funnel centreline, ship-local metres */
  fx: number
  /** deck surface height the funnel stands on (above waterline) */
  h0: number
  /** width at the base, metres */
  baseW: number
  /** width at the top, metres */
  topW: number
  /** height above its deck, metres */
  height: number
  /** map ship-local x to svg x */
  X: (x: number) => number
  /** map height-above-waterline to svg y */
  Y: (h: number) => number
}

/** Rounded-top tapered quad: base wBase at h0, top wTop shifted aft by
 * `shift`, top corners rounded. */
function taperedBody(
  X: (x: number) => number,
  Y: (h: number) => number,
  fx: number,
  h0: number,
  h: number,
  wBase: number,
  wTop: number,
  shift: number,
  rr = 0.4,
): string {
  const blx = fx - wBase / 2
  const brx = fx + wBase / 2
  const tlx = fx - wTop / 2 + shift
  const trx = fx + wTop / 2 + shift
  return [
    `M ${X(blx)} ${Y(h0)}`,
    `L ${X(tlx - (rr * (tlx - blx)) / h)} ${Y(h0 + h - rr)}`,
    `Q ${X(tlx)} ${Y(h0 + h)}, ${X(tlx + rr)} ${Y(h0 + h)}`,
    `L ${X(trx - rr)} ${Y(h0 + h)}`,
    `Q ${X(trx)} ${Y(h0 + h)}, ${X(trx - (rr * (trx - brx)) / h)} ${Y(h0 + h - rr)}`,
    `L ${X(brx)} ${Y(h0)}`,
    'Z',
  ].join(' ')
}

/** Interpolated x of the leading/trailing edge at height t above the base. */
function edgeX(fx: number, wBase: number, wTop: number, shift: number, h: number, t: number, side: 1 | -1) {
  const w = wBase + (wTop - wBase) * (t / h)
  return fx + side * (w / 2) + shift * (t / h)
}

/** Path for the top `capH` metres of a tapered funnel body. */
function capBody(
  X: (x: number) => number,
  Y: (h: number) => number,
  fx: number,
  h0: number,
  h: number,
  wBase: number,
  wTop: number,
  shift: number,
  capH: number,
  rr = 0.4,
): string {
  const tFrac = (h - capH) / h
  const capFx = fx + shift * tFrac
  const capW = wBase + (wTop - wBase) * tFrac
  return taperedBody(X, Y, capFx, h0 + h - capH, capH, capW, wTop, shift * (capH / h), rr)
}

export function FunnelSide({ style, fx, h0, baseW, topW, height, X, Y }: FunnelProps): JSX.Element {
  const el: JSX.Element[] = []
  const h = height
  const wB = baseW
  const wT = topW
  // disc scales with the funnel but never overflows a narrow one
  const discR = Math.max(0.6, Math.min(Math.min(wB, wT) * 0.48, h * 0.32))

  /** aft-edge shading strip from deck up to `topT` metres above the base */
  const shade = (shift: number, topT: number) => (
    <path
      key="shade"
      d={`M ${X(edgeX(fx, wB, wT, shift, h, 0, 1) - 0.45)} ${Y(h0)} L ${X(edgeX(fx, wB, wT, shift, h, topT, 1) - 0.45)} ${Y(h0 + topT)} L ${X(edgeX(fx, wB, wT, shift, h, topT, 1))} ${Y(h0 + topT)} L ${X(edgeX(fx, wB, wT, shift, h, 0, 1))} ${Y(h0)} Z`}
      fill={C.funnelRedShade}
    />
  )

  if (style === 'classic') {
    // gently raked, tapered — Isle of Arran, Isle of Mull, Lochnevis
    const shift = h * 0.1
    const capH = Math.min(Math.max(h * 0.22, 0.9), 1.8)
    const hoodDrop = capH * 1.1
    el.push(
      <path key="body" d={taperedBody(X, Y, fx, h0, h, wB, wT, shift)} fill={C.funnelRed} />,
      shade(shift, h - capH),
      <path key="cap" d={capBody(X, Y, fx, h0, h, wB, wT, shift, capH, 0.4)} fill={C.funnelBlack} />,
      // short sweep down the trailing edge
      <path
        key="hood"
        d={`M ${X(edgeX(fx, wB, wT, shift, h, h - capH, 1))} ${Y(h0 + h - capH)} L ${X(edgeX(fx, wB, wT, shift, h, h - capH - hoodDrop, 1))} ${Y(h0 + h - capH - hoodDrop)} L ${X(edgeX(fx, wB, wT, shift, h, h - capH, 1) - wB * 0.35)} ${Y(h0 + h - capH)} Z`}
        fill={C.funnelBlack}
      />,
      // exhaust pipe just proud of the top
      <rect key="pipe" x={X(fx + shift - 0.4)} y={Y(h0 + h + 0.55)} width={0.8} height={0.55} fill={C.funnelBlack} />,
      <LionDisc key="disc" cx={X(fx + shift * 0.4 - 0.1)} cy={Y(h0 + h * 0.42)} r={discR} />,
    )
  } else if (style === 'drum') {
    // plain band cap, no hood — simple workhorse funnel
    const shift = h * 0.05
    const capH = Math.min(Math.max(h * 0.15, 0.6), 1.1)
    el.push(
      <path key="body" d={taperedBody(X, Y, fx, h0, h, wB, wT, shift, 0.6)} fill={C.funnelRed} />,
      shade(shift, h - capH),
      <path key="cap" d={capBody(X, Y, fx, h0, h, wB, wT, shift, capH, 0.5)} fill={C.funnelBlack} />,
      <LionDisc key="disc" cx={X(fx)} cy={Y(h0 + h * 0.44)} r={discR} />,
    )
  } else if (style === 'raked') {
    // strongly swept, black hood over the whole top-aft — Clansman, Hebrides
    const shift = h * 0.32
    const capH = Math.min(Math.max(h * 0.2, 1), 1.6)
    const hoodDrop = Math.min(h * 0.38, h - capH - 1)
    el.push(
      <path key="body" d={taperedBody(X, Y, fx, h0, h, wB, wT, shift, 0.5)} fill={C.funnelRed} />,
      shade(shift, h - capH - hoodDrop),
      <path key="cap" d={capBody(X, Y, fx, h0, h, wB, wT, shift, capH, 0.5)} fill={C.funnelBlack} />,
      // hood sweeping down the trailing edge
      <path
        key="hood"
        d={[
          `M ${X(edgeX(fx, wB, wT, shift, h, h - capH, 1) - wB * 0.55)} ${Y(h0 + h - capH)}`,
          `L ${X(edgeX(fx, wB, wT, shift, h, h - capH, 1))} ${Y(h0 + h - capH)}`,
          `L ${X(edgeX(fx, wB, wT, shift, h, h - capH - hoodDrop, 1))} ${Y(h0 + h - capH - hoodDrop)}`,
          'Z',
        ].join(' ')}
        fill={C.funnelBlack}
      />,
      <LionDisc key="disc" cx={X(fx + shift * 0.3)} cy={Y(h0 + h * 0.4)} r={discR} />,
    )
  } else if (style === 'flick') {
    // Caledonian Isles: strong taper, thin cap, black fin kicked up and aft
    const shift = h * 0.18
    const capH = 0.7
    const finRise = h * 0.12
    const finDrop = Math.min(h * 0.26, h - capH - 1)
    const topAft = edgeX(fx, wB, wT, shift, h, h, 1)
    el.push(
      <path key="body" d={taperedBody(X, Y, fx, h0, h, wB, wT, shift, 0.5)} fill={C.funnelRed} />,
      shade(shift, h - capH - finDrop),
      <path key="cap" d={capBody(X, Y, fx, h0, h, wB, wT, shift, capH, 0.4)} fill={C.funnelBlack} />,
      // upswept fin off the top-aft corner
      <path
        key="fin"
        d={[
          `M ${X(topAft - wT * 0.45)} ${Y(h0 + h - capH)}`,
          `L ${X(topAft + 0.9)} ${Y(h0 + h + finRise)}`,
          `L ${X(edgeX(fx, wB, wT, shift, h, h - capH - finDrop, 1))} ${Y(h0 + h - capH - finDrop)}`,
          'Z',
        ].join(' ')}
        fill={C.funnelBlack}
      />,
      <LionDisc key="disc" cx={X(fx + shift * 0.2 - wT * 0.12)} cy={Y(h0 + h * 0.5)} r={discR} />,
    )
  } else {
    // modern (Loch Seaforth): raked leading edge, cluster of exhaust pipes
    const lean = Math.min(1.2, wB * 0.3)
    el.push(
      <path
        key="body"
        d={`M ${X(fx - wB / 2)} ${Y(h0)} L ${X(fx - wB / 2 + lean)} ${Y(h0 + h - 0.4)} Q ${X(fx - wB / 2 + lean + 0.1)} ${Y(h0 + h)}, ${X(fx - wB / 2 + lean + 0.7)} ${Y(h0 + h)} L ${X(fx + wT / 2 + (wB - wT) / 2)} ${Y(h0 + h)} L ${X(fx + wB / 2)} ${Y(h0)} Z`}
        fill={C.funnelRed}
      />,
      <rect key="shade" x={X(fx + wB / 2 - 0.45)} y={Y(h0 + h)} width={0.45} height={h} fill={C.funnelRedShade} />,
      <rect key="cap" x={X(fx - wB / 2 + lean)} y={Y(h0 + h)} width={wB - lean} height={0.55} fill={C.funnelBlack} />,
    )
    const pipeHs = [h * 0.42, h * 0.55, h * 0.48]
    pipeHs.forEach((ph, p) => {
      el.push(
        <rect
          key={`pipe-${p}`}
          x={X(fx - 1.1 + p * 0.95)}
          y={Y(h0 + h + ph)}
          width={0.6}
          height={ph}
          fill={C.funnelBlack}
        />,
      )
    })
    el.push(<LionDisc key="disc" cx={X(fx + 0.3)} cy={Y(h0 + h * 0.52)} r={discR} />)
  }

  return <g>{el}</g>
}
