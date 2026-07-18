import { describe, expect, it } from 'vitest'
import { dailyWage, experienceOf, hireCost, newCaptain, recordSailing } from './crew'

describe('newCaptain', () => {
  it('starts at zero sailings logged', () => {
    const captain = newCaptain('c1', 'Test', 'green')
    expect(captain.sailingsLogged).toBe(0)
  })
})

describe('experienceOf', () => {
  it('higher tiers start with more experience', () => {
    const green = experienceOf(newCaptain('a', 'Green', 'green'))
    const seasoned = experienceOf(newCaptain('b', 'Seasoned', 'seasoned'))
    const veteran = experienceOf(newCaptain('c', 'Veteran', 'veteran'))
    expect(seasoned).toBeGreaterThan(green)
    expect(veteran).toBeGreaterThan(seasoned)
  })

  it('rises as sailings are logged', () => {
    let captain = newCaptain('a', 'Test', 'green')
    const start = experienceOf(captain)
    for (let i = 0; i < 20; i++) captain = recordSailing(captain)
    expect(experienceOf(captain)).toBeGreaterThan(start)
  })

  it('never exceeds 1, even after many sailings', () => {
    let captain = newCaptain('a', 'Test', 'veteran')
    for (let i = 0; i < 10000; i++) captain = recordSailing(captain)
    expect(experienceOf(captain)).toBeLessThanOrEqual(1)
    expect(experienceOf(captain)).toBeGreaterThan(0.99)
  })
})

describe('recordSailing', () => {
  it('increments sailingsLogged without mutating the original', () => {
    const captain = newCaptain('a', 'Test', 'green')
    const next = recordSailing(captain)
    expect(captain.sailingsLogged).toBe(0)
    expect(next.sailingsLogged).toBe(1)
  })
})

describe('hireCost / dailyWage', () => {
  it('a more experienced tier costs more to hire and to keep', () => {
    expect(hireCost('veteran')).toBeGreaterThan(hireCost('seasoned'))
    expect(hireCost('seasoned')).toBeGreaterThan(hireCost('green'))
    expect(dailyWage('veteran')).toBeGreaterThan(dailyWage('seasoned'))
    expect(dailyWage('seasoned')).toBeGreaterThan(dailyWage('green'))
  })
})
