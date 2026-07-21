/**
 * The player's own captain's licence — docs/GAME_DESIGN.md's standout
 * mechanic. Progresses Island class -> Loch class -> Big Ships, the same
 * three tiers hired crew are drawn from. Pure: given the licence state and
 * the outcome of a manual docking, compute the (possibly advanced) state.
 *
 * Gating is skill-demonstrated, not hours-logged (Adam's call, resolving
 * the open question in GAME_DESIGN.md) — advancement only comes from
 * clean manual dockings on the player's current tier, never from time
 * passing. A bad docking doesn't erase progress already earned, it just
 * doesn't add to it — an off day shouldn't feel like punishment on top of
 * the repair bill she already earned via sim/dockingOutcome.ts.
 */
import type { ShipClass } from '../ship/types'
import type { SailingOutcome } from './reliability'

export type LicenceTier = 'island' | 'loch' | 'bigShip'

const TIER_ORDER: LicenceTier[] = ['island', 'loch', 'bigShip']

/** How many clean (onTime) manual dockings on the current tier's own class
 * prove competence to advance. Tuned by feel, not physics. */
export const CLEAN_DOCKINGS_TO_ADVANCE = 5

export interface LicenceState {
  tier: LicenceTier
  /** Clean dockings logged on the current tier since the last promotion
   * (or since the game began, for the first tier). Resets to 0 on
   * promotion; never decreases otherwise. */
  cleanDockings: number
}

export function initialLicence(): LicenceState {
  return { tier: 'island', cleanDockings: 0 }
}

/** Where a ship class sits on the licence ladder, for gating purposes.
 * Streakers aren't part of the three-tier progression GAME_DESIGN.md
 * names (Island -> Loch -> Big Ships) — treated as requiring the top
 * tier, the conservative reading until Adam says otherwise. */
function tierIndexForClass(shipClass: ShipClass): number {
  const idx = TIER_ORDER.indexOf(shipClass as LicenceTier)
  return idx === -1 ? TIER_ORDER.length - 1 : idx
}

/** Whether a licence at this tier permits taking manual control of a ship
 * of the given class. */
export function canOperate(licence: LicenceState, shipClass: ShipClass): boolean {
  return tierIndexForClass(shipClass) <= TIER_ORDER.indexOf(licence.tier)
}

/** Record a manual docking's outcome against the licence. Only a clean
 * (onTime) docking on a ship of the licence's *current* tier counts toward
 * advancing to the next one — proving yourself on an easier class you're
 * already licensed for doesn't count a second time, and neither does a
 * class you aren't yet licensed to have taken the helm of in the first
 * place. Already at the top tier, this is a no-op. */
export function recordManualDocking(
  licence: LicenceState,
  shipClass: ShipClass,
  outcome: SailingOutcome,
): LicenceState {
  const nextTierIdx = TIER_ORDER.indexOf(licence.tier) + 1
  const nextTier = TIER_ORDER[nextTierIdx]
  if (!nextTier) return licence
  if (shipClass !== licence.tier || outcome !== 'onTime') return licence

  const cleanDockings = licence.cleanDockings + 1
  if (cleanDockings >= CLEAN_DOCKINGS_TO_ADVANCE) {
    return { tier: nextTier, cleanDockings: 0 }
  }
  return { ...licence, cleanDockings }
}
