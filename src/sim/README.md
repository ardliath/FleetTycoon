# src/sim/

Pure TypeScript domain logic — routes, contracts, reliability, risk, economy,
docking physics, crew, ship condition. Data in, data out.

## The rules

1. **No React, Phaser, or DOM imports.** Nothing in this directory renders
   anything. If a file here needs to import from `../game/`, `../ui/`, or
   `../ship/`'s React components, that logic belongs somewhere else.
2. **No `Math.random()` or `Date.now()`.** Take an `Rng` (see `rng.ts`) and
   an explicit timestamp/tick count as arguments instead. Same inputs must
   always produce the same outputs — that's the whole point of this layer.
3. **State advances in fixed ticks, never by frame delta.** Use the
   accumulator in `tick.ts`. A `step(state, inputs, rng)` function should
   never take a variable `deltaMs` and scale its math by it.

## Why

- **Testable.** Pure functions with no browser needed — fast, trivial unit
  tests (see `docs/ROADMAP.md`, Testing strategy).
- **Deterministic.** A given seed + tick count always reproduces the same
  run. Useful for debugging now; the only sane foundation for offline/idle
  catch-up simulation later (run N ticks in a loop, no rendering).
- **Portable.** If this project ever needed a different engine (see
  `docs/ROADMAP.md`, Portability strategy), this is the layer worth
  preserving — a small set of precisely-specified pure functions is a clean
  spec to reimplement, regardless of what renders them.

Full context: `docs/ROADMAP.md` (Technical architecture) and `docs/GAME_DESIGN.md`.
