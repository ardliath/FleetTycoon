import { describe, expect, it } from 'vitest'
import { HERO_SHIPS } from '../ship/presets'
import { shipTopDataUri, shipTopSvgString } from './shipTexture'

const arran = HERO_SHIPS[0]

describe('shipTopSvgString', () => {
  it('is a standalone SVG with xmlns and explicit intrinsic dimensions', () => {
    const svg = shipTopSvgString(arran)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    // explicit width/height are essential: an SVG with only a viewBox
    // rasterises degenerately as an <img> (the "solid black block" bug).
    expect(svg).toMatch(/<svg[^>]*\bwidth="\d+"/)
    expect(svg).toMatch(/<svg[^>]*\bheight="\d+"/)
    // exactly one xmlns (no accidental double-inject)
    expect(svg.match(/xmlns=/g)?.length).toBe(1)
  })

  it('omits the sea backdrop so texture margins are transparent', () => {
    // With background=false there should be no full-viewport 140x26 sea rect.
    const withBg = shipTopSvgString(arran)
    expect(withBg).not.toContain('width="140" height="26" fill="#c9dce8"')
  })

  it('still contains the hull (the ship actually rendered)', () => {
    // hull fill colour from the palette
    expect(shipTopSvgString(arran)).toContain('#151a21')
  })
})

describe('shipTopDataUri', () => {
  it('produces a decodable image/svg+xml data URI', () => {
    const uri = shipTopDataUri(arran)
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true)
    const decoded = decodeURIComponent(uri.slice('data:image/svg+xml,'.length))
    expect(decoded).toContain('<svg')
    expect(decoded).toContain('xmlns=')
  })
})
