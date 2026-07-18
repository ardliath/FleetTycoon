/**
 * Maps a manual docking attempt onto the same SailingOutcome vocabulary the
 * automated captain uses (see captain.ts) — deterministically, not via a
 * risk roll, per the Phase 2 design decision: a player who takes the helm
 * gets an outcome decided by how well they actually docked (the physics
 * already computed in src/sim/docking.ts), not a second dice roll on top of
 * their own skill.
 *
 * Deliberately not importing DockingScene's DockingResult type here — that
 * would pull Phaser into sim/. This structural type is satisfied by it
 * without a dependency in either direction.
 */
import type { SailingOutcome } from './reliability'

export interface DockingAttemptResult {
  outcome: 'berthed' | 'damaged' | 'adrift'
  /** m/s at the moment of hard contact — only meaningful for 'damaged'. */
  impactSpeed?: number
}

/** Above this impact speed, a hard contact is severe enough to send the
 * ship to drydock rather than just needing a quick repair. Comfortably
 * above docking.ts's own HARD_CONTACT_SPEED (1.3 m/s), which is the
 * threshold for "damaged" to trigger at all. */
const SEVERE_IMPACT_SPEED = 2.2

export function mapDockingResultToSailingOutcome(result: DockingAttemptResult): SailingOutcome {
  switch (result.outcome) {
    case 'berthed':
      return 'onTime'
    case 'adrift':
      // failed to complete the sailing, but no hull contact — a missed
      // sailing, not ship damage.
      return 'cancelled'
    case 'damaged':
      return (result.impactSpeed ?? 0) >= SEVERE_IMPACT_SPEED ? 'severelyDamaged' : 'damaged'
  }
}
