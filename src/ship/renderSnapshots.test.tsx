/**
 * Golden-snapshot tests for the ship renderers. These exist to catch
 * accidental regressions in the SVG output of ShipSideView/ShipTopView —
 * we've twice shipped a bug that silently reshaped an existing hero preset
 * (a phantom third deck, a funnel a storey too high) and only caught it
 * because Adam knows what these ships look like. This is that safety net.
 *
 * IMPORTANT — how to update a failing snapshot:
 * A failing snapshot means one of two things: (1) a regression — go fix the
 * code, or (2) an intentional change (you tuned a preset, or changed a
 * renderer on purpose). For (2): open the Shipyard/Fleet tab, eyeball the
 * affected ship(s) in the browser FIRST, confirm they look right, and only
 * then run `npx vitest run -u` to accept the new snapshot. Never run -u
 * blind just to make a red test green — that turns this whole safety net
 * into noise. If a preset update changes ONLY that ship's snapshot, that's
 * expected. If it changes a DIFFERENT ship's snapshot too, stop — that's a
 * real regression in shared rendering code.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HERO_SHIPS } from './presets'
import { ShipSideView } from './ShipSideView'
import { ShipTopView } from './ShipTopView'

describe.each(HERO_SHIPS)('$name', (design) => {
  it('side profile matches its snapshot', () => {
    expect(renderToStaticMarkup(<ShipSideView design={design} />)).toMatchSnapshot()
  })

  it('deck plan matches its snapshot', () => {
    expect(renderToStaticMarkup(<ShipTopView design={design} />)).toMatchSnapshot()
  })
})
