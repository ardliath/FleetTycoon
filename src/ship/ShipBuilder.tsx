import { useEffect, useMemo, useState } from 'react'
import type {
  ShipDesign,
  BowStyle,
  SternStyle,
  BridgeStyle,
  FunnelStyle,
  WindowStyle,
  MainmastStyle,
} from './types'
import { cloneDesign } from './types'
import { HERO_SHIPS } from './presets'
import { ShipSideView } from './ShipSideView'
import { ShipTopView } from './ShipTopView'
import { FunnelSide } from './Funnel'
import { DEFAULT_OVERLAY, designStore, mergeDesign, type OverlaySettings } from './storage'
import './shipbuilder.css'

/** Large close-up of the current funnel, standing on a deck edge. */
function FunnelCloseUp({ design }: { design: ShipDesign }) {
  const f = design.funnel
  const vw = Math.max(13, f.baseWidth + f.height * 0.4 + 4)
  const vh = f.height + 3.5
  const X = (x: number) => x
  const Y = (h: number) => vh - 0.4 - h
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="ship-view" role="img" aria-label="Funnel close-up">
      <rect x={0} y={Y(0.3)} width={vw} height={0.3} fill="#d8dedd" />
      <rect x={0} y={Y(0)} width={vw} height={0.5} fill="#f2f4f3" />
      <FunnelSide
        style={f.style}
        fx={vw * 0.42}
        h0={0.3}
        baseW={f.baseWidth}
        topW={f.topWidth}
        height={f.height}
        X={X}
        Y={Y}
      />
    </svg>
  )
}

const BOW_OPTIONS: { value: BowStyle; label: string }[] = [
  { value: 'raked', label: 'Classic raked' },
  { value: 'flared', label: 'Flared' },
  { value: 'modern', label: 'Modern swept' },
]
const STERN_OPTIONS: { value: SternStyle; label: string }[] = [
  { value: 'open', label: 'Open working deck' },
  { value: 'gantry', label: 'Open + ramp gantry' },
  { value: 'enclosed', label: 'Enclosed car deck' },
]
const BRIDGE_OPTIONS: { value: BridgeStyle; label: string }[] = [
  { value: 'classic', label: 'Classic with wings' },
  { value: 'modern', label: 'Modern curved glass' },
]
const FUNNEL_OPTIONS: { value: FunnelStyle; label: string }[] = [
  { value: 'classic', label: 'Classic tall' },
  { value: 'drum', label: 'Squat drum' },
  { value: 'raked', label: 'Raked aft' },
  { value: 'flick', label: 'Swept flick' },
  { value: 'modern', label: 'Modern + exhausts' },
]
const WINDOW_OPTIONS: { value: WindowStyle; label: string }[] = [
  { value: 'rect', label: 'Rectangular' },
  { value: 'porthole', label: 'Portholes' },
  { value: 'mixed', label: 'Mixed' },
]

function randomDesign(): ShipDesign {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  const stern = pick(['open', 'gantry', 'enclosed'] as SternStyle[])
  const start = rnd(0.08, 0.2)
  const names = ['Isle of Jura', 'Loch Etive', 'Sound of Sleat', 'Isle of Gigha', 'Lord of Lorn', 'Heather Isle', 'Isle of Rum', 'Sound of Barra']
  return {
    name: pick(names),
    lengthM: Math.round(rnd(50, 120)),
    bow: pick(['raked', 'flared', 'modern'] as BowStyle[]),
    stern,
    superstructure: {
      decks: pick([1, 2, 2, 3]),
      startFrac: start,
      endFrac: stern === 'enclosed' ? rnd(0.82, 0.9) : rnd(start + 0.35, 0.75),
      bridge: pick(['classic', 'classic', 'modern'] as BridgeStyle[]),
      windows: pick(['rect', 'porthole', 'mixed'] as WindowStyle[]),
    },
    funnel: {
      style: pick(['classic', 'drum', 'raked', 'modern'] as FunnelStyle[]),
      count: pick([1, 1, 1, 2]),
      posFrac: rnd(0.45, 0.88),
      baseWidth: Number(rnd(2.4, 5.6).toFixed(1)),
      topWidth: Number(rnd(2.0, 4.4).toFixed(1)),
      height: Number(rnd(4.2, 8).toFixed(1)),
    },
    masts: {
      foremast: Math.random() > 0.15,
      mainmast: Math.random() > 0.5,
      aftDerrick: stern !== 'enclosed' && Math.random() > 0.4,
    },
    lifeboats: { count: pick([1, 2, 2, 3]), posFrac: rnd(0.4, 0.65) },
    hull: {
      portholes: Math.random() > 0.4,
      bowThruster: Math.random() > 0.3,
      webAddress: Math.random() > 0.3,
    },
  }
}

