import { useGame } from '../game/GameContext'
import { routePoints, shipDesignFor } from '../game/routeHelpers'
import { ARRIVE_AT, DEPART_AT } from '../game/routeTiming'
import { CLYDE_HAZARD_ZONES, CLYDE_PORTS, CLYDE_ROUTES, findClydePort } from '../map/clyde'
import { CLYDE_COASTLINE } from '../map/clydeCoastline'
import { CLYDE_SOUNDINGS } from '../map/clydeSoundings'
import { dayProgress } from '../sim/calendar'
import {
  crossingFraction,
  positionAlongRoute,
  projectPort,
  unprojectPoint,
  type Point,
} from '../sim/geography'
import { isInDrydock } from '../sim/shipCondition'
import './mapView.css'

/**
 * A real Admiralty-chart-inspired rendering of the Clyde pilot: a real
 * lat/lon graticule, a compass rose, a title cartouche, a scale bar
 * derived from the actual projection, the authored hazard zone, and each
 * active route's assigned ship animated across her crossing window (see
 * src/game/routeTiming.ts for what that window means and why it exists —
 * the sim never had an explicit departure/arrival moment before this).
 *
 * Land shapes (src/map/clydeCoastline.ts) are real OpenStreetMap
 * coastline data, simplified — not hand-drawn. Islands and mainland both
 * render filled; see that file's own comment for how mainland pieces
 * (clipped by the data's query box) get closed into real polygons rather
 * than left as open linework.
 *
 * Depth soundings (src/map/clydeSoundings.ts) are real point queries
 * against EMODnet Bathymetry's depth grid, not decoration.
 */

