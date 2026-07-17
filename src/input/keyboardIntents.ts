import { HeldIntents, type Intent } from './intents'

/** Example keyboard adapter: maps physical keys to intents. Not the final
 * Phase 1 docking scheme — just enough to prove keyboard -> intent works.
 * A future pointer/touch adapter would call the same `intents.set(...)`,
 * nothing downstream needs to know or care which adapter fired. */
const KEY_TO_INTENT: Record<string, Intent> = {
  KeyW: 'portEngineAhead',
  KeyA: 'bowThrusterLeft',
}

/** Wires keydown/keyup on `target` to update `intents`. Returns a cleanup
 * function to remove the listeners. */
export function bindKeyboardIntents(intents: HeldIntents, target: EventTarget = window): () => void {
  const onKeyDown = (e: Event) => {
    const intent = KEY_TO_INTENT[(e as KeyboardEvent).code]
    if (intent) intents.set(intent, true)
  }
  const onKeyUp = (e: Event) => {
    const intent = KEY_TO_INTENT[(e as KeyboardEvent).code]
    if (intent) intents.set(intent, false)
  }
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
  }
}
