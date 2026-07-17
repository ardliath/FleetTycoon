import { useEffect, useState } from 'react'
import { PhaserGame } from './PhaserGame'
import { EventBus } from './game/EventBus'
import { ShipBuilder } from './ship/ShipBuilder'
import { FleetGallery } from './ship/FleetGallery'
import './App.css'

type View = 'shipyard' | 'fleet' | 'harbour'

function Harbour() {
  const [fleetSize, setFleetSize] = useState(0)
  const [gold, setGold] = useState(0)

  useEffect(() => {
    EventBus.on('fleet-updated', setFleetSize)
    EventBus.on('gold-updated', setGold)
    return () => {
      EventBus.off('fleet-updated', setFleetSize)
      EventBus.off('gold-updated', setGold)
    }
  }, [])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <dl className="stats">
          <div>
            <dt>Fleet</dt>
            <dd>{fleetSize}</dd>
          </div>
          <div>
            <dt>Gold</dt>
            <dd>{gold}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => EventBus.emit('add-ship')}>
          Add Ship
        </button>
      </aside>
      <main className="viewport">
        <PhaserGame />
      </main>
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
            className={view === 'harbour' ? 'active' : ''}
            onClick={() => setView('harbour')}
          >
            Harbour
          </button>
        </nav>
      </header>
      <div className="app-content">
        {view === 'shipyard' ? <ShipBuilder /> : view === 'fleet' ? <FleetGallery /> : <Harbour />}
      </div>
    </div>
  )
}

export default App
