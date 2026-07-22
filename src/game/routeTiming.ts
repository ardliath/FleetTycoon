/**
 * Shared day-progress timing for a route's daily crossing — the single
 * source of truth for both the notice/resolution logic (GameContext) and
 * the Map tab's live ship animation, so they stay in sync.
 *
 * The sim only ever computed one outcome per route per day; there was no
 * explicit departure/arrival moment. These add one: a ship departs her
 * origin port, sails out and back, and arrives (visually) at the far berth
 * right when the existing notice/auto-resolve window closes, resting at the
 * origin port either side of the round trip. This is a one-day round-trip
 * abstraction, not a full there-and-back simulation — the outcome model
 * doesn't track direction.
 *
 * The crossing *duration* scales with the route's real sailing distance
 * (see `departAtForDistance`): a long passage like Oban–Colonsay visibly
 * takes far longer to cross than a short hop like Claonaig–Lochranza,
 * rather than every route taking the same fixed slice of the day. Arrival
 * stays pinned to AUTO_RESOLVE_AT so the docking outcome still resolves the
 * moment she reaches the berth, whatever the crossing length.
 */

/** Day-progress fraction at which a route's notice fires. Fixed (not
 * distance-scaled) on purpose: the player needs a roughly constant real
 * heads-up to decide whether to take the helm, regardless of how long the
 * crossing itself is. */
export const NOTICE_AT = 0.7
/** Day-progress fraction by which the captain resolves automatically if
 * the player hasn't taken control. */
export const AUTO_RESOLVE_AT = 0.88

/** Day-progress fraction by which the ship has visually arrived at the far
 * berth — matches AUTO_RESOLVE_AT, so the crossing completes right as the
 * day's outcome resolves, whether manually or automatically. Departure is
 * derived backwards from here per route (see `departAtForDistance`). */
export const ARRIVE_AT = AUTO_RESOLVE_AT

/** Shortest and longest a single crossing leg may occupy of the day. The
 * max is bounded by the round trip having to finish before the day rolls
 * over: with arrival pinned at ARRIVE_AT (0.88), an equal-length return
 * leg has to fit in the remaining 0.12. The min keeps the very shortest
 * hops from becoming an invisible blink. */
const MIN_CROSSING_LEG = 0.03
const MAX_CROSSING_LEG = 1 - AUTO_RESOLVE_AT // 0.12

/** Nominal crossing pace, day-fractions of sailing per km. Calibrated so
 * the longest real route in the network (~57km, Oban–Colonsay) fills a
 * full MAX_CROSSING_LEG and a mid-length one (~25km) sits around half that
 * — a real, legible spread across the fleet's routes. Not a per-ship
 * speed yet: every ship crosses a given route in the same time until ships
 * carry a real speed stat (a natural later refinement, alongside the
 * per-class ship handling work). */
const DAY_FRACTION_PER_KM = 0.0022

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** How much of the day one crossing leg of the given distance occupies,
 * clamped to the visible/fits-in-a-day range above. */
export function crossingLegFraction(distanceKm: number): number {
  return clamp(distanceKm * DAY_FRACTION_PER_KM, MIN_CROSSING_LEG, MAX_CROSSING_LEG)
}

/** Day-progress fraction at which a ship on a route of the given distance
 * departs her origin — derived backwards from the fixed ARRIVE_AT so the
 * outbound leg lasts `crossingLegFraction(distance)`. Longer route → earlier
 * departure → longer visible crossing. */
export function departAtForDistance(distanceKm: number): number {
  return ARRIVE_AT - crossingLegFraction(distanceKm)
}
