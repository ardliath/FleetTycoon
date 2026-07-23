/** Parametric description of a "big ship". One of these fully determines
 * both the side profile and the top-down deck plan. */

export type BowStyle = 'raked' | 'flared' | 'modern'
export type SternStyle = 'open' | 'gantry' | 'enclosed'
export type BridgeStyle = 'classic' | 'modern'
export type FunnelStyle = 'classic' | 'drum' | 'raked' | 'flick' | 'modern'
export type MainmastStyle = 'buff' | 'dark-raked'
export type WindowStyle = 'rect' | 'porthole' | 'mixed'
/** The four real CalMac-inspired fleet classes (docs/GAME_DESIGN.md's
 * Fleet & ship building section) — drives licence-tier gating (a player
 * or crew member licensed for `island` can't take the helm of a
 * `bigShip`) and route/ship suitability. */
export type ShipClass = 'island' | 'loch' | 'streaker' | 'bigShip'

export interface ShipDesign {
  name: string
  shipClass: ShipClass
  /** Overall length in metres (roughly 45–125 for the big ships). */
  lengthM: number
  bow: BowStyle
  stern: SternStyle
  /** True for double-ended ferries (wheelhouse/propulsion capable from
   * either end, real Loch class) — both ends take the `bow` hull-stem
   * shape instead of a stern transom, and both ends get the `stern`
   * deck/ramp treatment mirrored, since a real double-ender loads and
   * unloads from either end. Omit/false for a conventional single-ended
   * hull (the default, and the only shape Big Ships use). */
  doubleEnded?: boolean
  superstructure: {
    /** White decks above the hull deck (1–3). */
    decks: number
    /** Fore end of the white block, as a fraction of length from the bow. */
    startFrac: number
    /** Aft end of the white block, as a fraction of length from the bow. */
    endFrac: number
    /** Optional extent of the top deck band (decks >= 2). Setting the start
     * well aft of startFrac leaves an open gap at the fore, and the bridge
     * drops down to stand alone in it — the classic 80s CalMac layout
     * (Isle of Arran, Isle of Mull). */
    upperStartFrac?: number
    upperEndFrac?: number
    /** Height of one white superstructure deck, metres (default ~2.6). */
    deckHeightM?: number
    /** Step down in the hull and lowest white deck band together: aft of
     * `posFrac`, both the black hull's freeboard and the white band drop by
     * `drop` metres as one unit — the band keeps its full height, it just
     * sits lower, same as the hull beneath it — recreating the real
     * stepped-hull profile of the Isle of Arran / Hebridean Isles (a lower
     * hull aft of the step, not just a shorter top deck). For a hull with an
     * open stern, the existing bulwark taper further aft composes on top of
     * this. Omit for a flat, unstepped hull. */
    hullStep?: {
      /** Position of the step along the ship, fraction of length from bow. */
      posFrac: number
      /** How far the deck top drops aft of the step, metres. */
      drop: number
    }
    bridge: BridgeStyle
    windows: WindowStyle
  }
  funnel: {
    style: FunnelStyle
    /** 1 = single, 2 = athwartships pair (side by side across the beam —
     * they overlap into one silhouette in side view). */
    count: number
    /** Funnel centre as a fraction of length from the bow. */
    posFrac: number
    /** Width at the base, metres. */
    baseWidth: number
    /** Width at the top, metres — narrower than the base gives the classic
     * tapered look; close to the base gives a slab-sided funnel. */
    topWidth: number
    /** Height above the deck it stands on, metres. */
    height: number
    /** How many decks below the local deckhouse roof the funnel base sits
     * (default 0). With 1, the funnel rises from the deck below and emerges
     * through/behind the deckhouse — as on Isle of Arran. */
    baseDeckDrop?: number
    /** Horizontal offset of the funnel top relative to its base, metres
     * (positive = aft). Shears the funnel; can move the top out beyond the
     * base footprint. When omitted, a per-style default rake is used. */
    topOffset?: number
  }
  masts: {
    foremast: boolean
    mainmast: boolean
    /** Buff cargo derrick. */
    aftDerrick: boolean
    /** Optional explicit mainmast position as a fraction of length
     * (defaults to just aft of the funnel). */
    mainmastFrac?: number
    /** Mainmast look: traditional buff pole, or the dark aft-raked mast
     * seen on Caledonian Isles (default buff). */
    mainmastStyle?: MainmastStyle
    /** Optional explicit derrick position as a fraction of length
     * (defaults to just aft of the superstructure). */
    derrickFrac?: number
  }
  lifeboats: {
    /** Boats per side (0–3). */
    count: number
    /** Fore end of the boat row as a fraction of length. */
    posFrac: number
  }
  hull: {
    /** Row of portholes along the black hull. */
    portholes: boolean
    /** Bow thruster marking near the waterline. */
    bowThruster: boolean
    /** Red www.calmac.co.uk lettering on the white band. */
    webAddress: boolean
    /** Freeboard: height of the black hull above the waterline, metres.
     * When omitted, derived from length (~3.4 + 1.8% of length). */
    freeboardM?: number
  }
}

export function cloneDesign(d: ShipDesign): ShipDesign {
  return structuredClone(d)
}
