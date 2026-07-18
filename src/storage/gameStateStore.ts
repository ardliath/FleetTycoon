import { HERO_SHIPS } from '../ship/presets'
import type { CalendarState } from '../sim/calendar'
import { newCaptain, type Captain } from '../sim/crew'
import type { SailingOutcome } from '../sim/reliability'
import { newShipCondition, type ShipCondition } from '../sim/shipCondition'

/** A ship the player owns — a reference to a hero preset (by name, so
 * reordering `HERO_SHIPS` doesn't break a save) plus her own condition. */
export interface OwnedShip {
  id: string
  presetName: string
  condition: ShipCondition
}

/**
 * Persisted shape of the one-route contract. `masterSeed` plus
 * `sim/seed.ts`'s per-(day, purpose) derivation is what makes this
 * reload-safe without needing to persist RNG position — see seed.ts.
 *
 * `cash`/`fleet`/`crew`/`assignedShipId`/`assignedCaptainId` are Phase 3
 * additions — `load()` below defaults them for any save written before
 * Phase 3 existed, so an in-progress Phase 2 save isn't lost.
 */
export interface ContractGameState {
  masterSeed: number
  calendar: CalendarState
  history: SailingOutcome[]
  cash: number
  fleet: OwnedShip[]
  crew: Captain[]
  assignedShipId: string | null
  assignedCaptainId: string | null
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
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<ContractGameState> &
        Pick<ContractGameState, 'masterSeed' | 'calendar' | 'history'>
      // merge over defaults so a pre-Phase-3 save (missing the fleet/crew/
      // cash fields) loads instead of silently losing progress.
      return { ...newContractState(parsed.masterSeed), ...parsed }
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

/** Starting cash for a brand-new contract — enough to run the one route for
 * a while before a second ship is realistic. Untuned. */
const STARTING_CASH = 5000

/** A fresh contract state for a brand-new session, seeded from a
 * caller-supplied number (so callers — and tests — control reproducibility;
 * sim/ purity rules mean this file, being outside sim/, is the right place
 * to make the one Date.now()-flavoured choice of "what seed to start with").
 *
 * Starts with the one ship/captain Phase 1/2 already assumed (Isle of
 * Arran, a seasoned captain) so a new game is immediately playable rather
 * than opening on an empty fleet. */
export function newContractState(masterSeed: number): ContractGameState {
  const startingShip: OwnedShip = {
    id: 'ship-1',
    presetName: HERO_SHIPS[0].name,
    condition: newShipCondition(),
  }
  const startingCaptain: Captain = newCaptain('captain-1', 'Captain MacKay', 'seasoned')
  return {
    masterSeed,
    calendar: { day: 0, msIntoDay: 0 },
    history: [],
    cash: STARTING_CASH,
    fleet: [startingShip],
    crew: [startingCaptain],
    assignedShipId: startingShip.id,
    assignedCaptainId: startingCaptain.id,
  }
}
