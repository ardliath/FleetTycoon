import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react'
import Phaser from 'phaser'
import { gameConfig } from './game/config'
import { EventBus } from './game/EventBus'

export interface PhaserGameRef {
  game: Phaser.Game | null
  scene: Phaser.Scene | null
}

interface PhaserGameProps {
  /** Override the default game config (e.g. a different scene list). */
  config?: Phaser.Types.Core.GameConfig
}

export const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>(function PhaserGame(
  { config = gameConfig },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  // captured once — the game is created a single time on mount; to switch
  // configs, remount the component (each tab does exactly that).
  const configRef = useRef(config)

  useLayoutEffect(() => {
    if (gameRef.current || !containerRef.current) return

    const container = containerRef.current
    gameRef.current = new Phaser.Game({
      ...configRef.current,
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
