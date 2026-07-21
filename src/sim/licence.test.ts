import { describe, expect, it } from 'vitest'
import {
  CLEAN_DOCKINGS_TO_ADVANCE,
  canOperate,
  initialLicence,
  recordManualDocking,
  type LicenceState,
} from './licence'

describe('initialLicence', () => {
  it('starts at island tier with no progress', () => {
    expect(initialLicence()).toEqual({ tier: 'island', cleanDockings: 0 })
  })
})

describe('canOperate', () => {
  it('an island licence only covers island class', () => {
    const licence = initialLicence()
    expect(canOperate(licence, 'island')).toBe(true)
    expect(canOperate(licence, 'loch')).toBe(false)
    expect(canOperate(licence, 'bigShip')).toBe(false)
  })

  it('a loch licence covers island and loch, not bigShip', () => {
    const licence: LicenceState = { tier: 'loch', cleanDockings: 0 }
    expect(canOperate(licence, 'island')).toBe(true)
    expect(canOperate(licence, 'loch')).toBe(true)
    expect(canOperate(licence, 'bigShip')).toBe(false)
  })

  it('a bigShip licence covers everything on the real ladder', () => {
    const licence: LicenceState = { tier: 'bigShip', cleanDockings: 0 }
    expect(canOperate(licence, 'island')).toBe(true)
    expect(canOperate(licence, 'loch')).toBe(true)
    expect(canOperate(licence, 'bigShip')).toBe(true)
  })

  it('streaker requires the top tier, conservatively', () => {
    expect(canOperate(initialLicence(), 'streaker')).toBe(false)
    expect(canOperate({ tier: 'loch', cleanDockings: 0 }, 'streaker')).toBe(false)
    expect(canOperate({ tier: 'bigShip', cleanDockings: 0 }, 'streaker')).toBe(true)
  })
})

describe('recordManualDocking', () => {
  it('a clean docking on the current tier advances progress', () => {
    const licence = recordManualDocking(initialLicence(), 'island', 'onTime')
    expect(licence).toEqual({ tier: 'island', cleanDockings: 1 })
  })

  it('advances to the next tier after enough clean dockings, resetting progress', () => {
    let licence = initialLicence()
    for (let i = 0; i < CLEAN_DOCKINGS_TO_ADVANCE; i++) {
      licence = recordManualDocking(licence, 'island', 'onTime')
    }
    expect(licence).toEqual({ tier: 'loch', cleanDockings: 0 })
  })

  it('a non-clean outcome does not advance progress, but does not erase it either', () => {
    let licence = recordManualDocking(initialLicence(), 'island', 'onTime')
    licence = recordManualDocking(licence, 'island', 'damaged')
    expect(licence).toEqual({ tier: 'island', cleanDockings: 1 })
  })

  it('a docking on a class other than the current tier does not count', () => {
    // shouldn't happen in practice (canOperate gates it), but the function
    // itself should still be defensive.
    const licence = recordManualDocking(initialLicence(), 'loch', 'onTime')
    expect(licence).toEqual({ tier: 'island', cleanDockings: 0 })
  })

  it('a docking on an already-mastered lower class does not count a second time', () => {
    const licence = recordManualDocking({ tier: 'loch', cleanDockings: 0 }, 'island', 'onTime')
    expect(licence).toEqual({ tier: 'loch', cleanDockings: 0 })
  })

  it('is a no-op once already at the top tier', () => {
    const licence = recordManualDocking({ tier: 'bigShip', cleanDockings: 2 }, 'bigShip', 'onTime')
    expect(licence).toEqual({ tier: 'bigShip', cleanDockings: 2 })
  })
})
