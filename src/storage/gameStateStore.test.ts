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
})

describe('LocalStorageGameStateStore', () => {
  it('load() returns null when nothing has been saved', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    expect(store.load()).toBeNull()
  })

  it('round-trips a saved state exactly', () => {
    const store = new LocalStorageGameStateStore(fakeStorage())
    const state: ContractGameState = {
      masterSeed: 7,
      calendar: { day: 3, msIntoDay: 12000 },
      history: ['onTime', 'late', 'cancelled'],
    }
    store.save(state)
    expect(store.load()).toEqual(state)
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
