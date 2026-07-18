/**
 * Day/week cadence for the reliability loop. Pure: advances from an
 * explicit elapsed-ms argument (the React boundary reads wall time via
 * requestAnimationFrame/Date.now and calls in — sim/ itself never does),
 * same discipline as src/sim/tick.ts.
 */
import type { Rng } from './rng'

/**
 * How long one game day takes in real time. docs/GAME_DESIGN.md's target
 * feel is 10-15 REAL MINUTES per day — deliberately not used here yet.
 * At that pace, playtesting a ~10-sailing reliability arc (this phase's own
 * exit criterion) would take 100-150 minutes per attempt, which makes
 * iterating on the *feel* of the loop impractical this early. This shorter
 * value is a build-time placeholder, exactly like Phase 1's untuned tick
 * size — revisit once actual open-water transit exists to fill a longer day
 * with something to watch.
 */
export const DAY_DURATION_MS = 45_000

export interface CalendarState {
  /** 0-indexed day count since the contract started. */
  day: number
  /** Elapsed ms within the current day, 0..DAY_DURATION_MS. */
  msIntoDay: number
}

export function initialCalendarState(): CalendarState {
  return { day: 0, msIntoDay: 0 }
}

/** Fraction of the current day elapsed, 0..1 — drives the UI's day-progress
 * display and decides when the docking notice fires. */
export function dayProgress(state: CalendarState, dayDurationMs: number = DAY_DURATION_MS): number {
  return Math.min(1, state.msIntoDay / dayDurationMs)
}

export interface AdvanceResult {
  state: CalendarState
  /** How many whole days were crossed this call (usually 0 or 1; more if
   * elapsedMs was large, e.g. returning from a backgrounded tab). */
  daysAdvanced: number
}

/** Advance the calendar by real elapsed milliseconds. Pure and exact for
 * any elapsedMs, including a large catch-up jump — the same shape as Phase
 * 0's tick accumulator, for the same reason (a backgrounded tab or, later,
 * offline catch-up shouldn't behave differently from many small calls). */
export function advanceCalendar(
  state: CalendarState,
  elapsedMs: number,
  dayDurationMs: number = DAY_DURATION_MS,
): AdvanceResult {
  const totalMs = state.day * dayDurationMs + state.msIntoDay + elapsedMs
  const day = Math.floor(totalMs / dayDurationMs)
  const msIntoDay = totalMs - day * dayDurationMs
  return { state: { day, msIntoDay }, daysAdvanced: day - state.day }
}

/** Weather severity for one day, 0..1. Rolled once per day so the forecast
 * shown to the player is the same value the sailing will actually resolve
 * against — no separate hidden roll later. */
export function rollWeather(rng: Rng): number {
  return rng.next()
}

export type ForecastLabel = 'calm' | 'moderate' | 'rough' | 'severe'

/** Bucket a raw severity into the label shown in the UI. */
export function forecastLabel(weather: number): ForecastLabel {
  if (weather < 0.25) return 'calm'
  if (weather < 0.5) return 'moderate'
  if (weather < 0.75) return 'rough'
  return 'severe'
}
