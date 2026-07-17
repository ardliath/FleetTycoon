/** Parametric description of a "big ship". One of these fully determines
 * both the side profile and the top-down deck plan. */

export type BowStyle = 'raked' | 'flared' | 'modern'
export type SternStyle = 'open' | 'gantry' | 'enclosed'
export type BridgeStyle = 'classic' | 'modern'
export type FunnelStyle = 'classic' | 'drum' | 'raked' | 'flick' | 'modern'
export type MainmastStyle = 'buff' | 'dark-raked'
export type WindowStyle = 'rect' | 'porthole' | 'mixed'

export interface ShipDesign {
  name: string
  /** Overall length in metres (roughly 45–125 for the big ships). */
  lengthM: number
  bow: BowStyle
  stern: SternStyle
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
  }
}

export function cloneDesign(d: ShipDesign): ShipDesign {
  return structuredClone(d)
}
