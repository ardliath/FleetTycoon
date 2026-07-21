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
// Both constants are currently deliberate placeholders (0) pending a real
// curve-design pass, so these only prove the wiring is correct and clamps
// hold — NOT a real magnitude effect. That's task #94's job, once the
// constants are actually set.
describe('applyPassiveDecay (placeholder constants)', () => {
  it('is a genuine no-op at the current placeholder rate', () => {
    const condition = { score: 0.7, drydockUntilDay: null }
    expect(applyPassiveDecay(condition).score).toBe(0.7)
  })

  it('never drops below 0 however many times it is applied', () => {
    let condition = newShipCondition()
    for (let i = 0; i < 1000; i++) condition = applyPassiveDecay(condition)
    expect(condition.score).toBeGreaterThanOrEqual(0)
  })
})

describe('applyRoutineUpkeep (placeholder constants)', () => {
  it('is a genuine no-op at the current placeholder rate', () => {
    const condition = { score: 0.7, drydockUntilDay: null }
    expect(applyRoutineUpkeep(condition).score).toBe(0.7)
  })

  it('never exceeds 1 however many times it is applied', () => {
    let condition = newShipCondition()
    for (let i = 0; i < 1000; i++) condition = applyRoutineUpkeep(condition)
    expect(condition.score).toBeLessThanOrEqual(1)
  })
})
