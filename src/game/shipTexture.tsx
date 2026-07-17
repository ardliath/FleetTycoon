import { renderToStaticMarkup } from 'react-dom/server'
import { ShipTopView } from '../ship/ShipTopView'
import type { ShipDesign } from '../ship/types'

/**
 * Bridges the ship builder's SVG render into a Phaser texture — the "one
 * source of truth" made real: the in-game ship sprite IS ShipTopView's
 * output, not a separately-drawn asset.
 *
 * The top view's viewBox is 140x26 metres with the hull centred at (70, 13),
 * i.e. dead centre of the viewBox. So a Phaser sprite made from this texture,
 * with origin (0.5, 0.5), rotates about the ship's centre — good enough as
 * the CG for Phase 1. Bow points -x (left) in the texture; the sim has bow at
 * +x, so the scene offsets sprite rotation by pi (see DockingScene).
 */
export const SHIP_TEXTURE_VIEWBOX = { widthM: 140, heightM: 26 } as const

/** Pixels per viewBox-metre when rasterising — sets texture crispness. */
const TEXTURE_PPM = 12

/** ShipTopView rendered to a standalone SVG string: no sea backdrop
 * (transparent margins), a guaranteed xmlns, and explicit pixel width/height.
 * The intrinsic size matters — an SVG with only a viewBox and no width/height
 * rasterises degenerately when loaded as an <img>, which is what a data-URI
 * texture does. */
export function shipTopSvgString(design: ShipDesign): string {
  const svg = renderToStaticMarkup(<ShipTopView design={design} background={false} />)
  const w = SHIP_TEXTURE_VIEWBOX.widthM * TEXTURE_PPM
  const h = SHIP_TEXTURE_VIEWBOX.heightM * TEXTURE_PPM
  const attrs = `xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `
  return svg.replace('<svg ', `<svg ${attrs}`)
}

/** A data URI suitable for Phaser's `this.load.svg(key, uri, { width, height })`. */
export function shipTopDataUri(design: ShipDesign): string {
  return 'data:image/svg+xml,' + encodeURIComponent(shipTopSvgString(design))
}
