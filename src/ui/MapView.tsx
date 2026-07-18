import { useState } from 'react'
import { CLYDE_HAZARD_ZONES, CLYDE_PORTS, CLYDE_ROUTES, findClydePort } from '../map/clyde'
import { projectPort } from '../sim/geography'
import { gameStateStore, newContractState, type ContractGameState } from '../storage/gameStateStore'
import './mapView.css'

/**
 * A visual sanity check for the authored geography — the whole point of
 * drafting port positions from known lat/lon rather than asking Adam to
 * hand-specify coordinates was that he'd correct them visually once
 * rendered (see the tuning-workflow memory's spirit, applied to map
 * content instead of ship photos). This is that rendering: real relative
 * positions, active vs. proposable routes, and the one authored hazard
 * zone, all in one stylised top-down view.
 */

function loadOrCreateContract(): ContractGameState {
  return gameStateStore.load() ?? newContractState(Date.now())
}

const PADDING_KM = 6

export function MapView() {
  const [contract] = useState<ContractGameState>(loadOrCreateContract)

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
  const toSvg = (p: { x: number; y: number }) => ({ x: p.x - minX, y: maxY - p.y })

  const activeRouteIds = new Set(contract.routes.map((r) => r.routeId))

  return (
    <div className="map-view">
      <svg viewBox={`0 0 ${width} ${height}`} className="map-view__svg" role="img" aria-label="Clyde pilot map">
        {CLYDE_HAZARD_ZONES.map((zone) => {
          const c = toSvg(zone.center)
          return (
            <circle
              key={zone.id}
              cx={c.x}
              cy={c.y}
              r={zone.radiusKm}
              className="map-view__hazard"
              style={{ opacity: 0.12 + zone.severity * 0.35 }}
            />
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
      </svg>
      <p className="map-view__note">
        Solid lines are active routes; faint lines are proposable but not yet started. The shaded patch is the outer
        Firth's mild chop — this pilot deliberately has nothing like the Hebridean hazards still to come.
      </p>
    </div>
  )
}
