import { useState } from 'react'
import { PhaserGame } from './PhaserGame'
import { dockingConfig } from './game/dockingConfig'
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

function App() {
  const [view, setView] = useState<View>('shipyard')

  return (
    <div className="app-frame">
      <header className="topbar">
        <h1>Fleet Tycoon</h1>
        <nav>
          <button
            type="button"
            className={view === 'shipyard' ? 'active' : ''}
            onClick={() => setView('shipyard')}
          >
            Shipyard
          </button>
          <button
            type="button"
            className={view === 'fleet' ? 'active' : ''}
            onClick={() => setView('fleet')}
          >
            Fleet
          </button>
          <button
            type="button"
            className={view === 'map' ? 'active' : ''}
            onClick={() => setView('map')}
          >
            Map
          </button>
          <button
            type="button"
            className={view === 'route' ? 'active' : ''}
            onClick={() => setView('route')}
          >
            Routes
          </button>
          <button
            type="button"
            className={view === 'company' ? 'active' : ''}
            onClick={() => setView('company')}
          >
            Company
          </button>
          <button
            type="button"
            className={view === 'docking' ? 'active' : ''}
            onClick={() => setView('docking')}
          >
            Docking (practice)
          </button>
        </nav>
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
  )
}

export default App
