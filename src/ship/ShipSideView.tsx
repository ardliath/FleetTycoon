import type { JSX } from 'react'
import { LIVERY as C } from './palette'
import { FunnelSide } from './Funnel'
import type { ShipDesign } from './types'

/** Side elevation, drawn in metre coordinates inside a fixed-width viewBox so
 * ships of different lengths render at the same scale. Bow points left. */

const VB_W = 140 // metres of world shown horizontally
const AIR = 26 // metres above the waterline
const SEA = 3.5 // metres of sea shown below the waterline
const VB_H = AIR + SEA
const DECK_H = 2.6 // height of one superstructure deck
const BRIDGE_H = 2.8

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface Geo {
  L: number
  F: number // freeboard: deck height above waterline
  x0: number // world x of the bow tip
  rake: number // horizontal run of the stem from deck to waterline
  transomRake: number
  ssStart: number // superstructure fore end, ship-local metres
  ssEnd: number
  topDeckH: number // height of the top superstructure deck surface
  bridgeX: number
  bridgeLen: number
}

function geometry(d: ShipDesign): Geo {
  const L = d.lengthM
  const F = 3.4 + L * 0.018
  const rake = d.bow === 'modern' ? F * 0.55 : F * 0.95
  const ssStart = clamp(d.superstructure.startFrac, 0.04, 0.6) * L
  const ssEnd = clamp(d.superstructure.endFrac, d.superstructure.startFrac + 0.18, 0.97) * L
  const bridgeLen = clamp(L * 0.09, 6, 11) * (d.superstructure.bridge === 'modern' ? 1.35 : 1)
  return {
    L,
    F,
    x0: (VB_W - L) / 2,
    rake,
    transomRake: F * 0.22,
    ssStart,
    ssEnd,
    topDeckH: F + d.superstructure.decks * DECK_H,
    bridgeX: ssStart + 0.6,
    bridgeLen,
  }
}

/** Extra deck height from sheer at ship-local x (rises toward bow/stern). */
function sheer(d: ShipDesign, g: Geo, x: number): number {
  const bowRise = d.bow === 'modern' ? 2.4 : g.F * 0.18
  const sternRise = g.F * 0.06
  const bowZone = d.bow === 'modern' ? g.L * 0.24 : g.L * 0.16
  const sternZone = g.L * 0.1
  let s = 0
  if (x < bowZone) s += bowRise * ((bowZone - x) / bowZone) ** 2
  if (x > g.L - sternZone) s += sternRise * ((x - (g.L - sternZone)) / sternZone) ** 2
  return s
}

/** Deck height including the bulwark step-down over an open aft working deck. */
function deckAt(d: ShipDesign, g: Geo, x: number): number {
  let h = g.F + sheer(d, g, x)
  if (d.stern !== 'enclosed') {
    const stepX = g.ssEnd + 1.5
    if (x > stepX) {
      const t = Math.min(1, (x - stepX) / 3)
      h -= 1.25 * t * t * (3 - 2 * t) // smoothstep down to the open deck
    }
  }
  return h
}

