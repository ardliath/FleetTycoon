import type { FunnelStyle } from './types'

/** Per-style default horizontal shift of the funnel top, as a fraction of
 * height — used when the design doesn't specify an explicit topOffset. */
export const STYLE_SHIFT_FRAC: Record<FunnelStyle, number> = {
  classic: 0.1,
  drum: 0.05,
  raked: 0.32,
  flick: 0.18,
  modern: 0,
}

/** The effective top offset a funnel renders with (explicit, else style default). */
export function effectiveTopOffset(f: {
  style: FunnelStyle
  height: number
  topOffset?: number
}): number {
  return f.topOffset ?? STYLE_SHIFT_FRAC[f.style] * f.height
}
