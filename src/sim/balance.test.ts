/**
 * Phase 3's actual exit criterion: a cheap/inexperienced crew running an
 * old, poorly-maintained ship should show a measurably higher incident
 * rate than a well-crewed, well-maintained one — a real, provable reason
 * to spend more than the minimum, not just vibes. This test ties
 * captain.ts's risk formula together with crew.ts's experience model and
 * shipCondition.ts's wear model exactly as RouteOverview.tsx does.
 */
import { describe, expect, it } from 'vitest'
import { resolveAutomatedSailing, type CaptainResolutionParams } from './captain'
import { experienceOf, newCaptain } from './crew'
import { createRng } from './rng'
import type { SailingOutcome } from './reliability'

const N = 20000
const ROUTE = { hazard: 0.5, weather: 0.5, shipSuitability: 1 }

function incidentRate(params: CaptainResolutionParams, seed: number): number {
  const rng = createRng(seed)
  let incidents = 0
  for (let i = 0; i < N; i++) {
    const outcome: SailingOutcome = resolveAutomatedSailing(params, rng)
    if (outcome === 'damaged' || outcome === 'severelyDamaged') incidents++
  }
  return incidents / N
}

describe('balance sanity: crew experience + ship condition against incident rate', () => {
  it('a green captain on a badly worn ship has a measurably higher incident rate than a veteran on a near-new one', () => {
    const cheapAndOld: CaptainResolutionParams = {
      ...ROUTE,
      captainSkill: experienceOf(newCaptain('c1', 'Green', 'green')),
      shipCondition: 0.3,
    }
    const goodAndNew: CaptainResolutionParams = {
      ...ROUTE,
      captainSkill: experienceOf(newCaptain('c2', 'Veteran', 'veteran')),
      shipCondition: 1,
    }

    const worseRate = incidentRate(cheapAndOld, 1)
    const betterRate = incidentRate(goodAndNew, 2)

    // not just statistically greater — a real, noticeable gap. Absolute
    // incident rates are low at moderate hazard/weather (single-digit
    // percent even for the worse crew), so the meaningful signal is the
    // relative multiplier: the cheap/old combination should incident at
    // several times the rate of the good/new one.
    expect(worseRate).toBeGreaterThan(betterRate * 5)
    expect(worseRate - betterRate).toBeGreaterThan(0.03)
  })

  it('ship condition alone (crew held constant) measurably moves the incident rate', () => {
    const skill = experienceOf(newCaptain('c', 'Seasoned', 'seasoned'))
    const worn = incidentRate({ ...ROUTE, captainSkill: skill, shipCondition: 0.2 }, 3)
    const pristine = incidentRate({ ...ROUTE, captainSkill: skill, shipCondition: 1 }, 4)
    expect(worn).toBeGreaterThan(pristine)
  })

  it('crew experience alone (ship condition held constant) measurably moves the incident rate', () => {
    const green = incidentRate(
      { ...ROUTE, captainSkill: experienceOf(newCaptain('c', 'Green', 'green')), shipCondition: 1 },
      5,
    )
    const veteran = incidentRate(
      { ...ROUTE, captainSkill: experienceOf(newCaptain('c', 'Veteran', 'veteran')), shipCondition: 1 },
      6,
    )
    expect(green).toBeGreaterThan(veteran)
  })
})