export function ShipSideView({ design }: { design: ShipDesign }) {
  const d = design
  const g = geometry(d)
  // world coords: X(x) maps ship-local metres, Y(h) maps height-above-waterline
  const X = (x: number) => g.x0 + x
  const Y = (h: number) => AIR - h

  const hullPath = (drop: number) => {
    // Outline from bow tip at deck level, down the stem, along the waterline
    // (dropped by `drop` for the boot stripe), up the transom, back along the
    // sheered deck line to the bow.
    const deckBow = g.F + sheer(d, g, 0)
    const stemCtrl =
      d.bow === 'flared'
        ? `C ${X(g.rake * 0.15)} ${Y(deckBow * 0.55)}, ${X(g.rake * 0.55)} ${Y(deckBow * 0.25)},`
        : d.bow === 'modern'
          ? `C ${X(g.rake * 0.3)} ${Y(deckBow * 0.5)}, ${X(g.rake * 0.6)} ${Y(deckBow * 0.18)},`
          : `L` // raked: straight stem
    const deckPts: string[] = []
    for (let x = g.L; x >= 0; x -= g.L / 48) {
      deckPts.push(`L ${X(x)} ${Y(deckAt(d, g, x))}`)
    }
    return [
      `M ${X(0)} ${Y(deckBow)}`,
      `${stemCtrl} ${X(g.rake)} ${Y(-drop)}`,
      `L ${X(g.L - g.transomRake)} ${Y(-drop)}`,
      `L ${X(g.L)} ${Y(deckAt(d, g, g.L))}`,
      deckPts.join(' '),
      'Z',
    ].join(' ')
  }

  const parts: JSX.Element[] = []

  // ---- superstructure decks ----
  const decks = clamp(Math.round(d.superstructure.decks), 1, 3)
  const insetAft = clamp(g.L * 0.055, 2.5, 7)
  const deckBlocks: { xs: number; xe: number; h0: number; h1: number }[] = []
  for (let i = 0; i < decks; i++) {
    let xs = g.ssStart + i * 1.2
    let xe = g.ssEnd - i * insetAft
    if (i === decks - 1 && decks >= 2) {
      // optional explicit extent for the top band (e.g. set back aft of the bridge)
      const { upperStartFrac, upperEndFrac } = d.superstructure
      if (upperStartFrac != null) xs = clamp(upperStartFrac, 0.05, 0.9) * g.L
      if (upperEndFrac != null) xe = clamp(upperEndFrac, 0.1, 0.96) * g.L
    }
    deckBlocks.push({ xs, xe, h0: g.F + i * DECK_H, h1: g.F + (i + 1) * DECK_H })
  }
  for (const b of deckBlocks) {
    parts.push(
      <rect
        key={`deck-${b.h0}`}
        x={X(b.xs)}
        y={Y(b.h1)}
        width={b.xe - b.xs}
        height={b.h1 - b.h0}
        fill={C.white}
      />,
      <line
        key={`deckline-${b.h0}`}
        x1={X(b.xs)}
        y1={Y(b.h0)}
        x2={X(b.xe)}
        y2={Y(b.h0)}
        stroke={C.deckShadow}
        strokeWidth={0.28}
      />,
    )
  }

  // ---- windows on each deck ----
  const winStyle = d.superstructure.windows
  deckBlocks.forEach((b, i) => {
    const style = winStyle === 'mixed' ? (i === 0 ? 'porthole' : 'rect') : winStyle
    const cy = (b.h0 + b.h1) / 2
    if (style === 'porthole') {
      for (let x = b.xs + 1.4; x < b.xe - 1.2; x += 1.9) {
        parts.push(
          <circle key={`w${i}-${x.toFixed(1)}`} cx={X(x)} cy={Y(cy)} r={0.36} fill={C.window} />,
        )
      }
    } else {
      for (let x = b.xs + 1.2; x < b.xe - 1.8; x += 1.75) {
        parts.push(
          <rect
            key={`w${i}-${x.toFixed(1)}`}
            x={X(x)}
            y={Y(cy + 0.45)}
            width={1.15}
            height={0.9}
            rx={0.14}
            fill={C.window}
          />,
        )
      }
    }
  })

  // ---- wheelhouse / bridge ----
  // When the top band is set well aft, the bridge stands alone in the gap at
  // the top-band level (classic 80s layout); otherwise it caps the stack.
  const topBlock = deckBlocks[deckBlocks.length - 1]
  const bridgeInGap = decks >= 2 && topBlock.xs > g.ssStart + 4
  const bh0 = bridgeInGap ? topBlock.h0 : g.topDeckH
  const bh1 = bh0 + BRIDGE_H
  const bx = g.bridgeX
  const bl = g.bridgeLen
  if (d.superstructure.bridge === 'modern') {
    parts.push(
      <path
        key="bridge"
        d={`M ${X(bx + 1.6)} ${Y(bh0)} L ${X(bx + 0.3)} ${Y(bh1 - 0.9)} Q ${X(bx + 0.4)} ${Y(bh1)}, ${X(bx + 1.9)} ${Y(bh1)} L ${X(bx + bl)} ${Y(bh1)} L ${X(bx + bl)} ${Y(bh0)} Z`}
        fill={C.white}
      />,
      <path
        key="bridge-glass"
        d={`M ${X(bx + 1.2)} ${Y(bh0 + 0.5)} L ${X(bx + 0.75)} ${Y(bh1 - 1.0)} Q ${X(bx + 0.9)} ${Y(bh1 - 0.35)}, ${X(bx + 2.1)} ${Y(bh1 - 0.35)} L ${X(bx + bl - 0.5)} ${Y(bh1 - 0.35)} L ${X(bx + bl - 0.5)} ${Y(bh1 - 1.55)} L ${X(bx + 1.6)} ${Y(bh1 - 1.55)} Z`}
        fill={C.glazing}
      />,
    )
  } else {
    parts.push(
      // bridge wings read as a thin slab at wheelhouse floor level
      <rect
        key="bridge-wings"
        x={X(bx - 1.1)}
        y={Y(bh0 + 0.42)}
        width={bl + 2.2}
        height={0.42}
        fill={C.white}
      />,
      <rect key="bridge" x={X(bx)} y={Y(bh1)} width={bl} height={BRIDGE_H} fill={C.white} />,
      <rect
        key="bridge-glass"
        x={X(bx + 0.35)}
        y={Y(bh1 - 0.35)}
        width={bl - 0.7}
        height={1.35}
        rx={0.18}
        fill={C.glazing}
      />,
    )
  }

  // ---- funnel ----
  // Deck surface height at x: top of the highest superstructure block
  // covering x, else the (possibly stepped-down) weather deck.
  const surfaceAt = (x: number) => {
    let h = deckAt(d, g, x)
    for (const b of deckBlocks) if (x >= b.xs && x <= b.xe) h = Math.max(h, b.h1)
    return h
  }
  // An athwartships pair (count 2) lines up into a single silhouette from
  // the side, so one drawing serves both.
  const funnelX = clamp(d.funnel.posFrac * g.L, g.L * 0.12, g.L * 0.94)
  const funnelBase = Math.max(g.F, surfaceAt(funnelX) - (d.funnel.baseDeckDrop ?? 0) * DECK_H)
  parts.push(
    <FunnelSide
      key="funnel"
      style={d.funnel.style}
      fx={funnelX}
      h0={funnelBase}
      baseW={d.funnel.baseWidth}
      topW={d.funnel.topWidth}
      height={d.funnel.height}
      X={X}
      Y={Y}
    />,
  )

  // ---- masts ----
  if (d.masts.foremast) {
    const mx = bx + bl * 0.35
    parts.push(
      <g key="foremast" stroke={C.mastBuff} strokeWidth={0.32} strokeLinecap="round">
        <line x1={X(mx)} y1={Y(bh1)} x2={X(mx)} y2={Y(bh1 + 6.2)} />
        <line x1={X(mx - 1.6)} y1={Y(bh1 + 4.4)} x2={X(mx + 1.6)} y2={Y(bh1 + 4.4)} />
        <line x1={X(mx)} y1={Y(bh1 + 6.2)} x2={X(mx)} y2={Y(bh1 + 7.6)} strokeWidth={0.18} />
      </g>,
    )
  }
  // radar is part of the bridge kit
  parts.push(
    <g key="radar">
      <rect x={X(bx + bl * 0.68)} y={Y(bh1 + 0.9)} width={0.28} height={0.9} fill={C.deckGrey} />
      <rect x={X(bx + bl * 0.68 - 0.65)} y={Y(bh1 + 1.25)} width={1.6} height={0.34} rx={0.17} fill={C.deckGrey} />
    </g>,
  )
  // open boat deck railings across the gap between bridge and upper deckhouse
  if (bridgeInGap) {
    const rx0 = bx + bl + 0.4
    const rx1 = topBlock.xs - 0.4
    if (rx1 > rx0 + 1.5) {
      const railTop = topBlock.h0 + 1.05
      const posts: JSX.Element[] = []
      for (let x = rx0; x <= rx1; x += 1.6) {
        posts.push(
          <line key={`p-${x.toFixed(1)}`} x1={X(x)} y1={Y(topBlock.h0)} x2={X(x)} y2={Y(railTop)} />,
        )
      }
      parts.push(
        <g key="gap-rails" stroke={C.white} strokeWidth={0.13}>
          <line x1={X(rx0)} y1={Y(railTop)} x2={X(rx1)} y2={Y(railTop)} />
          {posts}
        </g>,
      )
    }
  }
  if (d.masts.mainmast) {
    const mx =
      d.masts.mainmastFrac != null
        ? clamp(d.masts.mainmastFrac, 0.1, 0.95) * g.L
        : clamp(funnelX + d.funnel.baseWidth / 2 + 2.5, g.ssStart + 4, g.ssEnd - 1.5)
    const base = surfaceAt(mx)
    const dark = d.masts.mainmastStyle === 'dark-raked'
    const col = dark ? '#22262b' : C.mastBuff
    const mh = dark ? 6.8 : 5.6
    const lean = dark ? 1.7 : 0 // dark masts rake aft
    parts.push(
      <g key="mainmast" stroke={col} strokeWidth={dark ? 0.34 : 0.28} strokeLinecap="round">
        <line x1={X(mx)} y1={Y(base)} x2={X(mx + lean)} y2={Y(base + mh)} />
        <line
          x1={X(mx + (lean * 4.2) / mh - 1.2)}
          y1={Y(base + 4.2)}
          x2={X(mx + (lean * 4.2) / mh + 1.2)}
          y2={Y(base + 4.2)}
        />
      </g>,
    )
  }
  if (d.masts.aftDerrick && (d.masts.derrickFrac != null || d.stern !== 'enclosed')) {
    // heavy-lift derrick: explicit position, else just aft of the superstructure
    const mx =
      d.masts.derrickFrac != null
        ? clamp(d.masts.derrickFrac, 0.1, 0.95) * g.L
        : Math.min(g.ssEnd + 2.5, g.L - 8)
    const base = surfaceAt(mx)
    parts.push(
      <g key="derrick" stroke={C.mastBuff} strokeLinecap="round">
        <line x1={X(mx)} y1={Y(base)} x2={X(mx)} y2={Y(base + 7)} strokeWidth={0.45} />
        <line x1={X(mx)} y1={Y(base + 6.2)} x2={X(mx + 6.5)} y2={Y(base + 2.4)} strokeWidth={0.28} />
      </g>,
    )
  }

  // ---- stern gantry ----
  if (d.stern === 'gantry') {
    const px = g.L - 2.2
    const base = deckAt(d, g, px)
    parts.push(
      <g key="gantry" fill={C.deckGrey}>
        <rect x={X(px)} y={Y(base + 4.6)} width={0.6} height={4.6} />
        <rect x={X(px - 4.6)} y={Y(base + 4.6)} width={5.2} height={0.5} />
      </g>,
    )
  }

  // ---- lifeboats ----
  const lbCount = clamp(Math.round(d.lifeboats.count), 0, 3)
  if (lbCount > 0) {
    let lx = clamp(d.lifeboats.posFrac * g.L, g.ssStart + 2, g.ssEnd - 6.5 * lbCount)
    for (let i = 0; i < lbCount; i++) {
      const bh = surfaceAt(lx + 2.75) - 0.4
      parts.push(
        <g key={`boat-${i}`}>
          <line x1={X(lx + 1)} y1={Y(bh + 1.6)} x2={X(lx + 1)} y2={Y(bh)} stroke={C.deckGrey} strokeWidth={0.2} />
          <line x1={X(lx + 4.5)} y1={Y(bh + 1.6)} x2={X(lx + 4.5)} y2={Y(bh)} stroke={C.deckGrey} strokeWidth={0.2} />
          <rect x={X(lx)} y={Y(bh + 0.55)} width={5.5} height={0.85} rx={0.42} fill={C.lifeboatCanopy} />
          <rect x={X(lx)} y={Y(bh + 0.1)} width={5.5} height={0.75} rx={0.37} fill={C.lifeboatOrange} />
        </g>,
      )
      lx += 6.6
    }
  }

  // ---- hull details ----
  const hullDetails: JSX.Element[] = []
  if (d.hull.portholes) {
    for (let x = g.rake + 4; x < g.ssEnd - 2; x += 2.3) {
      hullDetails.push(
        <circle key={`ph-${x.toFixed(1)}`} cx={X(x)} cy={Y(g.F - 1.15)} r={0.3} fill={C.porthole} opacity={0.8} />,
      )
    }
  }
  if (d.hull.bowThruster) {
    const tx = g.rake + 2.6
    hullDetails.push(
      <g key="thruster" stroke={C.porthole} strokeWidth={0.16} fill="none" opacity={0.9}>
        <circle cx={X(tx)} cy={Y(1.15)} r={0.8} />
        <line x1={X(tx - 0.55)} y1={Y(1.15 - 0.55)} x2={X(tx + 0.55)} y2={Y(1.15 + 0.55)} />
        <line x1={X(tx - 0.55)} y1={Y(1.15 + 0.55)} x2={X(tx + 0.55)} y2={Y(1.15 - 0.55)} />
      </g>,
    )
  }
  if (g.L >= 55) {
    hullDetails.push(
      <text
        key="calmac"
        x={X(g.L * 0.58)}
        y={Y(g.F * 0.36)}
        textAnchor="middle"
        fill={C.text}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={2.1}
        letterSpacing={0.24}
      >
        Caledonian MacBrayne
      </text>,
    )
  }
  hullDetails.push(
    <text
      key="name"
      x={X(g.rake + 1.2)}
      y={Y(g.F - 0.1 + sheer(d, g, g.rake + 1.2))}
      fill={C.text}
      fontFamily="Verdana, sans-serif"
      fontSize={0.95}
      letterSpacing={0.12}
    >
      {d.name.toUpperCase()}
    </text>,
  )
  if (d.hull.webAddress) {
    hullDetails.push(
      <text
        key="web"
        x={X(g.ssEnd - 3)}
        y={Y(g.F + DECK_H * 0.32)}
        textAnchor="end"
        fill={C.redText}
        fontFamily="Verdana, sans-serif"
        fontSize={0.78}
      >
        www.calmac.co.uk
      </text>,
    )
  }

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="ship-view" role="img" aria-label={`Side profile of ${d.name}`}>
      {/* sea */}
      <rect x={0} y={Y(0)} width={VB_W} height={SEA} fill={C.sea} />
      <rect x={0} y={Y(-1.6)} width={VB_W} height={SEA - 1.6} fill={C.seaDeep} opacity={0.5} />
      {/* boot stripe: hull outline extended below the waterline */}
      <path d={hullPath(0.7)} fill={C.boot} />
      {/* hull */}
      <path d={hullPath(0)} fill={C.hull} />
      {parts}
      {hullDetails}
    </svg>
  )
}
