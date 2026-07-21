import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/GameContext'
import { routeSeaPath, shipDesignFor } from '../game/routeHelpers'
import { ARRIVE_AT, DEPART_AT } from '../game/routeTiming'
import { bindCameraIntents } from '../input/cameraIntents'
import { CLYDE_PORTS } from '../map/clyde'
import { ALL_COASTLINE, ALL_DEPTH_CONTOURS, ALL_HAZARD_ZONES, ALL_PORTS, ALL_ROUTES } from '../map/regions'
import { dayProgress } from '../sim/calendar'
import { projectPort, shipPositionForDay, unprojectPoint, type Point } from '../sim/geography'
import { isInDrydock } from '../sim/shipCondition'
import './mapView.css'

/**
 * A real Admiralty-chart-inspired rendering of Scottish waters — one
 * continuous map, not a sheet per region (see src/map/regions.ts for how
 * each region's data merges in): a real lat/lon graticule, a compass
 * rose, a title cartouche, a scale bar derived from the actual
 * projection, every region's authored hazard zones, and each active
 * route's assigned ship animated across her crossing window (see
 * src/game/routeTiming.ts for what that window means and why it exists —
 * the sim never had an explicit departure/arrival moment before this).
 *
 * Land shapes (src/map/*Coastline.ts, one file per region) are real
 * OpenStreetMap coastline data, simplified — not hand-drawn. Islands and
 * mainland both render filled; see clydeCoastline.ts's comment for how
 * mainland pieces (clipped by the data's query box) get closed into real
 * polygons rather than left as open linework.
 *
 * Depth contours (src/map/*DepthContours.ts) are real isobaths — marching
 * squares run over an EMODnet Bathymetry raster grid per region, not
 * decoration and not point soundings.
 *
 * The camera (pan/zoom) is state, not a fixed viewBox: `camera` holds a
 * centre point and a width in km, and everything else (viewBox bounds,
 * graticule step, scale-bar value, chrome sizing) derives from it each
 * render. Wheel-to-zoom and drag-to-pan come from src/input/cameraIntents.ts
 * — MapView never binds wheel/pointer events directly, per CLAUDE.md's
 * input-intent rule. The default view still frames the Clyde specifically
 * (it's the game's home port), but panning/zooming out reaches whichever
 * regions have been added so far; empty water beyond that is the camera
 * mechanism working ahead of the data, not a bug.
 *
 * Text and "chrome" (compass, cartouche, scale-bar ticks) are sized in km
 * proportional to the current zoom (`zoomScale`) so they stay a roughly
 * constant apparent size on screen rather than ballooning or vanishing as
 * you zoom — real geometry (coastline, contours, routes, hazard zone
 * radii) is left as true km, so it legitimately gets bigger or smaller
 * with zoom like real map content. Stroke widths are not yet
 * zoom-compensated (a known, minor follow-up).
 */

const PADDING_KM = 24
const MIN_WIDTH_KM = 8
const MAX_WIDTH_KM = 900
// generous sanity box so panning can't scroll into unbounded empty space;
// roughly covers the Clyde up to Shetland with margin. Not meant to be
// exact — tightens naturally in feel once more regions have data.
const PAN_BOUNDS = { minX: -520, maxX: 40, minY: 5950, maxY: 6900 }
const NICE_DEG_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]
const NICE_SCALE_KM = [1, 2, 5, 10, 20, 50, 100, 200, 500]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Pick a "nice" round step (degrees of lat/lon, or km for the scale bar)
 * so the chosen value stays proportionate to the current zoom instead of
 * a fixed step that's either far too dense zoomed out or far too sparse
 * zoomed in. */
function pickNiceStep(target: number, steps: number[]): number {
  return steps.find((s) => s >= target) ?? steps[steps.length - 1]
}

function computeDefaultView() {
  const xs = CLYDE_PORTS.map((p) => projectPort(p).x)
  const ys = CLYDE_PORTS.map((p) => projectPort(p).y)
  const minX = Math.min(...xs) - PADDING_KM
  const maxX = Math.max(...xs) + PADDING_KM
  const minY = Math.min(...ys) - PADDING_KM
  const maxY = Math.max(...ys) + PADDING_KM
  const widthKm = maxX - minX
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    widthKm,
    aspect: (maxY - minY) / widthKm,
  }
}

const DEFAULT_VIEW = computeDefaultView()

function toDegMin(value: number): { deg: number; min: number } {
  const deg = Math.floor(value)
  const min = Math.round((value - deg) * 60)
  return min === 60 ? { deg: deg + 1, min: 0 } : { deg, min }
}

