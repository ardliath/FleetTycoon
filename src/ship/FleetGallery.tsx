import { HERO_SHIPS } from './presets'
import { ShipSideView } from './ShipSideView'
import { ShipTopView } from './ShipTopView'
import './shipbuilder.css'

/** Review page: every hero preset rendered large, side and plan views. */
export function FleetGallery() {
  return (
    <div className="fleet-gallery">
      {HERO_SHIPS.map((ship) => (
        <figure key={ship.name}>
          <figcaption>
            <strong>{ship.name}</strong> — {ship.lengthM}m
          </figcaption>
          <ShipSideView design={ship} />
          <ShipTopView design={ship} />
        </figure>
      ))}
    </div>
  )
}
