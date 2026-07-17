import Phaser from 'phaser'
import { DockingScene } from './scenes/DockingScene'

export const dockingConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#25506e',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [DockingScene],
}
