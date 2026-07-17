import type { JSX } from 'react'
import { LIVERY as C } from './palette'
import type { ShipDesign } from './types'

/** Top-down deck plan, metre coordinates, bow pointing left.
 * Same fixed-width viewBox as the side view so scales match. */

const VB_W = 140
const VB_H = 26

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function ShipTopView({
  design,
  background = true,
}: {
  design: ShipDesign
  /** Draw the sea backdrop behind the hull. True for the builder/gallery;
   * set false when rasterising to a game texture so the margins stay
   * transparent (the game draws its own sea). */
  background?: boolean
}) {
  const d = design
  const L = d.lengthM
  const B = clamp(L * 0.16, 9.5, 18) // beam
  const x0 = (VB_W - L) / 2
  const cy = VB_H / 2
  const X = (x: number) => x0 + x
  const half = B / 2

  const bowLen = d.bow === 'raked' ? L * 0.24 : d.bow === 'flared' ? L * 0.21 : L * 0.18
  const sternHalf = half * 0.88
  const nose = d.bow === 'modern' ? 1.6 : 0.55 // bow tip roundness

  // Hull plan outline, inset by `m` metres (m=0 is the hull edge; m>0 gives
  // the deck surface inside the bulwark rim).
  const outline = (m: number) => {
    const h = half - m
    const sh = sternHalf - m
    const tip = m * 1.4
    const end = L - m
    return [
      `M ${X(tip)} ${cy - nose / 2}`,
      `Q ${X(tip)} ${cy}, ${X(tip)} ${cy + nose / 2}`, // rounded stem
      `C ${X(bowLen * 0.45)} ${cy + h * 0.72}, ${X(bowLen * 0.72)} ${cy + h * 0.97}, ${X(bowLen)} ${cy + h}`,
      `L ${X(L * 0.94)} ${cy + h}`,
      `Q ${X(end)} ${cy + h * 0.98}, ${X(end)} ${cy + sh - 1.2}`,
      `L ${X(end)} ${cy - sh + 1.2}`,
      `Q ${X(end)} ${cy - h * 0.98}, ${X(L * 0.94)} ${cy - h}`,
      `L ${X(bowLen)} ${cy - h}`,
      `C ${X(bowLen * 0.72)} ${cy - h * 0.97}, ${X(bowLen * 0.45)} ${cy - h * 0.72}, ${X(tip)} ${cy - nose / 2}`,
      'Z',
    ].join(' ')
  }
  const hullPath = outline(0)
  const deckPath = outline(0.85)

  const ssStart = clamp(d.superstructure.startFrac, 0.04, 0.6) * L
  const ssEnd = clamp(d.superstructure.endFrac, d.superstructure.startFrac + 0.18, 0.97) * L
  const ssHalf = half * 0.8
  const decks = clamp(Math.round(d.superstructure.decks), 1, 3)
  const insetAft = clamp(L * 0.055, 2.5, 7)

  const parts: JSX.Element[] = []

  // ---- foredeck fittings ----
  parts.push(
    <g key="foredeck" fill={C.mastBuff} opacity={0.9}>
      <circle cx={X(bowLen * 0.42)} cy={cy - B * 0.14} r={0.8} />
      <circle cx={X(bowLen * 0.42)} cy={cy + B * 0.14} r={0.8} />
      <rect x={X(bowLen * 0.62)} y={cy - 1.1} width={2.6} height={2.2} rx={0.3} fill={C.deckGrey} />
    </g>,
  )

  // ---- aft deck (before superstructure so white sits on top where enclosed) ----
  if (d.stern !== 'enclosed') {
    // dark car deck sunk into the green deck, with lane markings
    const laneStart = ssEnd + 0.8
    const laneEnd = L - 2.2
    parts.push(
      <rect
        key="cardeck"
        x={X(laneStart)}
        y={cy - (half - 1.7)}
        width={Math.max(4, laneEnd - laneStart)}
        height={(half - 1.7) * 2}
        rx={0.8}
        fill={C.deckGrey}
      />,
    )
    for (const off of [-B * 0.2, 0, B * 0.2]) {
      parts.push(
        <line
          key={`lane-${off.toFixed(1)}`}
          x1={X(laneStart + 1)}
          y1={cy + off}
          x2={X(laneEnd - 1)}
          y2={cy + off}
          stroke={C.laneMark}
          strokeWidth={0.22}
          strokeDasharray="1.6 1.2"
        />,
      )
    }
  }
  if (d.stern === 'gantry') {
    parts.push(
      <rect key="gantry" x={X(L - 3.2)} y={cy - half * 0.92} width={1.1} height={half * 1.84} rx={0.3} fill={C.deckGrey} />,
    )
  }

  // ---- superstructure footprint ----
  const frontR = d.superstructure.bridge === 'modern' ? ssHalf : 1.6
  parts.push(
    <path
      key="ss"
      d={[
        `M ${X(ssStart + frontR)} ${cy - ssHalf}`,
        `L ${X(ssEnd - 1.2)} ${cy - ssHalf}`,
        `Q ${X(ssEnd)} ${cy - ssHalf}, ${X(ssEnd)} ${cy - ssHalf + 1.2}`,
        `L ${X(ssEnd)} ${cy + ssHalf - 1.2}`,
        `Q ${X(ssEnd)} ${cy + ssHalf}, ${X(ssEnd - 1.2)} ${cy + ssHalf}`,
        `L ${X(ssStart + frontR)} ${cy + ssHalf}`,
        `Q ${X(ssStart)} ${cy + ssHalf}, ${X(ssStart)} ${cy + ssHalf - frontR}`,
        `L ${X(ssStart)} ${cy - ssHalf + frontR}`,
        `Q ${X(ssStart)} ${cy - ssHalf}, ${X(ssStart + frontR)} ${cy - ssHalf}`,
        'Z',
      ].join(' ')}
      fill={C.white}
    />,
  )

  // bridge wings span the full beam just aft of the superstructure front
  parts.push(
    <rect
      key="wings"
      x={X(ssStart + 1)}
      y={cy - half * 0.98}
      width={2.6}
      height={half * 1.96}
      rx={0.5}
      fill={C.white}
      stroke={C.whiteShade}
      strokeWidth={0.18}
    />,
  )

  // observation deck on top of the superstructure — green painted steel
  if (decks > 1) {
    const upStart =
      d.superstructure.upperStartFrac != null
        ? clamp(d.superstructure.upperStartFrac, 0.05, 0.9) * L
        : ssStart + 2.2
    const upEnd =
      d.superstructure.upperEndFrac != null
        ? clamp(d.superstructure.upperEndFrac, 0.1, 0.96) * L
        : ssEnd - insetAft * (decks - 1)
    parts.push(
      <rect
        key="upper"
        x={X(upStart)}
        y={cy - ssHalf + 1.4}
        width={Math.max(4, upEnd - upStart)}
        height={(ssHalf - 1.4) * 2}
        rx={1.1}
        fill={C.deckGreen}
      />,
    )
    // white wheelhouse roof at the fore end of the top deck
    parts.push(
      <rect
        key="wh-roof"
        x={X(ssStart + 2.6)}
        y={cy - ssHalf + 1.9}
        width={clamp(L * 0.09, 6, 11)}
        height={(ssHalf - 1.9) * 2}
        rx={d.superstructure.bridge === 'modern' ? ssHalf - 1.9 : 1}
        fill={C.white}
      />,
    )
  }

  // ---- funnel(s): count 2 is an athwartships pair, side by side across the beam ----
  const funnelX = clamp(d.funnel.posFrac * L, L * 0.12, L * 0.94)
  const fRx = d.funnel.baseWidth / 2 // fore-aft footprint from the side-view base width
  const fRy = fRx * (d.funnel.count >= 2 ? 0.62 : 0.78) // twins are slimmer ovals
  const fYs = d.funnel.count >= 2 ? [cy - fRy - 0.45, cy + fRy + 0.45] : [cy]
  fYs.forEach((fy, i) => {
    const key = `funnel-${i}`
    if (d.funnel.style === 'raked' || d.funnel.style === 'flick') {
      parts.push(
        <g key={key}>
          <rect x={X(funnelX - fRx)} y={fy - fRy} width={fRx * 2} height={fRy * 2} rx={Math.min(fRy * 0.8, 1.3)} fill={C.funnelRed} />
          <rect x={X(funnelX - fRx * 0.55)} y={fy - fRy * 0.55} width={fRx * 1.1} height={fRy * 1.1} rx={Math.min(fRy * 0.45, 0.7)} fill={C.funnelBlack} />
        </g>,
      )
    } else if (d.funnel.style === 'modern') {
      parts.push(
        <g key={key}>
          <rect x={X(funnelX - fRx)} y={fy - fRy} width={fRx * 2} height={fRy * 2} rx={0.8} fill={C.funnelRed} />
          {[-fRx * 0.5, 0, fRx * 0.5].map((off) => (
            <circle key={off} cx={X(funnelX + off)} cy={fy} r={Math.min(0.45, fRy * 0.4)} fill={C.funnelBlack} />
          ))}
        </g>,
      )
    } else {
      parts.push(
        <g key={key}>
          <ellipse cx={X(funnelX)} cy={fy} rx={fRx} ry={fRy} fill={C.funnelRed} />
          <ellipse cx={X(funnelX)} cy={fy} rx={fRx * 0.6} ry={fRy * 0.6} fill={C.funnelBlack} />
        </g>,
      )
    }
  })

  // ---- masts (as deck dots) ----
  if (d.masts.foremast) {
    parts.push(<circle key="foremast" cx={X(ssStart + 3.5)} cy={cy} r={0.45} fill={C.mastBuff} />)
  }
  if (d.masts.mainmast) {
    const mx =
      d.masts.mainmastFrac != null
        ? clamp(d.masts.mainmastFrac, 0.1, 0.95) * L
        : clamp(funnelX + d.funnel.baseWidth / 2 + 2.5, ssStart + 4, ssEnd - 1.5)
    const col = d.masts.mainmastStyle === 'dark-raked' ? '#22262b' : C.mastBuff
    parts.push(<circle key="mainmast" cx={X(mx)} cy={cy} r={0.4} fill={col} />)
  }
  if (d.masts.aftDerrick && (d.masts.derrickFrac != null || d.stern !== 'enclosed')) {
    const mx = d.masts.derrickFrac != null ? clamp(d.masts.derrickFrac, 0.1, 0.95) * L : L * 0.88
    parts.push(<circle key="derrick" cx={X(mx)} cy={cy} r={0.5} fill={C.mastBuff} />)
  }

  // ---- lifeboats port & starboard ----
  const lbCount = clamp(Math.round(d.lifeboats.count), 0, 3)
  if (lbCount > 0) {
    let lx = clamp(d.lifeboats.posFrac * L, ssStart + 2, ssEnd - 6.5 * lbCount)
    for (let i = 0; i < lbCount; i++) {
      for (const side of [-1, 1]) {
        parts.push(
          <rect
            key={`boat-${i}-${side}`}
            x={X(lx)}
            y={cy + side * (ssHalf + 0.4) - 1}
            width={5.5}
            height={2}
            rx={1}
            fill={C.lifeboatOrange}
            stroke={C.lifeboatCanopy}
            strokeWidth={0.25}
          />,
        )
      }
      lx += 6.6
    }
  }

  // ---- stern ramp marking for enclosed sterns ----
  if (d.stern === 'enclosed') {
    parts.push(
      <g key="ramp">
        <rect x={X(L - 4.2)} y={cy - sternHalf * 0.55} width={3.4} height={sternHalf * 1.1} fill={C.deckGreenShade} />
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={X(L - 3.6 + i * 1.1)}
            y1={cy - sternHalf * 0.5}
            x2={X(L - 3.6 + i * 1.1)}
            y2={cy + sternHalf * 0.5}
            stroke={C.deckGrey}
            strokeWidth={0.22}
          />
        ))}
      </g>,
    )
  }

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="ship-view" role="img" aria-label={`Deck plan of ${d.name}`}>
      {background && <rect x={0} y={0} width={VB_W} height={VB_H} fill={C.sea} />}
      {/* black hull rim with green painted deck inside the bulwarks */}
      <path d={hullPath} fill={C.hull} stroke={C.hullShade} strokeWidth={0.3} />
      <path d={deckPath} fill={C.deckGreen} />
      {parts}
    </svg>
  )
}
