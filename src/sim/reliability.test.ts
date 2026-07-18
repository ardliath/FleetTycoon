import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RELIABILITY_PARAMS,
  computeReliability,
  isContractLost,
  recordSailingOutcome,
  type SailingOutcome,
} from './reliability'

describe('computeReliability', () => {
  it('is 1 for an empty history (nothing has gone wrong yet)', () => {
    expect(computeReliability([])).toBe(1)
  })

  it('is 1 after nothing but onTime sailings', () => {
    const history: SailingOutcome[] = ['onTime', 'onTime', 'onTime']
    expect(computeReliability(history)).toBe(1)
  })

  it('is 0 after nothing but cancellations', () => {
    const history: SailingOutcome[] = ['cancelled', 'cancelled', 'cancelled']
    expect(computeReliability(history)).toBe(0)
  })

  it('averages credit across a mixed history', () => {
    // onTime (1) + cancelled (0) over 2 sailings = 0.5
    expect(computeReliability(['onTime', 'cancelled'])).toBeCloseTo(0.5, 6)
  })

  it('only considers the most recent windowSize sailings', () => {
    const params = { ...DEFAULT_RELIABILITY_PARAMS, windowSize: 3 }
    // 7 bad sailings, then 3 perfect ones — only the recent 3 should count
    const history: SailingOutcome[] = [
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled',
      'cancelled',
      'onTime',
      'onTime',
      'onTime',
    ]
    expect(computeReliability(history, params)).toBe(1)
  })

  it('a full recovery after early trouble reaches 1 once bad sailings scroll out of the window', () => {
    const params = { ...DEFAULT_RELIABILITY_PARAMS, windowSize: 2 }
    const afterBadStart = computeReliability(['cancelled', 'cancelled'], params)
    expect(afterBadStart).toBe(0)
    const recovered = computeReliability(['cancelled', 'cancelled', 'onTime', 'onTime'], params)
    expect(recovered).toBe(1)
  })
})

describe('isContractLost', () => {
  it('never lost before minSailingsBeforeLoss, even with a terrible run', () => {
    const params = { ...DEFAULT_RELIABILITY_PARAMS, minSailingsBeforeLoss: 5 }
    const history: SailingOutcome[] = ['cancelled', 'cancelled', 'cancelled', 'cancelled']
    expect(isContractLost(history, params)).toBe(false)
  })

  it('lost once enough sailings have happened and reliability is under threshold', () => {
    const params = { windowSize: 10, lossThreshold: 0.6, minSailingsBeforeLoss: 3 }
    const history: SailingOutcome[] = ['cancelled', 'cancelled', 'cancelled']
    expect(isContractLost(history, params)).toBe(true)
  })

  it('not lost when reliability stays at or above the threshold', () => {
    const params = { windowSize: 10, lossThreshold: 0.6, minSailingsBeforeLoss: 2 }
    const history: SailingOutcome[] = ['onTime', 'onTime', 'late', 'late']
    // credits: 1,1,0.6,0.6 -> avg 0.8, above 0.6
    expect(isContractLost(history, params)).toBe(false)
  })

  it('good play after a bad start can pull the contract back from the brink', () => {
    const params = { windowSize: 4, lossThreshold: 0.6, minSailingsBeforeLoss: 4 }
    const badStart: SailingOutcome[] = ['cancelled', 'cancelled', 'cancelled', 'cancelled']
    expect(isContractLost(badStart, params)).toBe(true)
    const recovered: SailingOutcome[] = [...badStart, 'onTime', 'onTime', 'onTime', 'onTime']
    expect(isContractLost(recovered, params)).toBe(false)
  })
})

describe('recordSailingOutcome', () => {
  it('appends without mutating the original array', () => {
    const original: SailingOutcome[] = ['onTime']
    const next = recordSailingOutcome(original, 'late')
    expect(next).toEqual(['onTime', 'late'])
    expect(original).toEqual(['onTime'])
  })
})
