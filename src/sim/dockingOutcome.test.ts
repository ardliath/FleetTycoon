import { describe, expect, it } from 'vitest'
import { mapDockingResultToSailingOutcome } from './dockingOutcome'

describe('mapDockingResultToSailingOutcome', () => {
  it('a successful berth is onTime', () => {
    expect(mapDockingResultToSailingOutcome({ outcome: 'berthed' })).toBe('onTime')
  })

  it('drifting out of the harbour is a cancelled sailing, not damage', () => {
    expect(mapDockingResultToSailingOutcome({ outcome: 'adrift' })).toBe('cancelled')
  })

  it('a moderate hard contact is damaged, not severe', () => {
    expect(mapDockingResultToSailingOutcome({ outcome: 'damaged', impactSpeed: 1.5 })).toBe('damaged')
  })

  it('a high-speed hard contact is severelyDamaged', () => {
    expect(mapDockingResultToSailingOutcome({ outcome: 'damaged', impactSpeed: 3.0 })).toBe('severelyDamaged')
  })

  it('is monotonic: a harder impact never resolves to a milder tier', () => {
    const mild = mapDockingResultToSailingOutcome({ outcome: 'damaged', impactSpeed: 1.4 })
    const severe = mapDockingResultToSailingOutcome({ outcome: 'damaged', impactSpeed: 5 })
    expect(mild).toBe('damaged')
    expect(severe).toBe('severelyDamaged')
  })

  it('missing impactSpeed on a damaged result defaults to the milder tier rather than throwing', () => {
    expect(mapDockingResultToSailingOutcome({ outcome: 'damaged' })).toBe('damaged')
  })
})
