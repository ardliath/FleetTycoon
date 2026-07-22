import { describe, expect, it } from 'vitest'
import {
  applyMaintenance,
  applyPassiveDecay,
  applyRoutineUpkeep,
  applyWear,
  drydockRepairCost,
  isInDrydock,
  needsDrydock,
  newShipCondition,
  releaseIfDue,
  sendToDrydock,
  DRYDOCK_DAYS,
} from './shipCondition'

describe('newShipCondition', () => {
  it('starts pristine and out of drydock', () => {
    const condition = newShipCondition()
    expect(condition.score).toBe(1)
    expect(condition.drydockUntilDay).toBeNull()
  })
})

describe('applyWear', () => {
  it('a cancelled day causes no wear', () => {
    const condition = applyWear(newShipCondition(), 'cancelled')
    expect(condition.score).toBe(1)
  })

  it('a severelyDamaged sailing wears more than a damaged one, which wears more than onTime', () => {
    const onTime = applyWear(newShipCondition(), 'onTime').score
    const damaged = applyWear(newShipCondition(), 'damaged').score
    const severe = applyWear(newShipCondition(), 'severelyDamaged').score
    expect(damaged).toBeLessThan(onTime)
    expect(severe).toBeLessThan(damaged)
  })

  it('never drops below 0 even after repeated damage', () => {
    let condition = newShipCondition()
    for (let i = 0; i < 20; i++) condition = applyWear(condition, 'severelyDamaged')
    expect(condition.score).toBe(0)
  })
})

describe('needsDrydock', () => {
  it('only severelyDamaged triggers it', () => {
    expect(needsDrydock('severelyDamaged')).toBe(true)
    expect(needsDrydock('damaged')).toBe(false)
    expect(needsDrydock('onTime')).toBe(false)
    expect(needsDrydock('late')).toBe(false)
    expect(needsDrydock('cancelled')).toBe(false)
  })
})

describe('drydock lifecycle', () => {
  it('sendToDrydock makes isInDrydock true through the covered days', () => {
    const condition = sendToDrydock(newShipCondition(), 10)
    expect(isInDrydock(condition, 10)).toBe(true)
    expect(isInDrydock(condition, 10 + DRYDOCK_DAYS)).toBe(true)
    expect(isInDrydock(condition, 10 + DRYDOCK_DAYS + 1)).toBe(false)
  })

  it('releaseIfDue restores full condition once the stint has passed', () => {
    const condition = applyWear(sendToDrydock(newShipCondition(), 10), 'severelyDamaged')
    const stillIn = releaseIfDue(condition, 10 + DRYDOCK_DAYS)
    expect(stillIn.drydockUntilDay).not.toBeNull()
    const released = releaseIfDue(condition, 10 + DRYDOCK_DAYS + 1)
    expect(released.score).toBe(1)
    expect(released.drydockUntilDay).toBeNull()
  })

  it('releaseIfDue is a no-op for a ship that was never sent to drydock', () => {
    const condition = newShipCondition()
    expect(releaseIfDue(condition, 500)).toEqual(condition)
  })
})

describe('drydockRepairCost', () => {
  it('scales with ship value', () => {
    expect(drydockRepairCost(200000)).toBeGreaterThan(drydockRepairCost(50000))
  })
})

describe('applyMaintenance', () => {
  it('raises condition, capped at 1', () => {
    const condition = { score: 0.5, drydockUntilDay: null }
    const maintained = applyMaintenance(condition, 1000)
    expect(maintained.score).toBeGreaterThan(0.5)
    expect(maintained.score).toBeLessThanOrEqual(1)
  })

  it('never exceeds 1 even with a huge spend', () => {
    const maintained = applyMaintenance(newShipCondition(), 1_000_000)
    expect(maintained.score).toBe(1)
  })
})

// Phase 6 chunk 1's neglect-decay mechanism — see the doc comments on
// PASSIVE_DECAY_PER_DAY/ROUTINE_UPKEEP_RESTORE_PER_DAY in shipCondition.ts.
// (The real "does neglect measurably bite over a run" balance test lives
// in neglectBalance.test.ts; these just pin the per-day units and clamps.)
describe('applyPassiveDecay', () => {
  it('lowers condition by the per-day rate', () => {
    const condition = { score: 0.7, drydockUntilDay: null }
    expect(applyPassiveDecay(condition).score).toBeCloseTo(0.68, 10)
  })

  it('never drops below 0 however many times it is applied', () => {
    let condition = newShipCondition()
    for (let i = 0; i < 1000; i++) condition = applyPassiveDecay(condition)
    expect(condition.score).toBe(0)
  })
})

describe('applyRoutineUpkeep', () => {
  it('raises condition, but by less than passive decay lowers it — a ship still drifts down net', () => {
    const start = { score: 0.7, drydockUntilDay: null }
    const raised = applyRoutineUpkeep(start).score
    expect(raised).toBeGreaterThan(0.7)
    const netDaily = applyRoutineUpkeep(applyPassiveDecay(start)).score
    expect(netDaily).toBeLessThan(0.7) // decay wins — routine upkeep only softens the slope
  })

  it('never exceeds 1 however many times it is applied', () => {
    let condition = newShipCondition()
    for (let i = 0; i < 1000; i++) condition = applyRoutineUpkeep(condition)
    expect(condition.score).toBe(1)
  })
})
