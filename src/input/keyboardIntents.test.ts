import { describe, expect, it } from 'vitest'
import { HeldIntents } from './intents'
import { bindKeyboardIntents } from './keyboardIntents'

function keyEvent(type: 'keydown' | 'keyup', code: string): Event {
  const e = new Event(type)
  Object.defineProperty(e, 'code', { value: code })
  return e
}

describe('bindKeyboardIntents', () => {
  it('activates the mapped intent on keydown and clears it on keyup', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    bindKeyboardIntents(intents, target)

    expect(intents.isActive('portEngineAhead')).toBe(false)
    target.dispatchEvent(keyEvent('keydown', 'KeyW'))
    expect(intents.isActive('portEngineAhead')).toBe(true)
    target.dispatchEvent(keyEvent('keyup', 'KeyW'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })

  it('ignores unmapped keys', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    bindKeyboardIntents(intents, target)
    target.dispatchEvent(keyEvent('keydown', 'KeyZ'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
    expect(intents.isActive('bowThrusterLeft')).toBe(false)
  })

  it('the returned cleanup function removes the listeners', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    const cleanup = bindKeyboardIntents(intents, target)
    cleanup()
    target.dispatchEvent(keyEvent('keydown', 'KeyW'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })
})
