/**
 * Input-intent layer: every control surface (keyboard, mouse, future touch)
 * maps to these named intents rather than gameplay code binding directly to
 * DOM events. This is what keeps a future iPad port realistic — swap the
 * adapter (see keyboardIntents.ts for the keyboard one), keep every
 * consumer of intents unchanged.
 *
 * This is a Phase 0 scaffold establishing the shape, not the real docking
 * control set — Phase 1 will grow this into differential thrust + bow
 * thruster per docs/GAME_DESIGN.md. These two intents exist to prove the
 * pattern works end to end, not to be exhaustive.
 */

export type Intent = 'portEngineAhead' | 'bowThrusterLeft'

/** The set of intents currently "held" — true while a key/button is down.
 * Suits continuous controls like engine thrust, as opposed to one-shot
 * events like a menu click. Consumers (sim/ step functions) read this via
 * `isActive`; they never see the underlying keyboard/pointer/touch event. */
export interface IntentState {
  isActive(intent: Intent): boolean
}

export class HeldIntents implements IntentState {
  private active = new Set<Intent>()

  set(intent: Intent, held: boolean): void {
    if (held) this.active.add(intent)
    else this.active.delete(intent)
  }

  isActive(intent: Intent): boolean {
    return this.active.has(intent)
  }
}
