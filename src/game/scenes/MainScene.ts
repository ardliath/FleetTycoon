import Phaser from 'phaser'
import { EventBus } from '../EventBus'

export class MainScene extends Phaser.Scene {
  private ships: Phaser.GameObjects.Arc[] = []
  private gold = 0

  constructor() {
    super('MainScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1d3a')

    this.add.grid(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      64,
      64,
      0x0b1d3a,
      1,
      0x14315c,
      0.6,
    )

    EventBus.on('add-ship', this.addShip, this)

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.gold += this.ships.length
        EventBus.emit('gold-updated', this.gold)
      },
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('add-ship', this.addShip, this)
    })

    EventBus.emit('current-scene-ready', this)
  }

  private addShip() {
    const ship = this.add.circle(
      Phaser.Math.Between(40, this.scale.width - 40),
      Phaser.Math.Between(40, this.scale.height - 40),
      12,
      0xffcc00,
    )
    this.ships.push(ship)

    this.tweens.add({
      targets: ship,
      x: `+=${Phaser.Math.Between(-120, 120)}`,
      y: `+=${Phaser.Math.Between(-120, 120)}`,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    EventBus.emit('fleet-updated', this.ships.length)
  }
}
