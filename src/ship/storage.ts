import type { ShipDesign } from './types'

/** Overlay settings persisted alongside the design (image stored separately —
 * it's a large data URL and has its own quota risk). */
export interface OverlaySettings {
  enabled: boolean
  /** Photo drawn over the ship (true) or behind it (false). */
  onTop: boolean
  /** Mirror the photo when the ship faces the other way. */
  flip: boolean
  /** Photo width as % of the preview frame. */
  scale: number
  /** Photo centre offset as % of the frame. */
  offsetX: number
  offsetY: number
  /** 0–100. */
  photoOpacity: number
  /** 0–100. */
  shipOpacity: number
}

export const DEFAULT_OVERLAY: OverlaySettings = {
  enabled: true,
  onTop: true,
  flip: false,
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  photoOpacity: 55,
  shipOpacity: 100,
}

export interface SavedDesign {
  design: ShipDesign
  presetName: string
}

/** Persistence boundary for the ship builder. Swap the implementation
 * (e.g. for a backend or file-based store) without touching the UI. */
export interface DesignStore {
  loadDesign(): SavedDesign | null
  saveDesign(saved: SavedDesign): void
  loadOverlay(): OverlaySettings | null
  saveOverlay(settings: OverlaySettings): void
  loadOverlayImage(): string | null
  saveOverlayImage(dataUrl: string | null): void
}

const DESIGN_KEY = 'fleet-tycoon:builder:design'
const OVERLAY_KEY = 'fleet-tycoon:builder:overlay'
const OVERLAY_IMAGE_KEY = 'fleet-tycoon:builder:overlay-image'

class LocalStorageDesignStore implements DesignStore {
  loadDesign(): SavedDesign | null {
    return readJson<SavedDesign>(DESIGN_KEY)
  }

  saveDesign(saved: SavedDesign): void {
    writeJson(DESIGN_KEY, saved)
  }

  loadOverlay(): OverlaySettings | null {
    return readJson<OverlaySettings>(OVERLAY_KEY)
  }

  saveOverlay(settings: OverlaySettings): void {
    writeJson(OVERLAY_KEY, settings)
  }

  loadOverlayImage(): string | null {
    try {
      return localStorage.getItem(OVERLAY_IMAGE_KEY)
    } catch {
      return null
    }
  }

  saveOverlayImage(dataUrl: string | null): void {
    try {
      if (dataUrl === null) localStorage.removeItem(OVERLAY_IMAGE_KEY)
      else localStorage.setItem(OVERLAY_IMAGE_KEY, dataUrl)
    } catch (e) {
      // Most likely quota — a very large photo. The overlay still works for
      // this session; it just won't survive a reload.
      console.warn('Could not persist overlay photo (too large for localStorage?)', e)
    }
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`Could not persist ${key}`, e)
  }
}

/** Neutral template used as the merge base: every required field has a sane
 * value and no optional field is set, so nothing leaks into loaded designs. */
export const BASE_DESIGN: ShipDesign = {
  name: 'Unnamed ship',
  lengthM: 85,
  bow: 'raked',
  stern: 'open',
  superstructure: { decks: 2, startFrac: 0.15, endFrac: 0.75, bridge: 'classic', windows: 'rect' },
  funnel: { style: 'classic', count: 1, posFrac: 0.6, baseWidth: 3.5, topWidth: 2.8, height: 6.5 },
  masts: { foremast: true, mainmast: false, aftDerrick: false },
  lifeboats: { count: 2, posFrac: 0.55 },
  hull: { portholes: true, bowThruster: true, webAddress: true },
}

/** Merge a (possibly older/partial) stored design over the neutral template
 * so new required fields added to ShipDesign don't break saved work, while
 * optional fields stay unset unless the stored design has them. */
export function mergeDesign(stored: Partial<ShipDesign> | null | undefined): ShipDesign {
  const base = structuredClone(BASE_DESIGN)
  if (!stored) return base
  return {
    ...base,
    ...stored,
    superstructure: { ...base.superstructure, ...stored.superstructure },
    funnel: { ...base.funnel, ...stored.funnel },
    masts: { ...base.masts, ...stored.masts },
    lifeboats: { ...base.lifeboats, ...stored.lifeboats },
    hull: { ...base.hull, ...stored.hull },
  }
}

export const designStore: DesignStore = new LocalStorageDesignStore()
