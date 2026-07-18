import type { CalendarState } from '../sim/calendar'
import type { SailingOutcome } from '../sim/reliability'

/**
 * Persisted shape of the one-route contract Phase 2 tracks. `masterSeed`
 * plus `sim/seed.ts`'s per-(day, purpose) derivation is what makes this
 * reload-safe without needing to persist RNG position — see seed.ts.
 */
export interface ContractGameState {
  masterSeed: number
  calendar: CalendarState
  history: SailingOutcome[]
}

/** Persistence boundary for company/contract state — same swappable-
 * interface pattern as the ship builder's DesignStore (src/ship/storage.ts).
 * Swap the implementation (a backend, a file, ...) without touching the UI. */
export interface GameStateStore {
  load(): ContractGameState | null
  save(state: ContractGameState): void
  /** Wipe saved state — e.g. starting a fresh contract after losing one. */
  clear(): void
}

const CONTRACT_KEY = 'fleet-tycoon:contract'

/** The slice of the Storage interface actually used — small enough to
 * inject a fake in tests without pulling in jsdom, since save/load
 * silently failing is exactly the kind of bug worth a real test for. */
type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export class LocalStorageGameStateStore implements GameStateStore {
  private backend: StorageBackend

  constructor(backend: StorageBackend = globalThis.localStorage) {
    this.backend = backend
  }

  load(): ContractGameState | null {
    try {
      const raw = this.backend.getItem(CONTRACT_KEY)
      return raw ? (JSON.parse(raw) as ContractGameState) : null
    } catch {
      return null
    }
  }

  save(state: ContractGameState): void {
    try {
      this.backend.setItem(CONTRACT_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Could not persist contract state', e)
    }
  }

  clear(): void {
    try {
      this.backend.removeItem(CONTRACT_KEY)
    } catch {
      // nothing to do — if we couldn't remove it, a fresh save will overwrite it
    }
  }
}

export const gameStateStore: GameStateStore = new LocalStorageGameStateStore()

/** A fresh contract state for a brand-new session, seeded from a
 * caller-supplied number (so callers — and tests — control reproducibility;
 * sim/ purity rules mean this file, being outside sim/, is the right place
 * to make the one Date.now()-flavoured choice of "what seed to start with"). */
export function newContractState(masterSeed: number): ContractGameState {
  return {
    masterSeed,
    calendar: { day: 0, msIntoDay: 0 },
    history: [],
  }
}
