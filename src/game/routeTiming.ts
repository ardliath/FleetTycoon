/**
 * Shared day-progress timing for a route's daily crossing — the single
 * source of truth for both the notice/resolution logic (GameContext) and
 * the Map tab's live ship animation, so they stay in sync.
 *
 * The sim only ever computed one outcome per route per day; there was no
 * explicit departure/arrival moment. These add one: a ship departs her
 * origin port partway through the day and arrives (visually) right around
 * when the existing notice/auto-resolve window closes, then rests at the
 * origin port for the remainder of the day until the next cycle. This is
 * a one-way daily crossing abstraction, not a full there-and-back
 * simulation — the outcome model doesn't track direction.
 */

/** Day-progress fraction at which a route's notice fires. */
export const NOTICE_AT = 0.7
/** Day-progress fraction by which the captain resolves automatically if
 * the player hasn't taken control. */
export const AUTO_RESOLVE_AT = 0.88

/** Day-progress fraction at which the assigned ship departs her origin
 * port — chosen so the notice ("approaching the berth") fires partway
 * across the crossing, not right at departure. */
export const DEPART_AT = 0.55
/** Day-progress fraction by which she's visually arrived — matches
 * AUTO_RESOLVE_AT, so the crossing completes right as the day's outcome
 * resolves, whether manually or automatically. */
export const ARRIVE_AT = AUTO_RESOLVE_AT