function formatLat(lat: number): string {
  const { deg, min } = toDegMin(lat)
  return `${deg}°${String(min).padStart(2, '0')}'N`
}

function formatLon(lonAbsWest: number): string {
  const { deg, min } = toDegMin(lonAbsWest)
  return `${deg}°${String(min).padStart(2, '0')}'W`
}

export function MapView() {
  const { contract } = useGame()
  const svgRef = useRef<SVGSVGElement>(null)
  const [camera, setCamera] = useState({
    centerX: DEFAULT_VIEW.centerX,
    centerY: DEFAULT_VIEW.centerY,
    widthKm: DEFAULT_VIEW.widthKm,
  })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    return bindCameraIntents(svg, (intent) => {
      if (intent.type === 'zoom') {
        setCamera((prev) => {
          const rect = svg.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) return prev
          const prevHeightKm = prev.widthKm * DEFAULT_VIEW.aspect
          const prevMinX = prev.centerX - prev.widthKm / 2
          const prevMaxY = prev.centerY + prevHeightKm / 2
          const fx = intent.anchorPx.x / rect.width
          const fy = intent.anchorPx.y / rect.height
          const anchorKmX = prevMinX + fx * prev.widthKm
          const anchorKmY = prevMaxY - fy * prevHeightKm
          const newWidthKm = clamp(prev.widthKm * intent.factor, MIN_WIDTH_KM, MAX_WIDTH_KM)
          const newHeightKm = newWidthKm * DEFAULT_VIEW.aspect
          const newMinX = anchorKmX - fx * newWidthKm
          const newMaxY = anchorKmY + fy * newHeightKm
          return {
            centerX: clamp(newMinX + newWidthKm / 2, PAN_BOUNDS.minX, PAN_BOUNDS.maxX),
            centerY: clamp(newMaxY - newHeightKm / 2, PAN_BOUNDS.minY, PAN_BOUNDS.maxY),
            widthKm: newWidthKm,
          }
        })
      } else {
        setCamera((prev) => {
          const rect = svg.getBoundingClientRect()
          if (rect.width === 0) return prev
          const pxPerKm = rect.width / prev.widthKm
          const dxKm = intent.dxPx / pxPerKm
          const dyKm = intent.dyPx / pxPerKm
          return {
            ...prev,
            centerX: clamp(prev.centerX - dxKm, PAN_BOUNDS.minX, PAN_BOUNDS.maxX),
            centerY: clamp(prev.centerY + dyKm, PAN_BOUNDS.minY, PAN_BOUNDS.maxY),
          }
        })
      }
    })
  }, [])

  const heightKm = camera.widthKm * DEFAULT_VIEW.aspect
  const minX = camera.centerX - camera.widthKm / 2
  const maxX = camera.centerX + camera.widthKm / 2
  const minY = camera.centerY - heightKm / 2
  const maxY = camera.centerY + heightKm / 2
  const width = camera.widthKm
  const height = heightKm
  // how far the current zoom is from the default Clyde framing — used to
  // keep text and chrome a roughly constant apparent size, see the file
  // doc comment above.
  const zoomScale = camera.widthKm / DEFAULT_VIEW.widthKm

  const points = ALL_PORTS.map((port) => ({ port, xy: projectPort(port) }))

  // sim space has y growing north; SVG has y growing down the screen.
  const toSvg = (p: Point) => ({ x: p.x - minX, y: maxY - p.y })

  const activeRouteIds = new Set(contract.routes.map((r) => r.routeId))
  const progress = dayProgress(contract.calendar)

  // graticule: real lat/lon lines at a step sized to the current zoom,
  // labelled with the coordinates they actually are.
  const swLatLon = unprojectPoint({ x: minX, y: minY })
  const neLatLon = unprojectPoint({ x: maxX, y: maxY })
  const latStepDeg = pickNiceStep((neLatLon.lat - swLatLon.lat) / 6, NICE_DEG_STEPS)
  const lonStepDeg = pickNiceStep((neLatLon.lon - swLatLon.lon) / 6, NICE_DEG_STEPS)
  const latLines: number[] = []
  for (let lat = Math.ceil(swLatLon.lat / latStepDeg) * latStepDeg; lat <= neLatLon.lat; lat += latStepDeg) {
    latLines.push(lat)
  }
  const lonLines: number[] = []
  for (let lon = Math.ceil(swLatLon.lon / lonStepDeg) * lonStepDeg; lon <= neLatLon.lon; lon += lonStepDeg) {
    lonLines.push(lon)
  }

  // scale bar: a round number of km sized to stay a sensible fraction of
  // the current view, not a fixed value that's meaningless zoomed way out.
  const scaleKm = pickNiceStep(width * 0.2, NICE_SCALE_KM)
  const chromePad = 11 * zoomScale
  const scaleBarX = width - chromePad - scaleKm
  const scaleBarY = height - chromePad

  const cartoucheWidth = 20 * zoomScale
  const cartoucheHeight = 15 * zoomScale

  const ringPath = (ring: Point[]) => {
    const svgPts = ring.map(toSvg)
    const d = svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return `${d} Z`
  }

  return (
    <div className="map-view">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="map-view__svg"
        role="img"
        aria-label="West of Scotland chart"
      >
        {/* coastline — real OpenStreetMap geometry, see clydeCoastline.ts */}
        {ALL_COASTLINE.map((ring, i) => (
          <path key={`land-${i}`} d={ringPath(ring)} className="map-view__land" />
        ))}

        {/* latitude (horizontal) lines */}
        {latLines.map((lat) => {
          const svgY = toSvg(projectPort({ lat, lon: 0 })).y
          return (
            <g key={`lat-${lat}`}>
              <line x1={0} y1={svgY} x2={width} y2={svgY} className="map-view__graticule" />
              <text
                x={2 * zoomScale}
                y={svgY - zoomScale}
                className="map-view__graticule-label"
                style={{ fontSize: 1.5 * zoomScale }}
              >
                {formatLat(lat)}
              </text>
            </g>
          )
        })}

        {/* longitude (vertical) lines */}
        {lonLines.map((lon) => {
          const svgX = toSvg(projectPort({ lat: 0, lon })).x
          return (
            <g key={`lon-${lon}`}>
              <line x1={svgX} y1={0} x2={svgX} y2={height} className="map-view__graticule" />
              <text
                x={svgX + zoomScale}
                y={height - 2 * zoomScale}
                className="map-view__graticule-label"
                style={{ fontSize: 1.5 * zoomScale }}
              >
                {formatLon(-lon)}
              </text>
            </g>
          )
        })}

        {/* depth contours — real isobaths, see clydeDepthContours.ts */}
        {ALL_DEPTH_CONTOURS.map((contour, i) => {
          const svgPts = contour.points.map(toSvg)
          const d = svgPts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          const labelAt = svgPts[Math.floor(svgPts.length * 0.4)]
          return (
            <g key={i}>
              <path d={d} className={`map-view__contour map-view__contour--${contour.depthM}`} />
              <text
                x={labelAt.x}
                y={labelAt.y}
                className="map-view__contour-label"
                style={{ fontSize: 1.4 * zoomScale }}
              >
                {contour.depthM}
              </text>
            </g>
          )
        })}

        {ALL_HAZARD_ZONES.map((zone) => {
          const c = toSvg(zone.center)
          const markSize = 1.6 * zoomScale
          return (
            <g key={zone.id}>
              <circle cx={c.x} cy={c.y} r={zone.radiusKm} className="map-view__hazard" style={{ opacity: 0.1 + zone.severity * 0.3 }} />
              <path
                d={`M ${c.x} ${c.y - markSize} L ${c.x + markSize * 0.875} ${c.y + markSize * 0.75} L ${c.x - markSize * 0.875} ${c.y + markSize * 0.75} Z`}
                className="map-view__hazard-mark"
              />
            </g>
          )
        })}

        {ALL_ROUTES.map((route) => {
          const path = routeSeaPath(route)
          if (!path) return null
          const active = activeRouteIds.has(route.id)
          return (
            <polyline
              key={route.id}
              points={path.map((pt) => { const s = toSvg(pt); return `${s.x},${s.y}` }).join(' ')}
              className={active ? 'map-view__route map-view__route--active' : 'map-view__route'}
            />
          )
        })}

        {points.map(({ port, xy }) => {
          const p = toSvg(xy)
          return (
            <g key={port.id}>
              <circle cx={p.x} cy={p.y} r={0.6 * zoomScale} className="map-view__port-dot" />
              <text
                x={p.x + 1.1 * zoomScale}
                y={p.y + 0.5 * zoomScale}
                className="map-view__port-label"
                style={{ fontSize: 2 * zoomScale }}
              >
                {port.name}
              </text>
            </g>
          )
        })}

        {/* live ships — each active route's assigned ship, sailing out
            during her crossing window (routeTiming.ts) then back again for
            the remainder of the day, resting at her origin port until the
            next cycle. */}
        {contract.routes.map((route) => {
          const routeDef = ALL_ROUTES.find((r) => r.id === route.routeId)
          const path = routeDef ? routeSeaPath(routeDef) : null
          const ship = contract.fleet.find((s) => s.id === route.assignedShipId)
          if (!routeDef || !path || !ship) return null
          if (isInDrydock(ship.condition, contract.calendar.day)) return null

          // heading follows the path's current leg, not the route's overall
          // bearing — a bent path turns as she rounds each waypoint. Sampled
          // via a tiny lookahead rather than exposing a segment index, since
          // resting/turnaround moments (where lookahead and position
          // coincide) fall back to the outbound departure heading.
          const simPos = shipPositionForDay(path, progress, DEPART_AT, ARRIVE_AT)
          const lookaheadPos = shipPositionForDay(path, Math.min(1, progress + 0.001), DEPART_AT, ARRIVE_AT)
          const p = toSvg(simPos)
          const pAhead = toSvg(lookaheadPos)
          let dx = pAhead.x - p.x
          let dy = pAhead.y - p.y
          if (dx === 0 && dy === 0) {
            const departSvg = toSvg(path[0])
            const nextSvg = toSvg(path[1])
            dx = nextSvg.x - departSvg.x
            dy = nextSvg.y - departSvg.y
          }
          const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI
          const design = shipDesignFor(ship.presetName)

          return (
            <polygon
              key={route.routeId}
              points="0,-1.5 1,1.1 0,0.5 -1,1.1"
              transform={`translate(${p.x} ${p.y}) rotate(${angleDeg}) scale(${zoomScale})`}
              className="map-view__ship"
            >
              <title>{design?.name ?? ship.presetName}</title>
            </polygon>
          )
        })}

        {/* compass rose — bottom-left corner, inside the padding margin
            so it never overlaps a port. */}
        <g transform={`translate(${chromePad} ${height - chromePad}) scale(${zoomScale})`} className="map-view__compass">
          <circle r="4.5" className="map-view__compass-ring" />
          <path d="M 0 -4.5 L 1 0 L 0 4.5 L -1 0 Z" className="map-view__compass-needle" />
          <path d="M -4.5 0 L 0 -1 L 4.5 0 L 0 1 Z" className="map-view__compass-needle-minor" />
          <text x="0" y="-6.2" className="map-view__compass-label" textAnchor="middle">
            N
          </text>
        </g>

        {/* scale bar — bottom-right corner, inside the padding margin. Bar
            length is real km (it scales with zoom automatically because
            the viewBox does); only the tick/label sizing is zoom-scaled. */}
        <g transform={`translate(${scaleBarX} ${scaleBarY})`}>
          <line x1={0} y1={0} x2={scaleKm} y2={0} className="map-view__scale-bar" />
          <line x1={0} y1={-zoomScale} x2={0} y2={zoomScale} className="map-view__scale-bar" />
          <line x1={scaleKm} y1={-zoomScale} x2={scaleKm} y2={zoomScale} className="map-view__scale-bar" />
          <text
            x={scaleKm / 2}
            y={4 * zoomScale}
            className="map-view__graticule-label"
            textAnchor="middle"
            style={{ fontSize: 1.5 * zoomScale }}
          >
            {scaleKm} km
          </text>
        </g>

        {/* cartouche — top-right corner, inside the padding margin. */}
        <g transform={`translate(${width - 6 * zoomScale - cartoucheWidth} ${5 * zoomScale})`}>
          <rect width={cartoucheWidth} height={cartoucheHeight} className="map-view__cartouche" />
          <text
            x={cartoucheWidth / 2}
            y={5.5 * zoomScale}
            textAnchor="middle"
            className="map-view__cartouche-title"
            style={{ fontSize: 3 * zoomScale }}
          >
            West of Scotland
          </text>
          <text
            x={cartoucheWidth / 2}
            y={9.5 * zoomScale}
            textAnchor="middle"
            className="map-view__cartouche-subtitle"
            style={{ fontSize: 1.5 * zoomScale }}
          >
            Fleet Tycoon
          </text>
          <text
            x={cartoucheWidth / 2}
            y={12.5 * zoomScale}
            textAnchor="middle"
            className="map-view__cartouche-subtitle"
            style={{ fontSize: 1.5 * zoomScale }}
          >
            WGS84
          </text>
        </g>
      </svg>
      <p className="map-view__note">
        Solid lines are active routes; faint lines are proposable but not yet started. Ship marks show today's
        assigned crossings live. Shaded patches are open-water chop, honest to the geography here — nothing yet
        like the Hebridean hazards still to come. Depth contours are real isobaths in metres. Scroll to zoom, drag
        to pan.
      </p>
      <p className="map-view__attribution">
        Coastline data &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors, ODbL. Depth contours derived from &copy;{' '}
        <a href="https://emodnet.ec.europa.eu/" target="_blank" rel="noreferrer">
          EMODnet Bathymetry
        </a>
        .
      </p>
    </div>
  )
}
