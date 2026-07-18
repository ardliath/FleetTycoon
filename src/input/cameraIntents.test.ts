import { describe, expect, it } from 'vitest'
import { bindCameraIntents, type CameraIntent } from './cameraIntents'

function pointerEvent(type: string, props: Partial<Record<string, unknown>>): Event {
  const e = new Event(type)
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(e, key, { value })
  }
  return e
}

// Tests run under Node, not jsdom — fake just the slice of SVGSVGElement
// bindCameraIntents actually touches, per CameraTarget.
class FakeTarget extends EventTarget {
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 }
  }
}

function makeSvg(): FakeTarget {
  return new FakeTarget()
}

describe('bindCameraIntents', () => {
  it('emits a zoom intent on wheel, anchored at the cursor', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    bindCameraIntents(target, (i) => intents.push(i))

    target.dispatchEvent(pointerEvent('wheel', { deltaY: 50, clientX: 30, clientY: 40, preventDefault: () => {} }))

    expect(intents).toHaveLength(1)
    expect(intents[0]).toMatchObject({ type: 'zoom' })
    if (intents[0].type === 'zoom') {
      expect(intents[0].factor).toBeGreaterThan(1) // positive deltaY -> zoom out
      expect(intents[0].anchorPx).toEqual({ x: 30, y: 40 })
    }
  })

  it('zooming in (negative deltaY) yields a factor below 1', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    bindCameraIntents(target, (i) => intents.push(i))

    target.dispatchEvent(pointerEvent('wheel', { deltaY: -50, clientX: 0, clientY: 0, preventDefault: () => {} }))

    expect(intents[0]).toMatchObject({ type: 'zoom' })
    if (intents[0].type === 'zoom') expect(intents[0].factor).toBeLessThan(1)
  })

  it('emits pan intents with pixel deltas while dragging', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    bindCameraIntents(target, (i) => intents.push(i))

    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 95 }))

    expect(intents).toEqual([{ type: 'pan', dxPx: 10, dyPx: -5 }])
  })

  it('ignores pointer moves before a pointerdown', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    bindCameraIntents(target, (i) => intents.push(i))

    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 10, clientY: 10 }))
    expect(intents).toHaveLength(0)
  })

  it('stops panning after pointerup', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    bindCameraIntents(target, (i) => intents.push(i))

    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }))
    target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1 }))
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }))

    expect(intents).toHaveLength(0)
  })

  it('the returned cleanup function removes all listeners', () => {
    const target = makeSvg()
    const intents: CameraIntent[] = []
    const cleanup = bindCameraIntents(target, (i) => intents.push(i))
    cleanup()

    target.dispatchEvent(pointerEvent('wheel', { deltaY: 10, clientX: 0, clientY: 0, preventDefault: () => {} }))
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }))
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 10, clientY: 10 }))

    expect(intents).toHaveLength(0)
  })
})
