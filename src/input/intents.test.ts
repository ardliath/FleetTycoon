import { describe, expect, it } from 'vitest'
import { HeldIntents } from './intents'

describe('HeldIntents', () => {
  it('starts with nothing active', () => {
    const intents = new HeldIntents()
    expect(intents.isActive('portEngineAhead')).toBe(false)
    expect(intents.isActive('bowThrusterLeft')).toBe(false)
  })

  it('tracks each intent independently', () => {
    const intents = new HeldIntents()
    intents.set('portEngineAhead', true)
    expect(intents.isActive('portEngineAhead')).toBe(true)
    expect(intents.isActive('bowThrusterLeft')).toBe(false)
  })

  it('clears an intent when set to false', () => {
    const intents = new HeldIntents()
    intents.set('portEngineAhead', true)
    intents.set('portEngineAhead', false)
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })
})
