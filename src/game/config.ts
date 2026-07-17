import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#0b1d3a',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [MainScene],
}