export function ShipBuilder() {
  const [design, setDesign] = useState<ShipDesign>(() => {
    const saved = designStore.loadDesign()
    return saved ? mergeDesign(saved.design) : cloneDesign(HERO_SHIPS[0])
  })
  const [presetName, setPresetName] = useState<string>(
    () => designStore.loadDesign()?.presetName ?? HERO_SHIPS[0].name,
  )
  const [overlay, setOverlay] = useState<OverlaySettings>(
    () => designStore.loadOverlay() ?? DEFAULT_OVERLAY,
  )
  const [photo, setPhoto] = useState<string | null>(() => designStore.loadOverlayImage())
  const [copied, setCopied] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  // every change survives a reload
  useEffect(() => {
    designStore.saveDesign({ design, presetName })
  }, [design, presetName])
  useEffect(() => {
    designStore.saveOverlay(overlay)
  }, [overlay])

  const updateOverlay = (patch: Partial<OverlaySettings>) => setOverlay((o) => ({ ...o, ...patch }))

  const onPhotoPicked = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      setPhoto(dataUrl)
      designStore.saveOverlayImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }
  const clearPhoto = () => {
    setPhoto(null)
    designStore.saveOverlayImage(null)
  }

  const update = (patch: Partial<ShipDesign>) => {
    setDesign((d) => ({ ...d, ...patch }))
    setPresetName('custom')
  }
  const updateSS = (patch: Partial<ShipDesign['superstructure']>) =>
    update({ superstructure: { ...design.superstructure, ...patch } })
  const updateFunnel = (patch: Partial<ShipDesign['funnel']>) =>
    update({ funnel: { ...design.funnel, ...patch } })
  const updateMasts = (patch: Partial<ShipDesign['masts']>) =>
    update({ masts: { ...design.masts, ...patch } })
  const updateBoats = (patch: Partial<ShipDesign['lifeboats']>) =>
    update({ lifeboats: { ...design.lifeboats, ...patch } })
  const updateHull = (patch: Partial<ShipDesign['hull']>) =>
    update({ hull: { ...design.hull, ...patch } })

  const loadPreset = (name: string) => {
    const preset = HERO_SHIPS.find((s) => s.name === name)
    if (preset) {
      setDesign(cloneDesign(preset))
      setPresetName(name)
    }
  }

  const json = useMemo(() => JSON.stringify(design, null, 2), [design])

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — the JSON is still selectable in the panel below
    }
  }

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText) as Partial<ShipDesign>
      if (typeof parsed?.lengthM !== 'number' || !parsed.funnel || !parsed.superstructure) {
        throw new Error('that JSON does not look like a ship design')
      }
      setDesign(mergeDesign(parsed))
      setPresetName('custom')
      setImportText('')
      setImportError('')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="builder">
      <div className="builder-controls">
        <section>
          <h2>Ship</h2>
          <label className="row">
            <span>Preset</span>
            <select value={presetName} onChange={(e) => loadPreset(e.target.value)}>
              <option value="custom" disabled>
                — custom —
              </option>
              {HERO_SHIPS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <span>Name</span>
            <input value={design.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label className="row">
            <span>
              Length <em>{design.lengthM}m</em>
            </span>
            <input
              type="range"
              min={45}
              max={125}
              value={design.lengthM}
              onChange={(e) => update({ lengthM: Number(e.target.value) })}
            />
          </label>
          <label className="row">
            <span>Bow</span>
            <select value={design.bow} onChange={(e) => update({ bow: e.target.value as BowStyle })}>
              {BOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <span>Stern</span>
            <select value={design.stern} onChange={(e) => update({ stern: e.target.value as SternStyle })}>
              {STERN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2>Superstructure</h2>
          <label className="row">
            <span>
              Decks <em>{design.superstructure.decks}</em>
            </span>
            <input
              type="range"
              min={1}
              max={3}
              value={design.superstructure.decks}
              onChange={(e) => updateSS({ decks: Number(e.target.value) })}
            />
          </label>
          <label className="row">
            <span>
              Starts <em>{Math.round(design.superstructure.startFrac * 100)}%</em>
            </span>
            <input
              type="range"
              min={4}
              max={40}
              value={Math.round(design.superstructure.startFrac * 100)}
              onChange={(e) =>
                updateSS({
                  startFrac: Math.min(Number(e.target.value) / 100, design.superstructure.endFrac - 0.18),
                })
              }
            />
          </label>
          <label className="row">
            <span>
              Ends <em>{Math.round(design.superstructure.endFrac * 100)}%</em>
            </span>
            <input
              type="range"
              min={35}
              max={95}
              value={Math.round(design.superstructure.endFrac * 100)}
              onChange={(e) =>
                updateSS({
                  endFrac: Math.max(Number(e.target.value) / 100, design.superstructure.startFrac + 0.18),
                })
              }
            />
          </label>
          {design.superstructure.decks >= 2 && (
            <>
              <label className="row">
                <span>
                  Upper deck starts{' '}
                  <em>{Math.round((design.superstructure.upperStartFrac ?? design.superstructure.startFrac + 0.015) * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={5}
                  max={70}
                  value={Math.round((design.superstructure.upperStartFrac ?? design.superstructure.startFrac + 0.015) * 100)}
                  onChange={(e) => updateSS({ upperStartFrac: Number(e.target.value) / 100 })}
                />
              </label>
              <label className="row">
                <span>
                  Upper deck ends{' '}
                  <em>{Math.round((design.superstructure.upperEndFrac ?? design.superstructure.endFrac - 0.06) * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={20}
                  max={96}
                  value={Math.round((design.superstructure.upperEndFrac ?? design.superstructure.endFrac - 0.06) * 100)}
                  onChange={(e) => updateSS({ upperEndFrac: Number(e.target.value) / 100 })}
                />
              </label>
            </>
          )}
          <label className="row">
            <span>Bridge</span>
            <select
              value={design.superstructure.bridge}
              onChange={(e) => updateSS({ bridge: e.target.value as BridgeStyle })}
            >
              {BRIDGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <span>Windows</span>
            <select
              value={design.superstructure.windows}
              onChange={(e) => updateSS({ windows: e.target.value as WindowStyle })}
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2>Funnel</h2>
          <label className="row">
            <span>Style</span>
            <select
              value={design.funnel.style}
              onChange={(e) => updateFunnel({ style: e.target.value as FunnelStyle })}
            >
              {FUNNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={design.funnel.count >= 2}
              onChange={(e) => updateFunnel({ count: e.target.checked ? 2 : 1 })}
            />
            Twin funnels (side by side)
          </label>
          <label className="row">
            <span>
              Position <em>{Math.round(design.funnel.posFrac * 100)}%</em>
            </span>
            <input
              type="range"
              min={12}
              max={94}
              value={Math.round(design.funnel.posFrac * 100)}
              onChange={(e) => updateFunnel({ posFrac: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="row">
            <span>
              Base width <em>{design.funnel.baseWidth.toFixed(1)}m</em>
            </span>
            <input
              type="range"
              min={20}
              max={70}
              value={Math.round(design.funnel.baseWidth * 10)}
              onChange={(e) => updateFunnel({ baseWidth: Number(e.target.value) / 10 })}
            />
          </label>
          <label className="row">
            <span>
              Top width <em>{design.funnel.topWidth.toFixed(1)}m</em>
            </span>
            <input
              type="range"
              min={15}
              max={65}
              value={Math.round(design.funnel.topWidth * 10)}
              onChange={(e) => updateFunnel({ topWidth: Number(e.target.value) / 10 })}
            />
          </label>
          <label className="row">
            <span>
              Height <em>{design.funnel.height.toFixed(1)}m</em>
            </span>
            <input
              type="range"
              min={30}
              max={100}
              value={Math.round(design.funnel.height * 10)}
              onChange={(e) => updateFunnel({ height: Number(e.target.value) / 10 })}
            />
          </label>
          <label className="row">
            <span>
              Base drop <em>{design.funnel.baseDeckDrop ?? 0} deck(s)</em>
            </span>
            <input
              type="range"
              min={0}
              max={2}
              value={design.funnel.baseDeckDrop ?? 0}
              onChange={(e) => updateFunnel({ baseDeckDrop: Number(e.target.value) })}
            />
          </label>
        </section>

        <section>
          <h2>Fittings</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={design.masts.foremast}
              onChange={(e) => updateMasts({ foremast: e.target.checked })}
            />
            Foremast
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={design.masts.mainmast}
              onChange={(e) => updateMasts({ mainmast: e.target.checked })}
            />
            Mainmast
          </label>
          {design.masts.mainmast && (
            <>
              <label className="row">
                <span>
                  Mainmast position <em>{Math.round((design.masts.mainmastFrac ?? 0.65) * 100)}%</em>
                </span>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={Math.round((design.masts.mainmastFrac ?? 0.65) * 100)}
                  onChange={(e) => updateMasts({ mainmastFrac: Number(e.target.value) / 100 })}
                />
              </label>
              <label className="row">
                <span>Mainmast style</span>
                <select
                  value={design.masts.mainmastStyle ?? 'buff'}
                  onChange={(e) => updateMasts({ mainmastStyle: e.target.value as MainmastStyle })}
                >
                  <option value="buff">Buff pole</option>
                  <option value="dark-raked">Dark, raked aft</option>
                </select>
              </label>
            </>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={design.masts.aftDerrick}
              onChange={(e) => updateMasts({ aftDerrick: e.target.checked })}
            />
            Cargo derrick
          </label>
          {design.masts.aftDerrick && (
            <label className="row">
              <span>
                Derrick position <em>{Math.round((design.masts.derrickFrac ?? 0.88) * 100)}%</em>
              </span>
              <input
                type="range"
                min={10}
                max={95}
                value={Math.round((design.masts.derrickFrac ?? 0.88) * 100)}
                onChange={(e) => updateMasts({ derrickFrac: Number(e.target.value) / 100 })}
              />
            </label>
          )}
          <label className="row">
            <span>
              Lifeboats/side <em>{design.lifeboats.count}</em>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              value={design.lifeboats.count}
              onChange={(e) => updateBoats({ count: Number(e.target.value) })}
            />
          </label>
          <label className="row">
            <span>
              Boat position <em>{Math.round(design.lifeboats.posFrac * 100)}%</em>
            </span>
            <input
              type="range"
              min={25}
              max={85}
              value={Math.round(design.lifeboats.posFrac * 100)}
              onChange={(e) => updateBoats({ posFrac: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={design.hull.portholes}
              onChange={(e) => updateHull({ portholes: e.target.checked })}
            />
            Hull portholes
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={design.hull.bowThruster}
              onChange={(e) => updateHull({ bowThruster: e.target.checked })}
            />
            Bow thruster mark
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={design.hull.webAddress}
              onChange={(e) => updateHull({ webAddress: e.target.checked })}
            />
            www.calmac.co.uk
          </label>
        </section>

        <section>
          <h2>Reference photo</h2>
          <label className="row">
            <span>Photo</span>
            <input type="file" accept="image/*" onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
          </label>
          {photo && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={overlay.enabled}
                  onChange={(e) => updateOverlay({ enabled: e.target.checked })}
                />
                Show photo
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={overlay.onTop}
                  onChange={(e) => updateOverlay({ onTop: e.target.checked })}
                />
                Photo in front of ship
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={overlay.flip}
                  onChange={(e) => updateOverlay({ flip: e.target.checked })}
                />
                Flip photo (bow must point left)
              </label>
              <label className="row">
                <span>
                  Photo scale <em>{overlay.scale}%</em>
                </span>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={overlay.scale}
                  onChange={(e) => updateOverlay({ scale: Number(e.target.value) })}
                />
              </label>
              <label className="row">
                <span>
                  Photo left/right <em>{overlay.offsetX}%</em>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={overlay.offsetX}
                  onChange={(e) => updateOverlay({ offsetX: Number(e.target.value) })}
                />
              </label>
              <label className="row">
                <span>
                  Photo up/down <em>{overlay.offsetY}%</em>
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={overlay.offsetY}
                  onChange={(e) => updateOverlay({ offsetY: Number(e.target.value) })}
                />
              </label>
              <label className="row">
                <span>
                  Photo opacity <em>{overlay.photoOpacity}%</em>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={overlay.photoOpacity}
                  onChange={(e) => updateOverlay({ photoOpacity: Number(e.target.value) })}
                />
              </label>
              <label className="row">
                <span>
                  Ship opacity <em>{overlay.shipOpacity}%</em>
                </span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={overlay.shipOpacity}
                  onChange={(e) => updateOverlay({ shipOpacity: Number(e.target.value) })}
                />
              </label>
              <button type="button" onClick={clearPhoto}>
                Remove photo
              </button>
            </>
          )}
        </section>

        <section className="builder-actions">
          <button
            type="button"
            onClick={() => {
              setDesign(randomDesign())
              setPresetName('custom')
            }}
          >
            Random ship
          </button>
          <button type="button" onClick={copyJson}>
            {copied ? 'Copied!' : 'Copy design JSON'}
          </button>
          <details>
            <summary>Design JSON</summary>
            <pre>{json}</pre>
          </details>
          <details>
            <summary>Import JSON</summary>
            <textarea
              rows={6}
              placeholder="Paste a ship design here…"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button type="button" onClick={importJson} disabled={!importText.trim()}>
              Load design
            </button>
            {importError && <p className="import-error">{importError}</p>}
          </details>
        </section>
      </div>

      <div className="builder-previews">
        <figure>
          <figcaption>
            <strong>{design.name}</strong> — side profile
          </figcaption>
          <div className="overlay-stack">
            <div style={{ opacity: overlay.shipOpacity / 100 }}>
              <ShipSideView design={design} />
            </div>
            {photo && overlay.enabled && (
              <img
                className="overlay-photo"
                src={photo}
                alt="reference"
                style={{
                  left: `${50 + overlay.offsetX}%`,
                  top: `${50 + overlay.offsetY}%`,
                  width: `${overlay.scale}%`,
                  transform: `translate(-50%, -50%)${overlay.flip ? ' scaleX(-1)' : ''}`,
                  opacity: overlay.photoOpacity / 100,
                  zIndex: overlay.onTop ? 2 : -1,
                }}
              />
            )}
          </div>
        </figure>
        <figure>
          <figcaption>deck plan</figcaption>
          <ShipTopView design={design} />
        </figure>
        <figure className="funnel-closeup">
          <figcaption>funnel</figcaption>
          <FunnelCloseUp design={design} />
        </figure>
      </div>
    </div>
  )
}
