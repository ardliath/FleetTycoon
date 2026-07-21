import { HERO_SHIPS } from '../ship/presets'
import type { CalendarState } from '../sim/calendar'
import { newCaptain, type Captain } from '../sim/crew'
import { initialLicence, type LicenceState } from '../sim/licence'
import type { SailingOutcome } from '../sim/reliability'
import { newShipCondition, type ShipCondition } from '../sim/shipCondition'

/** A ship the player owns — a reference to a hero preset (by name, so
 * reordering `HERO_SHIPS` doesn't break a save) plus her own condition. */
export interface OwnedShip {
  id: string
  presetName: string
  condition: ShipCondition
}

/** One active, committed route — a reference to a `RouteDefinition.id`
 * from the map content (e.g. `src/map/clyde.ts`) plus this company's own
 * history and crew assignment against it. Multiple can run at once,
 * sharing one calendar and one cash purse. */
export interface RouteContract {
  routeId: string
  history: SailingOutcome[]
  assignedShipId: string | null
  assignedCaptainId: string | null
}

/**
 * Persisted shape of the company's state. `masterSeed` plus
 * `sim/seed.ts`'s per-(day, purpose, routeId) derivation is what makes
 * this reload-safe without needing to persist RNG position — see seed.ts.
 *
 * `routes` (plural, Phase 4) replaced the single flat
 * `history`/`assignedShipId`/`assignedCaptainId` shape Phase 2/3 used —
 * `load()` below migrates that older shape into a single-element
 * `routes` array so an in-progress save isn't lost.
 */
export interface ContractGameState {
  masterSeed: number
  calendar: CalendarState
  cash: number
  fleet: OwnedShip[]
  crew: Captain[]
  routes: RouteContract[]
  /** The player's own captain's licence (sim/licence.ts) — gates which
   * ship classes they may personally take manual control of. */
  licence: LicenceState
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

/** The default route a brand-new game (or a pre-Phase-4 save being
 * migrated) starts on — the shortest, most sheltered Clyde crossing, a
 * gentle first route. */
const DEFAULT_ROUTE_ID = 'wemyss-bay-rothesay'

/** The flat, single-route shape Phase 2/3 saved — kept only so `load()`
 * can recognise and migrate it. */
interface LegacySingleRouteShape {
  masterSeed: number
  calendar: CalendarState
  history: SailingOutcome[]
  cash?: number
  fleet?: OwnedShip[]
  crew?: Captain[]
  assignedShipId?: string | null
  assignedCaptainId?: string | null
}

type PersistedContractShape = ContractGameState | LegacySingleRouteShape

function hasRoutesArray(p: PersistedContractShape): p is ContractGameState {
  return Array.isArray((p as ContractGameState).routes)
}

function hasLegacyHistory(p: PersistedContractShape): p is LegacySingleRouteShape {
  return Array.isArray((p as LegacySingleRouteShape).history)
}

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
      const parsed = JSON.parse(raw) as PersistedContractShape
      const fresh = newContractState(parsed.masterSeed)

      const routes: RouteContract[] = hasRoutesArray(parsed)
        ? parsed.routes
        : hasLegacyHistory(parsed)
          ? [
              {
                routeId: DEFAULT_ROUTE_ID,
                history: parsed.history,
                assignedShipId: parsed.assignedShipId ?? null,
                assignedCaptainId: parsed.assignedCaptainId ?? null,
              },
            ]
          : fresh.routes

      // merge over defaults so a save from an earlier phase (missing
      // cash/fleet/crew, or the flat pre-Phase-4 route shape) loads
      // instead of silently losing progress.
      const licenceRaw = (parsed as Partial<ContractGameState>).licence
      return {
        masterSeed: parsed.masterSeed,
        calendar: parsed.calendar ?? fresh.calendar,
        cash: typeof parsed.cash === 'number' ? parsed.cash : fresh.cash,
        fleet: Array.isArray(parsed.fleet) ? parsed.fleet : fresh.fleet,
        crew: Array.isArray(parsed.crew) ? parsed.crew : fresh.crew,
        routes,
        licence: licenceRaw && typeof licenceRaw === 'object' ? licenceRaw : fresh.licence,
      }
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

/** Starting cash for a brand-new contract — enough to run one route for a
 * while before a second ship or route is realistic. Untuned. */
const STARTING_CASH = 5000

/** A fresh contract state for a brand-new session, seeded from a
 * caller-supplied number (so callers — and tests — control reproducibility;
 * sim/ purity rules mean this file, being outside sim/, is the right place
 * to make the one Date.now()-flavoured choice of "what seed to start with").
 *
 * Starts with one ship/captain and one route already committed (the
 * default Clyde crossing) so a new game is immediately playable rather
 * than opening on an empty company. */
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
    cash: STARTING_CASH,
    fleet: [startingShip],
    crew: [startingCaptain],
    licence: initialLicence(),
    routes: [
      {
        routeId: DEFAULT_ROUTE_ID,
        history: [],
        assignedShipId: startingShip.id,
        assignedCaptainId: startingCaptain.id,
      },
    ],
  }
}
