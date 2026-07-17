/**
 * Input-intent layer: every control surface (keyboard, mouse, future touch)
 * maps to these named intents rather than gameplay code binding directly to
 * DOM events. This is what keeps a future iPad port realistic — swap the
 * adapter (see keyboardIntents.ts for the keyboard one), keep every
 * consumer of intents unchanged.
 *
 * The docking-control intents below are the twin-screw scheme from
 * docs/GAME_DESIGN.md: two independent engine levers (ahead/astern) plus a
 * bow thruster (left/right), no rudder. The engines are persistent levers
 * (they hold their setting); the thruster is momentary. That persistence
 * lives in sim/docking's control state, not here — intents only report what
 * is being held right now.
 */

export type Intent =
  | 'portEngineAhead'
  | 'portEngineAstern'
  | 'stbdEngineAhead'
  | 'stbdEngineAstern'
  | 'bowThrusterLeft'
  | 'bowThrusterRight'
  | 'enginesStop'

/** The set of intents currently "held" — true while a key/button is down.
 * Suits continuous controls like engine thrust, as opposed to one-shot
 * events like a menu click. Consumers read this via `isActive`; they never
 * see the underlying keyboard/pointer/touch event. */
export interface IntentState {
  isActive(intent: Intent): boolean
}

export class HeldIntents implements IntentState {
  private active = new Set<Intent>()

  set(intent: Intent, held: boolean): void {
    if (held) this.active.add(intent)
    else this.active.delete(intent)
  }

  /** Release everything — e.g. when the game view loses focus, so a key
   * "sticks" down no longer than the window is focused. */
  clear(): void {
    this.active.clear()
  }

  isActive(intent: Intent): boolean {
    return this.active.has(intent)
  }
}
