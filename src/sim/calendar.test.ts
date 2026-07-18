import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import {
  advanceCalendar,
  dayProgress,
  forecastLabel,
  initialCalendarState,
  rollWeather,
} from './calendar'

const DAY = 1000 // a nice round test day length

describe('initialCalendarState', () => {
  it('starts at day 0, no time elapsed', () => {
    expect(initialCalendarState()).toEqual({ day: 0, msIntoDay: 0 })
  })
})

describe('advanceCalendar', () => {
  it('accumulates within the same day without crossing it', () => {
    const { state, daysAdvanced } = advanceCalendar(initialCalendarState(), 400, DAY)
    expect(state).toEqual({ day: 0, msIntoDay: 400 })
    expect(daysAdvanced).toBe(0)
  })

  it('crosses exactly one day boundary', () => {
    const { state, daysAdvanced } = advanceCalendar({ day: 0, msIntoDay: 800 }, 300, DAY)
    expect(state).toEqual({ day: 1, msIntoDay: 100 })
    expect(daysAdvanced).toBe(1)
  })

  it('handles a large jump crossing multiple days (e.g. a backgrounded tab)', () => {
    const { state, daysAdvanced } = advanceCalendar(initialCalendarState(), 3500, DAY)
    expect(state).toEqual({ day: 3, msIntoDay: 500 })
    expect(daysAdvanced).toBe(3)
  })

  it('never loses or invents time across many small calls vs. one big call', () => {
    let s = initialCalendarState()
    for (let i = 0; i < 100; i++) s = advanceCalendar(s, 37, DAY).state
    const totalMsExpected = 100 * 37
    const oneShot = advanceCalendar(initialCalendarState(), totalMsExpected, DAY).state
    expect(s).toEqual(oneShot)
  })

  it('is deterministic', () => {
    const a = advanceCalendar({ day: 2, msIntoDay: 250 }, 900, DAY)
    const b = advanceCalendar({ day: 2, msIntoDay: 250 }, 900, DAY)
    expect(a).toEqual(b)
  })
})

describe('dayProgress', () => {
  it('is 0 at the start of a day', () => {
    expect(dayProgress({ day: 0, msIntoDay: 0 }, DAY)).toBe(0)
  })

  it('is 0.5 halfway through', () => {
    expect(dayProgress({ day: 0, msIntoDay: 500 }, DAY)).toBeCloseTo(0.5, 6)
  })

  it('is clamped to 1 even if msIntoDay somehow exceeds the day length', () => {
    expect(dayProgress({ day: 0, msIntoDay: 1500 }, DAY)).toBe(1)
  })
})

describe('rollWeather', () => {
  it('is deterministic for a given rng state', () => {
    expect(rollWeather(createRng(5))).toBe(rollWeather(createRng(5)))
  })

  it('produces values in [0, 1)', () => {
    const rng = createRng(11)
    for (let i = 0; i < 200; i++) {
      const w = rollWeather(rng)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(1)
    }
  })
})

describe('forecastLabel', () => {
  it('buckets severity into the four labels correctly', () => {
    expect(forecastLabel(0)).toBe('calm')
    expect(forecastLabel(0.24)).toBe('calm')
    expect(forecastLabel(0.25)).toBe('moderate')
    expect(forecastLabel(0.49)).toBe('moderate')
    expect(forecastLabel(0.5)).toBe('rough')
    expect(forecastLabel(0.74)).toBe('rough')
    expect(forecastLabel(0.75)).toBe('severe')
    expect(forecastLabel(0.99)).toBe('severe')
  })
})
