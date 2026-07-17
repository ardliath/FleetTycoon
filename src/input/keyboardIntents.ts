import { HeldIntents, type Intent } from './intents'

/**
 * Keyboard adapter for the docking controls. Two-handed twin-screw layout:
 *   left hand works the port engine, right hand the starboard engine,
 *   and the bow thruster nudges the bow sideways.
 *
 *   Q / A  — port engine ahead / astern
 *   E / D  — starboard engine ahead / astern
 *   Z / C  — bow thruster push bow to port (left) / starboard (right)
 *   X      — both engines to stop
 *
 * A future pointer/touch adapter would call the same `intents.set(...)`;
 * nothing downstream needs to know which adapter fired.
 */
const KEY_TO_INTENT: Record<string, Intent> = {
  KeyQ: 'portEngineAhead',
  KeyA: 'portEngineAstern',
  KeyE: 'stbdEngineAhead',
  KeyD: 'stbdEngineAstern',
  KeyZ: 'bowThrusterLeft',
  KeyC: 'bowThrusterRight',
  KeyX: 'enginesStop',
}

/** Wires keydown/keyup on `target` to update `intents`. Returns a cleanup
 * function to remove the listeners. */
export function bindKeyboardIntents(intents: HeldIntents, target: EventTarget = window): () => void {
  const onKeyDown = (e: Event) => {
    const intent = KEY_TO_INTENT[(e as KeyboardEvent).code]
    if (intent) {
      intents.set(intent, true)
      // don't let game keys scroll the page etc.
      ;(e as KeyboardEvent).preventDefault?.()
    }
  }
  const onKeyUp = (e: Event) => {
    const intent = KEY_TO_INTENT[(e as KeyboardEvent).code]
    if (intent) intents.set(intent, false)
  }
  // if the window loses focus mid-press, we never get the keyup — clear all.
  const onBlur = () => intents.clear()

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  target.addEventListener('blur', onBlur)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
    target.removeEventListener('blur', onBlur)
  }
}

/** Read the current intent state into the plain input flags that
 * sim/docking's pure `advanceControls` expects — the boundary between the
 * input layer and the (framework-free) sim. */
export function readDockingInputs(intents: { isActive(i: Intent): boolean }) {
  return {
    portAhead: intents.isActive('portEngineAhead'),
    portAstern: intents.isActive('portEngineAstern'),
    stbdAhead: intents.isActive('stbdEngineAhead'),
    stbdAstern: intents.isActive('stbdEngineAstern'),
    bowLeft: intents.isActive('bowThrusterLeft'),
    bowRight: intents.isActive('bowThrusterRight'),
    enginesStop: intents.isActive('enginesStop'),
  }
}
