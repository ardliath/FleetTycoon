# Fleet Tycoon

A browser-based fleet management game. React drives the UI/controls, [Phaser](https://phaser.io/) renders the game viewport, and the two talk to each other over a small event bus.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- [Phaser 3](https://phaser.io/) for the game canvas
- Deployed to GitHub Pages via GitHub Actions

## Development

```bash
npm install
npm run dev
```

## Project structure

```
src/
  App.tsx            # top-level tabs: Shipyard / Fleet / Harbour
  PhaserGame.tsx      # mounts/tears down the Phaser.Game instance
  game/
    config.ts         # Phaser game config, scene list
    EventBus.ts        # React <-> Phaser event bridge
    scenes/
      MainScene.ts      # first playable scene
  ship/
    types.ts           # ShipDesign — parametric model of a "big ship"
    palette.ts         # CalMac livery colours
    presets.ts         # hero ships (Isle of Arran, Clansman, ...)
    ShipSideView.tsx   # side profile SVG renderer
    ShipTopView.tsx    # top-down deck plan SVG renderer
    ShipBuilder.tsx    # the builder UI
    FleetGallery.tsx   # review page rendering every preset
```

React components emit events on `EventBus` (e.g. `add-ship`) that Phaser scenes listen for, and scenes emit state changes back (e.g. `fleet-updated`, `gold-updated`) that React renders.

## The ship builder

Ships are data, not art: a `ShipDesign` JSON object (length, bow/stern style,
superstructure extent and decks, bridge style, funnel style/count/position,
masts, lifeboats, hull details) fully determines both the side profile and the
top-down view. Both renderers draw in metre coordinates inside a fixed-width
viewBox, so ships of different lengths appear at a consistent scale.

The intent is that in-game sprites are rasterised from these same SVG
renderers, so the builder, the fleet gallery, and the game all share one
source of truth.

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the app and publishes `dist/` to GitHub Pages.

One-time setup in the GitHub repo: **Settings → Pages → Source → GitHub Actions**.

`vite.config.ts` sets `base: '/FleetTycoon/'` to match this repo's name — update it if the repo is ever renamed.