const PADDING_KM = 24
const LAT_STEP_DEG = 0.1
const LON_STEP_DEG = 0.15

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

  const points = CLYDE_PORTS.map((port) => ({ port, xy: projectPort(port) }))
  const xs = points.map((p) => p.xy.x)
  const ys = points.map((p) => p.xy.y)
  const minX = Math.min(...xs) - PADDING_KM
  const maxX = Math.max(...xs) + PADDING_KM
  const minY = Math.min(...ys) - PADDING_KM
  const maxY = Math.max(...ys) + PADDING_KM
  const width = maxX - minX
  const height = maxY - minY

  // sim space has y growing north; SVG has y growing down the screen.
  const toSvg = (p: Point) => ({ x: p.x - minX, y: maxY - p.y })

  const activeRouteIds = new Set(contract.routes.map((r) => r.routeId))
  const progress = dayProgress(contract.calendar)

  // graticule: real lat/lon lines at a fixed step, labelled with the
  // coordinates they actually are.
  const swLatLon = unprojectPoint({ x: minX, y: minY })
  const neLatLon = unprojectPoint({ x: maxX, y: maxY })
  const latLines: number[] = []
  for (
    let lat = Math.ceil(swLatLon.lat / LAT_STEP_DEG) * LAT_STEP_DEG;
    lat <= neLatLon.lat;
    lat += LAT_STEP_DEG
  ) {
    latLines.push(lat)
  }
  const lonLines: number[] = []
  for (
    let lon = Math.ceil(swLatLon.lon / LON_STEP_DEG) * LON_STEP_DEG;
    lon <= neLatLon.lon;
    lon += LON_STEP_DEG
  ) {
    lonLines.push(lon)
  }

  // scale bar: a round number of km that fits comfortably in the corner.
  const scaleKm = width > 60 ? 10 : 5
  const scaleBarX = width - 12 - scaleKm
  const scaleBarY = height - 10

  const cartoucheWidth = 20
  const cartoucheHeight = 15

  const ringPath = (ring: Point[]) => {
    const svgPts = ring.map(toSvg)
    const d = svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return `${d} Z`
  }

  return (
    <div className="map-view">
      <svg viewBox={`0 0 ${width} ${height}`} className="map-view__svg" role="img" aria-label="Clyde pilot chart">
        {/* coastline — real OpenStreetMap geometry, see clydeCoastline.ts */}
        {CLYDE_COASTLINE.map((ring, i) => (
          <path key={`land-${i}`} d={ringPath(ring)} className="map-view__land" />
        ))}

        {/* latitude (horizontal) lines */}
        {latLines.map((lat) => {
          const svgY = toSvg({ x: minX, y: lat * 111.32 }).y
          return (
            <g key={`lat-${lat}`}>
              <line x1={0} y1={svgY} x2={width} y2={svgY} className="map-view__graticule" />
              <text x={2} y={svgY - 1} className="map-view__graticule-label">
                {formatLat(lat)}
              </text>
            </g>
          )
        })}

        {/* longitude (vertical) lines */}
        {lonLines.map((lon) => {
          const svgX = toSvg({ x: lon * Math.cos((57 * Math.PI) / 180) * 111.32, y: minY }).x
          return (
            <g key={`lon-${lon}`}>
              <line x1={svgX} y1={0} x2={svgX} y2={height} className="map-view__graticule" />
              <text x={svgX + 1} y={height - 2} className="map-view__graticule-label">
                {formatLon(-lon)}
              </text>
            </g>
          )
        })}

        {/* depth soundings — real EMODnet point queries, see clydeSoundings.ts */}
        {CLYDE_SOUNDINGS.map((s, i) => {
          const p = toSvg(s)
          return (
            <text key={i} x={p.x} y={p.y} className="map-view__sounding">
              {s.depthM}
            </text>
          )
        })}

        {CLYDE_HAZARD_ZONES.map((zone) => {
          const c = toSvg(zone.center)
          return (
            <g key={zone.id}>
              <circle cx={c.x} cy={c.y} r={zone.radiusKm} className="map-view__hazard" style={{ opacity: 0.1 + zone.severity * 0.3 }} />
              <path
                d={`M ${c.x} ${c.y - 1.6} L ${c.x + 1.4} ${c.y + 1.2} L ${c.x - 1.4} ${c.y + 1.2} Z`}
                className="map-view__hazard-mark"
              />
            </g>
          )
        })}

        {CLYDE_ROUTES.map((route) => {
          const portA = findClydePort(route.portAId)
          const portB = findClydePort(route.portBId)
          if (!portA || !portB) return null
          const a = toSvg(projectPort(portA))
          const b = toSvg(projectPort(portB))
          const active = activeRouteIds.has(route.id)
          return (
            <line
              key={route.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={active ? 'map-view__route map-view__route--active' : 'map-view__route'}
            />
          )
        })}

        {points.map(({ port, xy }) => {
          const p = toSvg(xy)
          return (
            <g key={port.id}>
              <circle cx={p.x} cy={p.y} r={0.6} className="map-view__port-dot" />
              <text x={p.x + 1.1} y={p.y + 0.5} className="map-view__port-label">
                {port.name}
              </text>
            </g>
          )
        })}

        {/* live ships — each active route's assigned ship, animated across
            her crossing window (routeTiming.ts), resting at her origin
            port the rest of the day. */}
        {contract.routes.map((route) => {
          const routeDef = CLYDE_ROUTES.find((r) => r.id === route.routeId)
          const geom = routeDef ? routePoints(routeDef) : null
          const ship = contract.fleet.find((s) => s.id === route.assignedShipId)
          if (!routeDef || !geom || !ship) return null
          if (isInDrydock(ship.condition, contract.calendar.day)) return null

          const fraction = crossingFraction(progress, DEPART_AT, ARRIVE_AT)
          const simPos = fraction === null ? geom.a : positionAlongRoute(geom.a, geom.b, fraction)
          const p = toSvg(simPos)
          const aSvg = toSvg(geom.a)
          const bSvg = toSvg(geom.b)
          const dx = bSvg.x - aSvg.x
          const dy = bSvg.y - aSvg.y
          const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI
          const design = shipDesignFor(ship.presetName)

          return (
            <polygon
              key={route.routeId}
              points="0,-1.5 1,1.1 0,0.5 -1,1.1"
              transform={`translate(${p.x} ${p.y}) rotate(${angleDeg})`}
              className="map-view__ship"
            >
              <title>{design?.name ?? ship.presetName}</title>
            </polygon>
          )
        })}

        {/* compass rose — bottom-left corner, inside the padding margin
            so it never overlaps a port. */}
        <g transform={`translate(${11} ${height - 11})`} className="map-view__compass">
          <circle r="4.5" className="map-view__compass-ring" />
          <path d="M 0 -4.5 L 1 0 L 0 4.5 L -1 0 Z" className="map-view__compass-needle" />
          <path d="M -4.5 0 L 0 -1 L 4.5 0 L 0 1 Z" className="map-view__compass-needle-minor" />
          <text x="0" y="-6.2" className="map-view__compass-label" textAnchor="middle">
            N
          </text>
        </g>

        {/* scale bar — bottom-right corner, inside the padding margin. */}
        <g transform={`translate(${scaleBarX} ${scaleBarY})`}>
          <line x1={0} y1={0} x2={scaleKm} y2={0} className="map-view__scale-bar" />
          <line x1={0} y1={-1} x2={0} y2={1} className="map-view__scale-bar" />
          <line x1={scaleKm} y1={-1} x2={scaleKm} y2={1} className="map-view__scale-bar" />
          <text x={scaleKm / 2} y={4} className="map-view__graticule-label" textAnchor="middle">
            {scaleKm} km
          </text>
        </g>

        {/* cartouche — top-right corner, inside the padding margin. */}
        <g transform={`translate(${width - 6 - cartoucheWidth} ${5})`}>
          <rect width={cartoucheWidth} height={cartoucheHeight} className="map-view__cartouche" />
          <text x={cartoucheWidth / 2} y={5.5} textAnchor="middle" className="map-view__cartouche-title">
            Clyde
          </text>
          <text x={cartoucheWidth / 2} y={9.5} textAnchor="middle" className="map-view__cartouche-subtitle">
            Fleet Tycoon pilot
          </text>
          <text x={cartoucheWidth / 2} y={12.5} textAnchor="middle" className="map-view__cartouche-subtitle">
            WGS84
          </text>
        </g>
      </svg>
      <p className="map-view__note">
        Solid lines are active routes; faint lines are proposable but not yet started. Ship marks show today's
        assigned crossings live. The shaded patch is the outer Firth's mild chop — this pilot deliberately has
        nothing like the Hebridean hazards still to come. Depth figures are real soundings in metres.
      </p>
      <p className="map-view__attribution">
        Coastline data &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors, ODbL. Depth data &copy;{' '}
        <a href="https://emodnet.ec.europa.eu/" target="_blank" rel="noreferrer">
          EMODnet Bathymetry
        </a>
        .
      </p>
    </div>
  )
}
