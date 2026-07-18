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
  it('starts at day 0 with an empty history', () => {
    const state = newContractState(42)
    expect(state.masterSeed).toBe(42)
    expect(state.calendar).toEqual({ day: 0, msIntoDay: 0 })
    expect(state.history).toEqual([])
  })

  it('starts with one ship and one captain, both assigned, and starting cash', () => {
    const state = newContractState(42)
    expect(state.fleet).toHaveLength(1)
    expect(state.crew).toHaveLength(1)
    expect(state.assignedShipId).toBe(state.fleet[0].id)
    expect(state.assignedCaptainId).toBe(state.crew[0].id)
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

  it('loads a pre-Phase-3 save missing fleet/crew/cash by defaulting them, without losing history', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    const phase2Shape = {
      masterSeed: 7,
      calendar: { day: 3, msIntoDay: 12000 },
      history: ['onTime', 'late', 'cancelled'] as ContractGameState['history'],
    }
    store.save(phase2Shape as ContractGameState)
    const loaded = store.load()
    expect(loaded?.history).toEqual(phase2Shape.history)
    expect(loaded?.calendar).toEqual(phase2Shape.calendar)
    expect(loaded?.fleet).toHaveLength(1)
    expect(loaded?.crew).toHaveLength(1)
    expect(loaded?.cash).toBeGreaterThan(0)
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
