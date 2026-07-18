/**
 * Crew (captains) for Phase 3's fleet — experience offsets route risk
 * (feeds captain.ts's effectiveRisk) and costs more to hire and keep.
 * Pure bookkeeping, no RNG: experience grows deterministically from
 * sailings logged, per the confirmed design answer.
 */

export type CaptainTier = 'green' | 'seasoned' | 'veteran'

export interface Captain {
  id: string
  name: string
  tier: CaptainTier
  sailingsLogged: number
}

/** Starting experience (0..1) by hiring tier — where the asymptotic curve
 * below starts climbing from. Untuned; expect to revisit once there's a
 * played economy to balance against. */
const TIER_BASE_EXPERIENCE: Record<CaptainTier, number> = {
  green: 0.15,
  seasoned: 0.45,
  veteran: 0.75,
}

const TIER_HIRE_COST: Record<CaptainTier, number> = {
  green: 2000,
  seasoned: 6000,
  veteran: 12000,
}

const TIER_DAILY_WAGE: Record<CaptainTier, number> = {
  green: 80,
  seasoned: 150,
  veteran: 260,
}

/** How fast logged sailings close the gap between a captain's starting
 * experience and mastery (1.0) — an asymptotic approach, never quite
 * capping, so a veteran still has (a little) room to improve. */
const EXPERIENCE_GAIN_RATE = 0.01

export function newCaptain(id: string, name: string, tier: CaptainTier): Captain {
  return { id, name, tier, sailingsLogged: 0 }
}

/** Current experience, 0..1 — the value that feeds captain.ts's
 * `captainSkill` parameter. */
export function experienceOf(captain: Captain): number {
  const base = TIER_BASE_EXPERIENCE[captain.tier]
  return base + (1 - base) * (1 - Math.exp(-EXPERIENCE_GAIN_RATE * captain.sailingsLogged))
}

/** A sailing (of any outcome, including cancelled) logs experience —
 * showing up and running the route is how a captain learns it. */
export function recordSailing(captain: Captain): Captain {
  return { ...captain, sailingsLogged: captain.sailingsLogged + 1 }
}

export function hireCost(tier: CaptainTier): number {
  return TIER_HIRE_COST[tier]
}

export function dailyWage(tier: CaptainTier): number {
  return TIER_DAILY_WAGE[tier]
}
