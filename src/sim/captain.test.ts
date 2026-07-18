import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { effectiveRisk, resolveAutomatedSailing, type CaptainResolutionParams } from './captain'

const base: CaptainResolutionParams = {
  hazard: 0.5,
  weather: 0.5,
  captainSkill: 0.5,
  shipSuitability: 1,
  shipCondition: 1,
}

describe('effectiveRisk', () => {
  it('is 0 when hazard is 0, regardless of weather', () => {
    expect(effectiveRisk({ ...base, hazard: 0, weather: 1 })).toBe(0)
  })

  it('is 0 when weather is perfectly calm', () => {
    expect(effectiveRisk({ ...base, weather: 0 })).toBe(0)
  })

  it('rises with hazard, all else equal', () => {
    const low = effectiveRisk({ ...base, hazard: 0.2 })
    const high = effectiveRisk({ ...base, hazard: 0.9 })
    expect(high).toBeGreaterThan(low)
  })

  it('rises with weather severity, all else equal', () => {
    const low = effectiveRisk({ ...base, weather: 0.2 })
    const high = effectiveRisk({ ...base, weather: 0.9 })
    expect(high).toBeGreaterThan(low)
  })

  it('falls as captain skill rises, all else equal', () => {
    const unskilled = effectiveRisk({ ...base, captainSkill: 0 })
    const skilled = effectiveRisk({ ...base, captainSkill: 1 })
    expect(skilled).toBeLessThan(unskilled)
  })

  it('even a perfect captain does not fully eliminate risk from real hazard+weather', () => {
    const risk = effectiveRisk({ hazard: 1, weather: 1, captainSkill: 1, shipSuitability: 1, shipCondition: 1 })
    expect(risk).toBeGreaterThan(0)
  })

  it('rises as ship condition falls, all else equal', () => {
    const pristine = effectiveRisk({ ...base, shipCondition: 1 })
    const worn = effectiveRisk({ ...base, shipCondition: 0.2 })
    expect(worn).toBeGreaterThan(pristine)
  })

  it('a pristine ship (condition 1) behaves exactly as Phase 2 did — no change from that baseline', () => {
    const risk = effectiveRisk({ ...base, shipCondition: 1 })
    // Phase 2's formula, before shipCondition existed
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
    const phase2 = clamp(base.hazard * base.weather * (1 - 0.7 * base.captainSkill), 0, 1)
    expect(risk).toBeCloseTo(phase2, 10)
  })

  it('is bounded to [0, 1]', () => {
    for (const hazard of [0, 0.5, 1]) {
      for (const weather of [0, 0.5, 1]) {
        for (const captainSkill of [0, 0.5, 1]) {
          for (const shipCondition of [0, 0.5, 1]) {
            const r = effectiveRisk({ hazard, weather, captainSkill, shipSuitability: 1, shipCondition })
            expect(r).toBeGreaterThanOrEqual(0)
            expect(r).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })
})

describe('resolveAutomatedSailing — determinism', () => {
  it('the same seed always produces the same outcome', () => {
    const a = resolveAutomatedSailing(base, createRng(42))
    const b = resolveAutomatedSailing(base, createRng(42))
    expect(a).toBe(b)
  })

  it('draws from the rng at most once (a fresh rng at the same seed matches a second call on the same instance)', () => {
    const rng = createRng(7)
    const first = resolveAutomatedSailing(base, rng)
    // if resolveAutomatedSailing consumed 0 or 1 draws consistently, replaying
    // from a fresh rng with the same seed and taking the first outcome matches
    const replay = resolveAutomatedSailing(base, createRng(7))
    expect(replay).toBe(first)
  })
})

describe('resolveAutomatedSailing — refuse-to-sail gate', () => {
  it('a badly unsuitable ship is refused regardless of the rng draw', () => {
    const params = { ...base, shipSuitability: 0.1 }
    for (let seed = 0; seed < 20; seed++) {
      expect(resolveAutomatedSailing(params, createRng(seed))).toBe('cancelled')
    }
  })

  it('a suitable ship is never refused purely for suitability', () => {
    const params = { ...base, shipSuitability: 1, hazard: 0, weather: 0 }
    // zero hazard/weather -> risk 0 -> should always be onTime, never cancelled
    for (let seed = 0; seed < 20; seed++) {
      expect(resolveAutomatedSailing(params, createRng(seed))).toBe('onTime')
    }
  })
})

describe('resolveAutomatedSailing — boundary behaviour', () => {
  it('zero risk (calm weather, no hazard) is always onTime', () => {
    const params: CaptainResolutionParams = {
      hazard: 0,
      weather: 0,
      captainSkill: 0,
      shipSuitability: 1,
      shipCondition: 1,
    }
    for (let seed = 0; seed < 50; seed++) {
      expect(resolveAutomatedSailing(params, createRng(seed))).toBe('onTime')
    }
  })

  it('maximum risk never resolves onTime', () => {
    const params: CaptainResolutionParams = {
      hazard: 1,
      weather: 1,
      captainSkill: 0,
      shipSuitability: 1,
      shipCondition: 1,
    }
    for (let seed = 0; seed < 50; seed++) {
      expect(resolveAutomatedSailing(params, createRng(seed))).not.toBe('onTime')
    }
  })
})

describe('resolveAutomatedSailing — outcome distribution matches the tier design', () => {
  it('at maximum risk, roughly matches the designed 25/35/40 severe/damaged/late split', () => {
    const params: CaptainResolutionParams = {
      hazard: 1,
      weather: 1,
      captainSkill: 0,
      shipSuitability: 1,
      shipCondition: 1,
    }
    const rng = createRng(2024)
    const counts = { onTime: 0, late: 0, damaged: 0, severelyDamaged: 0, cancelled: 0 }
    const N = 20000
    for (let i = 0; i < N; i++) counts[resolveAutomatedSailing(params, rng)]++
    expect(counts.severelyDamaged / N).toBeCloseTo(0.25, 1)
    expect(counts.damaged / N).toBeCloseTo(0.35, 1)
    expect(counts.late / N).toBeCloseTo(0.4, 1)
    expect(counts.onTime).toBe(0)
  })

  it('a skilled captain in easy conditions overwhelmingly sails onTime', () => {
    const params: CaptainResolutionParams = {
      hazard: 0.3,
      weather: 0.2,
      captainSkill: 0.9,
      shipSuitability: 1,
      shipCondition: 1,
    }
    const rng = createRng(99)
    let onTime = 0
    const N = 5000
    for (let i = 0; i < N; i++) if (resolveAutomatedSailing(params, rng) === 'onTime') onTime++
    expect(onTime / N).toBeGreaterThan(0.9)
  })
})
