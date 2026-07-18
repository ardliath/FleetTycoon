import { describe, expect, it } from 'vitest'
import { LocalStorageGameStateStore, newContractState, type ContractGameState } from './gameStateStore'

/** Minimal in-memory Storage fake — Node has no global localStorage, and
 * this is small enough not to need jsdom for it. */
function fakeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

describe('newContractState', () => {
  it('starts at day 0 with one route and an empty history', () => {
    const state = newContractState(42)
    expect(state.masterSeed).toBe(42)
    expect(state.calendar).toEqual({ day: 0, msIntoDay: 0 })
    expect(state.routes).toHaveLength(1)
    expect(state.routes[0].history).toEqual([])
  })

  it('starts with one ship and one captain, both assigned to the starting route, and starting cash', () => {
    const state = newContractState(42)
    expect(state.fleet).toHaveLength(1)
    expect(state.crew).toHaveLength(1)
    expect(state.routes[0].assignedShipId).toBe(state.fleet[0].id)
    expect(state.routes[0].assignedCaptainId).toBe(state.crew[0].id)
    expect(state.cash).toBeGreaterThan(0)
  })
})

describe('LocalStorageGameStateStore', () => {
  it('load() returns null when nothing has been saved', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    expect(store.load()).toBeNull()
  })

  it('round-trips a saved state exactly', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    const state: ContractGameState = newContractState(7)
    store.save(state)
    expect(store.load()).toEqual(state)
  })

  it('loads a pre-Phase-3 save (missing fleet/crew/cash, flat history) by defaulting and migrating it', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    const phase2Shape = {
      masterSeed: 7,
      calendar: { day: 3, msIntoDay: 12000 },
      history: ['onTime', 'late', 'cancelled'],
    }
    store.save(phase2Shape as unknown as ContractGameState)
    const loaded = store.load()
    expect(loaded?.calendar).toEqual(phase2Shape.calendar)
    expect(loaded?.fleet).toHaveLength(1)
    expect(loaded?.crew).toHaveLength(1)
    expect(loaded?.cash).toBeGreaterThan(0)
    expect(loaded?.routes).toHaveLength(1)
    expect(loaded?.routes[0].history).toEqual(phase2Shape.history)
  })

  it('loads a pre-Phase-4 save (flat history, but with Phase 3 fleet/crew/cash) by migrating just the route shape', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    const phase3Shape = {
      masterSeed: 9,
      calendar: { day: 5, msIntoDay: 0 },
      history: ['onTime', 'onTime'],
      cash: 12345,
      fleet: [{ id: 'ship-x', presetName: 'Isle of Arran', condition: { score: 0.8, drydockUntilDay: null } }],
      crew: [{ id: 'captain-x', name: 'Captain X', tier: 'veteran', sailingsLogged: 10 }],
      assignedShipId: 'ship-x',
      assignedCaptainId: 'captain-x',
    }
    store.save(phase3Shape as unknown as ContractGameState)
    const loaded = store.load()
    expect(loaded?.cash).toBe(12345)
    expect(loaded?.fleet).toEqual(phase3Shape.fleet)
    expect(loaded?.crew).toEqual(phase3Shape.crew)
    expect(loaded?.routes).toHaveLength(1)
    expect(loaded?.routes[0].history).toEqual(phase3Shape.history)
    expect(loaded?.routes[0].assignedShipId).toBe('ship-x')
    expect(loaded?.routes[0].assignedCaptainId).toBe('captain-x')
  })

  it('clear() removes the saved state', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    store.save(newContractState(1))
    expect(store.load()).not.toBeNull()
    store.clear()
    expect(store.load()).toBeNull()
  })

  it('a corrupted stored value is treated as no saved state, not a crash', () => {
    const backend = fakeStorage()
    backend.setItem('fleet-tycoon:contract', '{not valid json')
    const store = new LocalStorageGameStateStore(backend)
    expect(store.load()).toBeNull()
  })

  it('a backend that throws on save does not throw out of the store', () => {
    const throwing: Storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    }
    const store = new LocalStorageGameStateStore(throwing)
    expect(() => store.save(newContractState(1))).not.toThrow()
  })
})
