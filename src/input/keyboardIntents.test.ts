import { describe, expect, it } from 'vitest'
import { HeldIntents } from './intents'
import { bindKeyboardIntents, readDockingInputs } from './keyboardIntents'

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
    target.dispatchEvent(keyEvent('keydown', 'KeyQ'))
    expect(intents.isActive('portEngineAhead')).toBe(true)
    target.dispatchEvent(keyEvent('keyup', 'KeyQ'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })

  it('maps the full twin-screw scheme', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    bindKeyboardIntents(intents, target)
    const pressed: Array<[string, Parameters<typeof intents.isActive>[0]]> = [
      ['KeyQ', 'portEngineAhead'],
      ['KeyA', 'portEngineAstern'],
      ['KeyE', 'stbdEngineAhead'],
      ['KeyD', 'stbdEngineAstern'],
      ['KeyZ', 'bowThrusterLeft'],
      ['KeyC', 'bowThrusterRight'],
      ['KeyX', 'enginesStop'],
    ]
    for (const [code, intent] of pressed) {
      target.dispatchEvent(keyEvent('keydown', code))
      expect(intents.isActive(intent)).toBe(true)
    }
  })

  it('ignores unmapped keys', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    bindKeyboardIntents(intents, target)
    target.dispatchEvent(keyEvent('keydown', 'KeyP'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })

  it('a blur event releases all held keys (no stuck controls on focus loss)', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    bindKeyboardIntents(intents, target)
    target.dispatchEvent(keyEvent('keydown', 'KeyQ'))
    target.dispatchEvent(new Event('blur'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })

  it('the returned cleanup function removes the listeners', () => {
    const target = new EventTarget()
    const intents = new HeldIntents()
    const cleanup = bindKeyboardIntents(intents, target)
    cleanup()
    target.dispatchEvent(keyEvent('keydown', 'KeyQ'))
    expect(intents.isActive('portEngineAhead')).toBe(false)
  })
})

describe('readDockingInputs', () => {
  it('projects intent state into the plain flags the sim expects', () => {
    const intents = new HeldIntents()
    intents.set('portEngineAhead', true)
    intents.set('bowThrusterRight', true)
    const inputs = readDockingInputs(intents)
    expect(inputs).toEqual({
      portAhead: true,
      portAstern: false,
      stbdAhead: false,
      stbdAstern: false,
      bowLeft: false,
      bowRight: true,
      enginesStop: false,
    })
  })
})
