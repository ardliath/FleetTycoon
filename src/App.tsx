import { useState } from 'react'
import { PhaserGame } from './PhaserGame'
import { dockingConfig } from './game/dockingConfig'
import { GameProvider, useGame } from './game/GameContext'
import { ShipBuilder } from './ship/ShipBuilder'
import { FleetGallery } from './ship/FleetGallery'
import { RoutesOverview } from './ui/RoutesOverview'
import { CompanyOverview } from './ui/CompanyOverview'
import { MapView } from './ui/MapView'
import './App.css'

type View = 'shipyard' | 'fleet' | 'map' | 'route' | 'company' | 'docking'

function Docking() {
  return (
    <div className="docking-view">
      <PhaserGame config={dockingConfig} />
    </div>
  )
}

/** A deliberate, global freeze of the day clock — visible and usable from
 * any tab, since the clock itself runs above the tab switch. Disabled
 * while actually hand-docking a ship: that already stops the clock on its
 * own, so a pause toggle there would just be confusing. */
function PauseToggle() {
  const { paused, togglePaused, dockingRouteId } = useGame()
  const disabled = dockingRouteId !== null
  return (
    <button type="button" className="topbar__pause" disabled={disabled} onClick={togglePaused}>
      {paused ? 'Resume' : 'Pause'}
    </button>
  )
}

function App() {
  const [view, setView] = useState<View>('shipyard')

  return (
    <GameProvider>
      <div className="app-frame">
        <header className="topbar">
          <h1>Fleet Tycoon</h1>
          <nav>
            <button type="button" className={view === 'shipyard' ? 'active' : ''} onClick={() => setView('shipyard')}>
              Shipyard
            </button>
            <button type="button" className={view === 'fleet' ? 'active' : ''} onClick={() => setView('fleet')}>
              Fleet
            </button>
            <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
              Map
            </button>
            <button type="button" className={view === 'route' ? 'active' : ''} onClick={() => setView('route')}>
              Routes
            </button>
            <button type="button" className={view === 'company' ? 'active' : ''} onClick={() => setView('company')}>
              Company
            </button>
            <button type="button" className={view === 'docking' ? 'active' : ''} onClick={() => setView('docking')}>
              Docking (practice)
            </button>
          </nav>
          <PauseToggle />
        </header>
        <div className="app-content">
          {view === 'shipyard' ? (
            <ShipBuilder />
          ) : view === 'fleet' ? (
            <FleetGallery />
          ) : view === 'map' ? (
            <MapView />
          ) : view === 'route' ? (
            <RoutesOverview />
          ) : view === 'company' ? (
            <CompanyOverview />
          ) : (
            <Docking />
          )}
        </div>
      </div>
    </GameProvider>
  )
}

export default App
