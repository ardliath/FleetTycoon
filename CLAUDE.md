# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fleet Tycoon: a CalMac-ferry-inspired management tycoon, React + Phaser, deployed to GitHub Pages. It's a solo passion project for Adam — see the `solo-passion-project-stance` memory before suggesting anything shaped like user research or market fit.

The design vision lives in `docs/GAME_DESIGN.md` and the phased build plan in `docs/ROADMAP.md`. Read whichever is relevant to the task — don't assume either is fully implemented yet; the codebase today is the ship builder plus a minimal Phaser demo, well ahead of the wider game.

## Commands

```bash
npm run dev        # start the dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run preview    # preview a production build
npm test           # vitest run — single pass, what CI runs
npm run test:watch # vitest — watch mode for local dev
npx vitest run path/to/file.test.ts   # run a single test file
npx vitest run -t "test name"         # run tests matching a name
npx vitest run -u                     # update snapshots — see the warning atop renderSnapshots.test.tsx first
```

## Architecture

Two mostly-separate halves live under one tab shell (`src/App.tsx`, tabs: Shipyard / Fleet / Harbour):

- **`src/ship/`** — the parametric ship builder, the most developed part of the codebase. A `ShipDesign` JSON object (`types.ts`) fully determines both a side-profile and a top-down SVG render (`ShipSideView.tsx`, `ShipTopView.tsx`, funnel geometry factored out into `Funnel.tsx`). `presets.ts` holds hand-tuned hero ships (Isle of Arran, Caledonian Isles, ...); `ShipBuilder.tsx` is the interactive editor with a reference-photo tracing overlay; `FleetGallery.tsx` renders every preset for review. `storage.ts` persists the builder's working state (design, overlay, photo) to `localStorage` behind a swappable `DesignStore` interface — follow this same pattern for any future game-state save system rather than reaching for `localStorage` directly.
- **`src/game/`** + **`PhaserGame.tsx`** — a minimal Phaser scene (`MainScene.ts`) mounted from React, talking to it over a small pub/sub `EventBus` (React emits input events like `add-ship`; Phaser emits state changes like `fleet-updated` that React renders). This is currently just a demo, not the real game loop.
- **`src/sim/`** — pure TypeScript domain logic, no React/Phaser/DOM imports (see its own `README.md` for the rules and why). Currently just the Phase 0 foundation: `rng.ts` (seeded PRNG) and `tick.ts` (fixed-tick accumulator). Real game rules (routes, contracts, risk, economy, docking physics) land in later phases.
- **`src/input/`** — the input-intent layer: named intents (`intents.ts`) that adapters (`keyboardIntents.ts`) map physical input onto, so gameplay code never binds to DOM events directly. Currently just two example intents proving the pattern; Phase 1 grows this into the real docking control scheme.

**Ships are data, not art.** Both renderers draw in metre coordinates inside a fixed-width viewBox so ships of different lengths render at a consistent scale, and the same `ShipDesign` JSON is meant to eventually drive in-game sprites too — one source of truth, not per-ship hand-drawn assets.

**Ship visuals are tuned by Adam, not by eyeballing photos in-session.** He matches designs against reference photos using the builder's tracing overlay and hands back JSON for hardcoding into `presets.ts`. Don't adjust preset numbers from photo inspection — see the `tuning-workflow` memory.

## Conventions for new code (per `docs/ROADMAP.md`)

- Game-rule code belongs in `src/sim/` as pure TypeScript with no React/Phaser/DOM imports — data in, data out, fully unit-testable.
- No `Math.random()` or `Date.now()` inside `sim/` — take a seeded RNG and an explicit timestamp as arguments instead. This is a hard rule for determinism (debugging, and later offline/idle simulation), not a style preference.
- Sim state advances in fixed ticks via an accumulator, never by Phaser's frame delta — same determinism rule, time-shaped. Phaser may interpolate visually between ticks; game truth changes only in whole `sim/` steps.
- All input (keyboard, mouse, future touch) goes through a named intent layer rather than gameplay code binding directly to DOM events — this is what keeps a future iPad port realistic.

Project skills exist for the two recurring workflows: `ship-preset-import` (Adam pastes tuned `ShipDesign` JSON → validate → hardcode into presets) and `phase-kickoff` (start a roadmap phase from consistent grounding). Use them when those situations arise.

`vite.config.ts` sets `base: '/FleetTycoon/'` to match the GitHub repo name — update it if the repo is ever renamed.
