import { Events } from 'phaser'

/**
 * Shared event bus for communication between React components and Phaser scenes.
 * React emits input events (e.g. 'add-ship'); scenes emit state changes
 * (e.g. 'fleet-updated', 'current-scene-ready') that React listens for.
 */
export const EventBus = new Events.EventEmitter()
