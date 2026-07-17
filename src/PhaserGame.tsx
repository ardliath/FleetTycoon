import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react'
import Phaser from 'phaser'
import { gameConfig } from './game/config'
import { EventBus } from './game/EventBus'

export interface PhaserGameRef {
  game: Phaser.Game | null
  scene: Phaser.Scene | null
}

export const PhaserGame = forwardRef<PhaserGameRef>(function PhaserGame(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useLayoutEffect(() => {
    if (gameRef.current || !containerRef.current) return

    const container = containerRef.current
    gameRef.current = new Phaser.Game({
      ...gameConfig,
      parent: container,
      width: container.clientWidth,
      height: container.clientHeight,
    })

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      gameRef.current?.scale.resize(width, height)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleSceneReady = (scene: Phaser.Scene) => {
      const value = { game: gameRef.current, scene }
      if (typeof ref === 'function') {
        ref(value)
      } else if (ref) {
        ref.current = value
      }
    }

    EventBus.on('current-scene-ready', handleSceneReady)
    return () => {
      EventBus.off('current-scene-ready', handleSceneReady)
    }
  }, [ref])

  return <div ref={containerRef} className="game-container" />
})
