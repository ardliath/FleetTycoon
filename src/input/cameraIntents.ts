/**
 * Input-intent layer for the map's pan/zoom camera — mouse wheel maps to
 * zoom, pointer drag maps to pan. Same philosophy as keyboardIntents.ts:
 * the adapter owns all raw DOM event handling, MapView only ever sees
 * named intents, so a touch/pinch adapter can be added later without
 * MapView changing.
 */

export type CameraIntent =
  | { type: 'pan'; dxPx: number; dyPx: number }
  | { type: 'zoom'; factor: number; anchorPx: { x: number; y: number } }

/** The slice of SVGSVGElement this adapter actually needs — narrowed so
 * tests can pass a plain EventTarget-based fake instead of needing a real
 * DOM (this project's tests run under Node, not jsdom). */
export interface CameraTarget extends EventTarget {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number }
  setPointerCapture?(pointerId: number): void
}

/** Wires wheel + pointer-drag on `target` to emit camera intents via
 * `onIntent`. Returns a cleanup function to remove the listeners. */
export function bindCameraIntents(target: CameraTarget, onIntent: (intent: CameraIntent) => void): () => void {
  let dragging = false
  let pointerId: number | null = null
  let lastX = 0
  let lastY = 0

  const onWheel = (evt: Event) => {
    const e = evt as WheelEvent
    e.preventDefault()
    const rect = target.getBoundingClientRect()
    const clampedDelta = Math.max(-100, Math.min(100, e.deltaY))
    const factor = Math.pow(1.0015, clampedDelta)
    onIntent({
      type: 'zoom',
      factor,
      anchorPx: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    })
  }

  const onPointerDown = (evt: Event) => {
    const e = evt as PointerEvent
    dragging = true
    pointerId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    // not implemented in every test/render environment (e.g. jsdom) — real
    // browsers support it on SVG elements, and dragging still works without
    // it, just without capture outside the element's bounds.
    target.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (evt: Event) => {
    const e = evt as PointerEvent
    if (!dragging || e.pointerId !== pointerId) return
    const dxPx = e.clientX - lastX
    const dyPx = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    onIntent({ type: 'pan', dxPx, dyPx })
  }

  const endDrag = (evt: Event) => {
    const e = evt as PointerEvent
    if (e.pointerId !== pointerId) return
    dragging = false
    pointerId = null
  }

  target.addEventListener('wheel', onWheel, { passive: false })
  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', endDrag)
  target.addEventListener('pointercancel', endDrag)

  return () => {
    target.removeEventListener('wheel', onWheel)
    target.removeEventListener('pointerdown', onPointerDown)
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', endDrag)
    target.removeEventListener('pointercancel', endDrag)
  }
}
