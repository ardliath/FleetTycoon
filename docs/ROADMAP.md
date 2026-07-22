# Fleet Tycoon — Development Roadmap

A living document, companion to `docs/GAME_DESIGN.md`. That file is *what* we're building; this one is *how and in what order*. Same rules apply: dream-scope, expect revision, no market-fit work (see the `solo-passion-project-stance` memory).

## Guiding principles

1. **Fun before breadth.** Prove the standout mechanic (manual ship-handling) is actually fun before building the economy/contracts machinery around it. A tycoon game with no economy is a toy; a docking minigame that isn't fun is a dead end no amount of economy fixes.
2. **Playable, not complete, at every phase boundary.** Each phase ends with something you'd actually open and play for five minutes, not just code that compiles.
3. **The simulation is the asset that outlives any engine.** Rendering and UI will change; the rules of the game (risk, economy, reliability) shouldn't have to, and should be cheap to test and cheap to port.
4. **Test what's expensive to eyeball.** We already hit this twice with the ship renderer (a phantom third deck, a funnel a storey too high) — bugs that were only caught because Adam knows what these ships look like. Anything with that shape of risk (correct-looking output that's subtly wrong) gets a test; anything genuinely visual and subjective (does this ship look right, does docking feel good) stays a human judgement call.

## Technical architecture

New code should sit in a layered structure, most important rule first:

```
src/
  sim/          pure TypeScript domain logic — NO React, NO Phaser, NO DOM imports.
                 Routes, contracts, reliability, risk, economy, docking physics,
                 crew, ship condition. Data in, data out. Fully unit-testable
                 without a browser.
  game/          Phaser scenes — renders sim/ state, doesn't own game rules.
  ship/          the parametric ship builder (already built).
  ui/            React screens/panels.
  input/         input-intent layer: keyboard/pointer/touch -> named intents
                 (portEngineAhead, bowThrusterLeft, ...) -> sim/ actions.
  storage/       swappable persistence (DesignStore pattern already built;
                 a GameStateStore for company/fleet/contract saves follows
                 the same shape).
```

**Why `sim/` is sacred**: it's the one layer worth protecting from churn. Keeping it pure and dependency-free is what makes it (a) fast and trivial to unit test, (b) deterministic (see below), and (c) the layer most worth preserving if this is ever reimplemented in another engine — not because the TypeScript runs elsewhere, but because a small set of precisely-specified, well-tested pure functions is a clean spec to reimplement, and its JSON data formats can be reused as-is regardless of what renders them.

**Determinism is a hard rule, not a nice-to-have.** No `Math.random()` or `Date.now()` inside `sim/` — every function that needs randomness or time takes it as an argument (a seeded RNG instance, an explicit timestamp). This costs nothing now and is the only sane foundation for: reproducing a specific day's outcome while debugging, and offline/idle catch-up simulation later. A tiny hand-rolled seeded PRNG (e.g. mulberry32, ~5 lines) is enough — no dependency needed.

**The sim advances by fixed ticks, never by frame delta.** This is the other half of determinism, and it's easy to get wrong by accident: if physics or game state integrates Phaser's per-frame `delta`, outcomes vary with frame rate and no two runs are reproducible. Instead, `sim/` exposes `step(state, inputs, ...)` functions that advance exactly one fixed tick (e.g. 100ms of game time), and the render loop runs an accumulator: pile up real elapsed time, call `step` zero-or-more whole times, render the latest state (the standard "fix your timestep" pattern). Phaser may interpolate *visually* between ticks, but game truth only ever changes in whole ticks. Bonus: offline catch-up in the stretch phase becomes "run N ticks in a tight loop" — the exact same code path, just without rendering between ticks.

**Render-layer subscription granularity.** Phaser reads sim state every frame (it's drawing the world). React must **not** — UI panels subscribe to coarse snapshots (per game-minute, or on named events like `sailing-completed`), never per-tick, or a busy sim will drown React in re-renders. Cheap convention now, painful retrofit later.

## Testing strategy

- **Vitest** for unit tests — it's Vite-native, needs almost no setup, and runs fast without a browser.
- **Priority is `sim/`.** Pure functions, cheap to test, and bugs here are gameplay/balance bugs that are much harder to spot than a visual glitch — exactly the "expensive to eyeball" case from the guiding principles.
- **Golden/snapshot tests for the existing SVG renderers.** `ShipSideView`/`ShipTopView` output for each hero preset, snapshotted. This is retroactive protection for the exact bugs we already hit tuning Isle of Arran and Caledonian Isles — a snapshot diff would have flagged "this refactor reshaped an existing ship" immediately, before it needed a human to notice a phantom deck.
- **Snapshot updates are deliberate, never reflexive.** A failing ship snapshot means one of two things: a regression (fix the code) or an intentional visual change (eyeball the Fleet gallery first, *then* update snapshots). Never run the snapshot-update flag to make CI green without that check — a blind update converts this whole safety net into noise.
- **Skip component/E2E tests for now.** React Testing Library or Playwright are worth adding once there's a real loop worth protecting end-to-end (Phase 2+) or a UI flow complex enough to regress silently (e.g. a route-timetable editor). Adding them now would be testing infrastructure with no gameplay behind it yet.
- **CI**: add a test+typecheck+lint job (either a new `ci.yml` or a pre-deploy step in the existing `deploy.yml`) that blocks on failure. Currently `deploy.yml` builds and ships with no test gate at all.

## Portability strategy

**iPad**: covered in `docs/GAME_DESIGN.md` (Platform & Input) — input-intent abstraction, Phaser/React already work fine in mobile Safari/WKWebView, wrap with Capacitor if/when it's actually time.

**Unity**: being honest, there's no way to literally share this TypeScript/React/Phaser code with a Unity/C# project — that's not a realistic goal and I'm not going to pretend otherwise. What *is* realistically portable, and what the architecture above already buys for free:

1. **Content as data.** `ShipDesign` JSON, and future route/map/hazard/save JSON, stay plain engine-agnostic data (no functions, no Phaser-specific types embedded) — a Unity rewrite could load the exact same content files.
2. **`sim/` as a specification.** Small, pure, tested functions are a faithful reference to reimplement in C# — porting *logic*, not redesigning the game, if that day ever comes.
3. **Design work over code.** The ship-tuning effort (hero ship parameters matched to real photos) carries over even though the SVG rendering code doesn't — a Unity renderer would consume the same `ShipDesign` parameters with its own procedural mesh/sprite generation.

I'm deliberately **not** recommending an engine-agnostic rendering abstraction now (e.g. trying to keep Phaser swappable) — that's speculative over-engineering with no near-term Unity need. Keeping `sim/` pure and content as data costs little today and captures nearly all the realistic portability value.

## Working with Claude Code on this project

### What goes in `CLAUDE.md` vs. here vs. `docs/GAME_DESIGN.md`

`CLAUDE.md` loads into **every** session automatically, so it stays short and stable: commands, current architecture, and a handful of hard rules that apply regardless of what's being worked on. It points *to* this file and to `GAME_DESIGN.md` rather than duplicating them — a session only needs the full vision or the full phase plan loaded when it's actually relevant, not permanently burning context every session.

### Model selection

**Sonnet is the default** for essentially all of this project's work — it's already handled the ship builder, the SVG geometry, the persistence layer, and the git history surgery well over the course of this build. Reach for a frontier model — **Fable or Opus, interchangeably; Adam picks whichever his token budget allows on the day, and sessions shouldn't push for one over the other** — specifically for the handful of moments where getting the *shape* of something wrong is expensive to unwind later:

- Designing the risk/reliability formulas (Phase 2) and economy formulas (Phase 3) — many later systems build on this shape. Phase 0 itself is pure scaffolding (folder structure, well-known algorithms, test/CI config) with no real judgement calls in it, so it doesn't need this despite being where `sim/` first appears.
- Tuning the docking minigame's *feel* (Phase 1) — "is this actually fun" is a subtle judgement call worth the extra depth.
- Any future genuine architecture decision (starting the iPad/Capacitor work for real, or the hypothetical Unity port).

Routine, well-specified work (a new UI panel following an established pattern, a new ship preset once the schema exists, writing tests for already-designed pure functions, content entries once a format is set) doesn't need it. Haiku is an option for genuinely bulk mechanical transforms (e.g. reformatting dozens of content entries once a schema is locked), but with this project's cadence the switching overhead rarely pays for itself — don't bother unless a task is both large and mindless.

Honestly, the biggest token-economy lever for a project shaped like this isn't clever per-task model switching — it's **keeping `CLAUDE.md` and these docs lean, and writing them well enough that a new session loads state fast instead of me re-deriving context from scrollback.** That's most of what these two docs are for. Secondary lever: use `Explore`/general-purpose subagents for research-heavy digging once the codebase is bigger (finding every call site of something, auditing a pattern) so the main conversation thread doesn't spend its own context scanning files.

### Skills

Two project skills live in `.claude/skills/` (committed, so they're shared with any session working in this repo). Both are narrow and mechanical enough to be safe automations rather than judgement calls:

- **`ship-preset-import`** — Adam pastes a `ShipDesign` JSON matched in the builder against a reference photo → validate it against the type, hardcode it into `src/ship/presets.ts`, run the build, confirm rendering. A proven recurring workflow (see `tuning-workflow` memory), close to fully mechanical.
- **`phase-kickoff`** — start a roadmap phase from consistent grounding: load the phase section + relevant `GAME_DESIGN.md` context, ask the phase's open questions *before* coding, seed the task list, flag if the phase warrants a bigger model.

If either skill's instructions drift from reality (file moved, workflow changed), fix the skill in the same commit as the change that broke it.

---

## Phase 0 — Foundation

**Fun payoff**: none directly — this is the one phase that's pure infrastructure. Kept deliberately small so it doesn't delay Phase 1.

**Scope**:
- Scaffold `src/sim/` with the layering above; add a seeded PRNG utility and a fixed-tick time utility (tick size constant + accumulator helper), with the tick/determinism conventions documented inline where the next contributor will trip over them.
- Add Vitest (`npm i -D vitest`, a `test` script, minimal config) with one real test to prove the harness works.
- Add golden-snapshot tests for the existing `ShipSideView`/`ShipTopView` renderers across all current hero presets — immediate regression protection for work already done. Document the deliberate-update workflow (see Testing strategy) next to the tests.
- Add a CI job (test + typecheck + lint) gating on push/PR.
- Scaffold `src/input/` with the intent-mapping pattern (even with just one or two intents wired up, to establish the shape before Phase 1 needs it in earnest).

**Testing**: this phase *is* testing infrastructure — exit criteria includes "tests actually run in CI and fail the build on a real regression," proven by deliberately breaking something and watching it fail.

**Model**: Sonnet is fine throughout.

**Assets/questions needed**: none — this is pure infrastructure on existing code.

**Kickoff prompt**:
> Set up Phase 0 of the Fleet Tycoon roadmap (see `docs/ROADMAP.md`). Scaffold `src/sim/` as a pure, dependency-free TypeScript module with a seeded PRNG utility and a fixed-tick time utility (tick constant + accumulator), documenting the determinism and fixed-timestep conventions inline. Add Vitest with a `test` script and golden-snapshot tests covering every current hero preset's `ShipSideView`/`ShipTopView` output, with the deliberate-snapshot-update workflow documented beside them. Add a CI workflow that runs typecheck, lint, and tests on push/PR. Scaffold `src/input/` with an intent-mapping pattern (name a couple of example intents, don't over-build). No gameplay code yet — this phase is infrastructure only.

**Exit criteria**: `npm test` runs and passes locally and in CI; a deliberately-introduced bug in a renderer fails a snapshot test; `src/sim/` and `src/input/` exist with clear conventions documented inline for what goes in them.

**Done (2026-07-17).** All scope items landed: `src/sim/` (`rng.ts`, `tick.ts`, `README.md`), Vitest wired up (`npm test` / `test:watch`), 18 golden snapshots covering every hero preset's side + top view, `.github/workflows/ci.yml` (typecheck + lint + test on push/PR, kept separate from `deploy.yml`), `src/input/` (`intents.ts`, `keyboardIntents.ts`) with two example intents. Exit criteria proven directly: reintroduced the exact "extra deck of height" bug from earlier ship-tuning sessions and confirmed every side-profile snapshot failed for the right reason, then reverted clean.

Notes for later phases:
- Tick size defaults to 100ms (10 ticks/sec) — a starting point per the roadmap's own suggestion, not tuned. Phase 1 should retune it against actual docking feel, not treat it as settled.
- Snapshot tests use `renderToStaticMarkup` (react-dom/server) rather than jsdom + Testing Library — no DOM needed at all for pure-render output, keeps the suite fast. Worth reusing this pattern for any other pure-render snapshot need before reaching for jsdom.
- CI is a dedicated `ci.yml` (push + pull_request), not folded into `deploy.yml` (which stays push-to-main-only) — branches get tested before they ever reach main.

---

## Phase 1 — The docking feel

**Fun payoff**: this is the whole point of the phase. One ship, one crossing, and the manual ship-handling minigame — playable and, hopefully, actually fun, before a single line of economy code exists.

**Scope**:
- One hardcoded route between two fixed ports (reuse existing map/harbour visuals or something minimal — doesn't need real geography yet).
- One ship (reuse an existing preset, e.g. Isle of Arran) sailing that route in compressed real-time.
- **The SVG→Phaser texture pipeline, exercised for the first time.** The "one source of truth" claim (README/`GAME_DESIGN.md`) becomes real here: rasterise `ShipTopView` SVG output into a Phaser texture (SVG string → data URL → texture) so the ship sprite in the game *is* the builder's render. This is its own scoped task, not an assumed freebie — get it working for one ship at one zoom level before worrying about generality.
- The docking minigame itself: twin-screw differential thrust + bow thruster against a wind vector (start with a fixed or simple randomized wind, not the full weather system), rendered top-down with the detail called for in `GAME_DESIGN.md` (buoys, wind indicator, pier geometry).
- **Physics advances on the Phase 0 fixed tick, never on frame delta** — this is where that convention gets proven for real. Phaser may interpolate between ticks for smooth rendering, but ship position/velocity truth changes only in `sim/` steps.
- Manual takeover is always available (per design) — no notice/alert system yet, that's Phase 2 when there's something to be interrupted from.
- Win/fail feedback: successful alongside vs. a bump/damage outcome. No repair economy yet — a failed docking can just reset or show "you'd have damaged the ship here."
- Keyboard controls first; on-screen touch controls can follow once the keyboard scheme feels right, but both should go through the Phase 0 intent layer from the start so adding the second input method later is wiring, not rework.
- Stretch, only if the phase is going well: a first pass at engine/wind audio. Docking feel is half sound (engine note changing under load), and even placeholder audio may change the feel verdict this phase exists to deliver. Don't block the exit criteria on it.

**Testing**: the docking physics step (position/velocity given thrust inputs + wind, as a pure function in `sim/`) gets unit tests — given known inputs, verify known outputs. The *feel* of it doesn't get tested by an assertion; that's a human judgement call, playtested by Adam.

**Model**: lean toward a frontier model (Fable/Opus, per Model selection above) specifically for the physics/feel tuning pass — this is the "expensive to get the shape wrong" moment called out there. Routine wiring (rendering the buoys, hooking up the intent layer) is fine on Sonnet default.

**Assets/questions needed**:
- No new ship art needed (reuse an existing preset).
- Open design question to resolve during this phase: how forgiving should the physics feel be for a first pass? (Arcade-simple vs. something with real momentum/inertia — `GAME_DESIGN.md` leans arcade-simple; this phase is where that gets proven or revised.)

**Kickoff prompt**:
> Build Phase 1 of the Fleet Tycoon roadmap: the docking minigame, as its own small playable loop. One ship (reuse the Isle of Arran preset), one fixed two-port route, sailing in compressed real-time. First, rasterise the ship's `ShipTopView` SVG into a Phaser texture so the in-game sprite is the builder's render — one source of truth. Implement the docking physics (twin-screw differential thrust + bow thruster against a wind vector) as pure, unit-tested fixed-tick step functions in `src/sim/docking.ts` — advancing on the Phase 0 tick, never on frame delta — driven through the input-intent layer with a keyboard control scheme. Render it top-down with buoys, a wind indicator, and pier geometry per `docs/GAME_DESIGN.md`. No economy, no contracts, no crew yet — the only goal is: can you feel good bringing this ship alongside by hand.

**Exit criteria**: you can open the game, sail the one route, take manual control, and dock — and it's genuinely fun to attempt, per Adam's own judgement (this is the one exit criterion that isn't a checkbox).

---

## Phase 2 — The reliability loop

**Fun payoff**: "sailing a boat" becomes "running a route" — the core tycoon tension (sail risky vs. cancel safe) becomes real for the first time.

**Scope**:
- Contract/reliability bar for the one existing route: track on-time/cancelled sailings, define what losing the contract means (even if just "game over" for now, not a full re-tender simulation).
- A simple day/week cadence and a visible weather forecast ahead of each sailing.
- An automated captain (single skill stat) who handles a sailing if you don't intervene, including the refuse-to-sail gate for structural mismatches.
- The docking "notice" — an alert as the ship nears dock, giving you the informed choice to take over, per `GAME_DESIGN.md`.
- Risk resolution wired to the Phase 0 seeded RNG: hazard (still just the one route, can be a single hardcoded risk factor) × weather × captain skill.
- **Save/load of game state** — this phase creates the first progress that outlives a session (a contract's reliability history over game-weeks), so it's where the `GameStateStore` named in the architecture actually gets built: same swappable-interface pattern as the ship builder's `DesignStore`, localStorage implementation first. Without this, the "playable at every phase boundary" principle quietly breaks — you'd lose your company every refresh.

**Testing**: reliability-bar bookkeeping and the risk-roll formula are pure `sim/` functions — both fully unit-testable, including "does a known seed produce a known outcome" determinism checks.

**Model**: this is one of the frontier-model moments from above — the risk/reliability formula shape that later phases build on. Lean toward Fable/Opus for that specific design pass; the surrounding wiring (day/week cadence, the notice alert, save/load) is fine on Sonnet default.

**Assets/questions needed**: resolves two `GAME_DESIGN.md` open questions — manual-mode failure severity (same tiers as automated risk, or different), and how literally "lose the contract" should be simulated at this stage.

**Kickoff prompt**:
> Build Phase 2 of the Fleet Tycoon roadmap: turn the Phase 1 route into a real contract. Add a reliability bar tracking on-time/cancelled sailings for that one route, a day/week cadence with a visible weather forecast, and an automated captain (one skill stat) who sails routine crossings and refuses structurally mismatched ones. Wire risk resolution through the Phase 0 seeded RNG. Add the docking "notice" alert as a ship nears port so manual takeover is an informed choice, not something you have to watch for constantly. Build the `GameStateStore` (swappable interface like the ship builder's `DesignStore`, localStorage first) so company progress survives a page reload. Still one route, one ship — the goal is the sail-risky-vs-cancel-safe tension being real, not breadth.

**Exit criteria**: a played session can actually lose the contract through poor decisions, and it feels like *your* fault, not a random event.

**Done (2026-07-18).** All scope items landed: `sim/reliability.ts` (outcome tiers, rolling-window reliability score, threshold-based contract loss with a minimum-sailings guard), `sim/captain.ts` (the risk formula — `effectiveRisk = hazard × weather × (1 − 0.7×captainSkill)`, tiered into severe/damaged/late/onTime, verified with a 20,000-trial statistical distribution test), `sim/calendar.ts` (day advancement + weather forecast roll), `sim/dockingOutcome.ts` (maps a docking attempt to a `SailingOutcome` deterministically from impact speed, not a re-roll), `sim/seed.ts` (per-day/per-purpose deterministic seed derivation, so reloads don't need RNG state persisted), `storage/gameStateStore.ts` (`GameStateStore`, swappable like the ship builder's `DesignStore`, localStorage first), and `ui/RouteOverview.tsx` wired into the app as a new "Route" tab — forecast, reliability bar, day-progress clock, the docking notice, manual takeover into Phase 1's `DockingScene`, and the contract-lost screen. 117 tests passing across 13 files; typecheck/lint/build clean.

Exit criteria proven live in-browser: an unattended session ran dozens of automated days with weather severity visibly driving worse outcomes and the reliability bar tracking down/up correctly (100%→90%→92%→83%→90%, etc.); a deliberate string of cancelled sailings pushed reliability under the 60% threshold and produced the contract-lost screen with correct final stats; "Start a new contract" correctly reset to day 1/100%; state persistence was confirmed across a real page reload (resumed mid-contract from localStorage). Manual takeover was confirmed to mount `DockingScene` correctly inside the Route flow and receive keyboard input identically to the standalone practice tab — but, as in Phase 1, this environment's browser-automation tool cannot sustain a held keydown, so a full manual docking attempt's `docking-result` round trip is verified by `dockingOutcome.test.ts`'s 6 unit tests rather than an end-to-end live click-through. Same accepted standard as Phase 1: held-key feel and the full manual-docking-to-outcome path can only be confirmed by Adam's own hands.

Notes for later phases:
- `ROUTE_HAZARD`, `CAPTAIN_SKILL`, and `SHIP_SUITABILITY` are hardcoded constants in `RouteOverview.tsx`, deliberately — Phase 3 (crew) should make captain skill a real hireable stat; Phase 4 (map/fleet) should make hazard and ship suitability route- and fleet-dependent.
- `DAY_DURATION_MS` (45s) is still a build-time placeholder, not the design doc's target 10–15 real minutes — same untuned-on-purpose status as Phase 1's tick size. Revisit once there's open-water transit content to fill a longer day with something to watch.
- The day clock only persists on a day boundary (`advanceToNextDay`'s `persist()` call), not every tick — a reload mid-day resets that day's progress bar to 0 but does not lose reliability history or the current day count. Acceptable for now; revisit if it becomes a real annoyance during play.
- Phase 1's own exit criterion (does the docking minigame feel fun, Adam's judgement) is still unconfirmed — Adam explicitly chose to proceed to Phase 2 first rather than block on it. Worth returning to before Phase 3 stacks more mechanics on top of physics that haven't been felt yet.

---

## Phase 3 — Fleet & economy

**Fun payoff**: money and choices — buying ships, hiring crew, and living with the consequences of cheaping out.

**Scope**:
- Multiple ships, ship purchase/assignment.
- Basic economy: fares, running costs, maintenance, ship purchase/lease.
- Crew hiring with the experience stat from `GAME_DESIGN.md` actually affecting risk and costing more for better crew.
- Ship condition/wear model (age + maintenance history affecting breakdown odds) and the drydock repair flow.

**Testing**: economy calculations and the wear/condition model are pure `sim/` functions, unit tested. Worth a handful of "balance sanity" tests here too — e.g. a cheap crew + old ship combination should measurably raise incident rates over N simulated seeded days, proving the risk model actually responds to the levers it's supposed to.

**Model**: the core economy formula shape (fares/costs/subsidy/wear interacting) is the other frontier-model moment from the summary above — worth the extra depth since Phase 4's route economics build on it. Ship purchase/assignment UI and the crew-hiring flow itself are routine, Sonnet default.

**Assets/questions needed**: resolves the subsidy-model open question from `GAME_DESIGN.md` (needed once there's real money to balance against). No new art needed yet — still built on existing presets.

**Kickoff prompt**:
> Build Phase 3 of the Fleet Tycoon roadmap: fleet and economy. Support multiple ships and purchase/assignment, a basic economy (fares, running costs, maintenance, purchase/lease), crew hiring where experience measurably affects risk and cost, and a ship condition/wear model feeding the drydock repair flow from Phase 2's damage outcomes. Add balance-sanity tests: given a seeded RNG, a cheap-crew-old-ship combination should show a measurably higher incident rate over a simulated run than a well-crewed newer ship. Still one route — this phase is about depth on the company-management side, not the map.

**Exit criteria**: there's a real reason to spend more on crew and maintenance than the minimum, provable by the balance-sanity tests, not just vibes.

**Done (2026-07-18).** All scope items landed: `sim/economy.ts` (fares/subsidy revenue, fuel/wages/maintenance costs, ship purchase pricing — flat per-route subsidy per the confirmed design answer), `sim/crew.ts` (three hireable tiers — green/seasoned/veteran — whose experience climbs asymptotically from sailings logged, per the confirmed design answer, feeding `captain.ts`'s `captainSkill`), `sim/shipCondition.ts` (wear-per-sailing condition score, a severe knock triggers `sendToDrydock`/`needsDrydock` — 4 days unavailable plus an automatically-charged repair cost — and `releaseIfDue` brings her back at full condition), and `captain.ts`'s `effectiveRisk` extended with a `shipCondition` factor (a worn ship is a riskier ship, independent of route suitability). `storage/gameStateStore.ts`'s `ContractGameState` grew `cash`/`fleet`/`crew`/`assignedShipId`/`assignedCaptainId`, with `load()` defaulting them for any pre-Phase-3 save so nothing in progress was lost. A new "Company" tab (`ui/CompanyOverview.tsx`) handles ship purchase/assignment, crew hiring/assignment, and maintenance spend; `ui/RouteOverview.tsx` now resolves sailings against the actually-assigned ship/captain instead of flat constants, settles cash every day, and auto-cancels (with a status message, no notice) while the assigned ship is in drydock. 153 tests passing across 20 files, including `sim/balance.test.ts` — the phase's actual exit criterion — proving a green captain on a badly-worn ship incidents at over 5x the rate of a veteran on a near-new one.

Exit criteria proven two ways: the balance-sanity tests directly (`balance.test.ts`), and live in-browser — hiring a green captain and watching her experience visibly climb sailing over sailing; buying/maintaining ships correctly gating on `canAfford`; and, most tellingly, a ship forced into drydock (condition set low, `drydockUntilDay` set forward) auto-cancelled every day of her stint, which alone dragged reliability under the loss threshold and produced the contract-lost screen — the repair bill and the reliability hit compounding exactly as intended, not just in theory.

Notes for later phases:
- `ROUTE_HAZARD` and `SHIP_SUITABILITY` are still hardcoded in `RouteOverview.tsx` — Phase 4's hazard zones and varied fleet are what make these route- and ship-dependent for real.
- Crew and ship purchase/hire have no name-entry UI — captains are auto-named `Captain #N`; fine for now, worth revisiting if it stays feeling flat.
- `DAY_DURATION_MS` (45s) and the Phase 1 tick size remain untuned build-time placeholders — unchanged from prior phases' notes.
- Phase 1's own fun/feel exit criterion is *still* unconfirmed, three phases deep now. Genuinely worth returning to before Phase 4 adds a second route on top of docking physics nobody's confirmed feels good yet.

---

## Phase 4 — Map & multiple routes

**Fun payoff**: the actual tycoon layer opens up — propose routes, serve different islands, juggle a real network instead of one crossing.

**Scope**:
- A stylised west-coast map with several real islands, at real relative distances.
- Authored hazard zones (shallow banks, exposed stretches, named dangerous passages).
- Route proposal/creation, lifeline/subsidy-carrying routes, per-island demand variance.

**Testing**: hazard-zone intersection and route-risk calculation as pure, tested `sim/` functions.

**Model**: this isn't really a model-selection question at all — getting the hazard-zone geography to feel right is a content-authoring judgement call, the same category as ship-photo tuning, and per the `tuning-workflow` memory that's Adam's call, not something a bigger model does better. Sonnet is fine for the implementation (hazard-zone intersection code, map data structures) once the geography itself is decided.

**Assets/questions needed**: this is the content-heavy phase flagged in `GAME_DESIGN.md`'s Risks section. Needed:
- Real relative positions for the islands/ports in scope (a rough real map or coastline reference is enough — doesn't need to be surveyed-accurate, just recognisably right).
- A list of routes to include and which are lifeline/subsidised in reality (Adam's own knowledge is the primary source here).
- Which crossings are genuinely hazardous in real life, to seed the authored hazard zones (Sound of Harris/Berneray–Leverburgh and the Corryvreckan are already named in `GAME_DESIGN.md` as certain inclusions).
- Resolves the subsidy-model-vs-demand and day-to-day route-operation open questions.
- Possibly worth the lightweight "map builder" tool named in `GAME_DESIGN.md`'s Risks section, if hand-coding coordinates gets painful — build it if the first few routes prove that friction real, not pre-emptively.

**Kickoff prompt**:
> Build Phase 4 of the Fleet Tycoon roadmap: the real map. Add a stylised west-coast map with [Adam to list the islands/routes in scope for this pass] at real relative distances, authored hazard zones for shallow water and known-dangerous passages (Sound of Harris/Berneray–Leverburgh, the Corryvreckan, plus [any others Adam names]), and route proposal with per-island demand variance and lifeline subsidy routes. Implement hazard-zone intersection and route risk as pure tested `sim/` functions. If hand-coding route/hazard coordinates becomes painful after the first few, stop and build the lightweight map-builder tool named in `GAME_DESIGN.md` rather than pushing through by hand.

**Exit criteria**: you can propose a new route, see it rated for risk before committing, and run a small network of two or three routes simultaneously.

**Done (2026-07-20).** Exit criteria met with the Clyde pilot (`sim/geography.ts`, `sim/hazard.ts`, 6 ports/3 routes with an honest hazard profile, route proposal UI showing risk/economics before committing, and `GameContext`'s shared day-clock driving several routes simultaneously) — confirmed live: proposing a route, then running three at once. Adam then asked to keep going rather than stop at the pilot ("build out the rest of Scotland"), so the phase closes having also shipped a live chart map (chart chrome, real coastline geometry, real depth contours, pan/zoom camera, live ship icons) and a second full region, Argyll & the Southern Hebrides (11 ports, 6 routes, real coastline via Overpass, real depth contours via EMODnet) generalised behind the same port/route data model the Clyde pilot introduced — none of which was in Phase 4's original named scope but builds directly on it rather than anticipating later phases.

Notes for later phases:
- The named hazard-zone crossings from `GAME_DESIGN.md` (Sound of Harris/Berneray–Leverburgh) aren't built yet — Argyll's own hazard zone is authored from its real geography, but the Sound of Harris sits in a region not yet sourced.
- Two coastline-rendering bugs surfaced and were fixed after real geographic data was in place (a peninsula clipped mid-shape by a query bbox; a mainland-closing rectangle sized off wild, unclipped endpoint data causing seam artefacts at two region borders) — worth remembering if a third region is ever added: derive closing rectangles from the region's own query bbox, never from raw chain endpoints.
- Phase 1's fun/feel exit criterion is still unconfirmed, four phases deep now.

---

## Phase 5 — Depth & breadth

**Fun payoff**: the game stops being "the demo" and starts being the dream document — more of everything, now that the spine is proven.

**Scope**:
- Additional fleet classes (Island class, Loch class) — art already exists in `Reference Images/`, presets follow the same tuning workflow as Big Ships.
- Licence progression mechanics finalised (skill-gated vs. hours-logged, per the open question).
- Seasonal demand variation, freight vs. passenger split, rival-operator abstraction.
- General polish pass.

**Testing**: same discipline as before — new `sim/` behaviour gets unit tests, new content gets golden/snapshot coverage where it's the kind of thing that could silently regress.

**Model**: Sonnet default; Fable/Opus for whichever of the remaining open design questions turns out to need real judgement once you're in it.

**Assets/questions needed**: Island/Loch class reference photos already exist and are sorted; no new gathering needed, just the tuning workflow already established. Resolves the remaining `GAME_DESIGN.md` open questions not already closed by earlier phases.

**Kickoff prompt**:
> Build out Phase 5 of the Fleet Tycoon roadmap: Island and Loch class ship presets (photos already sorted in `Reference Images/`, follow the existing tuning workflow), finalise licence progression per whichever answer to the open question in `docs/GAME_DESIGN.md` Adam has settled on, and add seasonal demand and freight/passenger depth. Treat this phase as several independent chunks — pick them up in whatever order is most interesting, this isn't a strict sequence.

**Exit criteria**: genuinely open-ended — this phase is "keep going," not a fixed target.

**First pass complete (2026-07-21).** Per Adam's "do all and commit in between" answer, this pass built every chunk in one continuous session rather than picking a single starting point:
- **Double-ended hulls** (`ShipDesign.doubleEnded`): mirrored-bow-curve bezier reversal in both `ShipSideView.tsx` and `ShipTopView.tsx` (hull outline, deck step-down, gantry mast, car-deck lanes, enclosed-stern ramp marking), gated so existing single-ended presets render pixel-identical — the geometry Loch class's double-ended hull form needs, though Loch class's own preset isn't built yet (see below).
- **`ShipClass`** (`island` / `loch` / `streaker` / `bigShip`) added to `ShipDesign`, backfilled onto all 9 existing hero presets as `bigShip`.
- **The player's own licence**, skill-demonstrated per the resolved `GAME_DESIGN.md` question: `sim/licence.ts`'s pure `recordManualDocking`/`canOperate`, wired into `GameContext` (gates `handleTakeControl`) and shown live on the Company tab with current tier and clean-docking progress.
- **Freight/passenger split + seasonal demand**: `sim/routeEconomics.ts`'s two independent demand streams, each with its own seasonal curve, capacity-matched per sailing against the assigned ship — see the resolved `GAME_DESIGN.md` questions above. `demandBalance.test.ts` proves the magnitude is real, not just directionally correct. Routes tab shows today's demand vs. capacity per stream, flagging when the ship is the binding constraint.

Verified live end-to-end: 228 tests passing (`npm test`), clean `tsc -b`/`lint`/`build`, and a real-time playtest on Adam's own save catching the licence gate in action — the Big Ship-class *Isle of Arran* correctly blocked from manual takeover on an Island-class licence, with the "not licensed yet" message rendering exactly as designed. (The save was snapshotted before the playtest and restored after, so none of it touched Adam's actual progress.)

Still outstanding, deliberately not attempted:
- **Island and Loch class presets** — blocked on Adam himself: he needs to trace the sorted `Reference Images/` photos against the now-double-ended-capable builder and hand back tuned JSON, per the `tuning-workflow` memory and `ship-preset-import` skill. Not something to eyeball from photos in-session. Until this happens, a fresh game has no ship that can ever satisfy the Island-class licence requirement — flagged rather than silently worked around (e.g. the starting licence tier wasn't fudged to paper over it).
- **Rival-operator abstraction** and the **general polish pass** — untouched this pass; the phase stays open per its own exit criteria.

---

## Phase 6 — From systems to a game (cohesion pass)

**Fun payoff**: it stops being a set of proof-of-concept tabs and becomes a game you inhabit and keep coming back to.

**Why this phase exists** (added 2026-07-21, after a step-back design session — see `docs/GAME_DESIGN.md`'s new "Game shape & engagement (the Hooked loop)" section): Phases 0–5 built the *systems* (economy, reliability, docking, crew, map) as independent, well-tested pieces. Adam's own read is that we have "proof of concepts and features but not an overall game." This phase is the connective tissue — framed with the Hooked model (Trigger → Action → Variable reward → Investment) and the stewardship-not-exploitation stance in the design doc. It is deliberately sequenced so the highest-leverage "makes it a game" work lands first.

**Model**: mostly Sonnet-default implementation. Two moments are design-shape work worth flagging for a heavier model *when reached*: the neglect/decay balance curve (chunk 1 — it's the economy-shape frontier-model category, like Phase 2/3's risk and economy formulas), and the home-screen / "harbour office" information architecture (chunk 9 — a genuine game-feel design call, not a mechanical one).

**Assets/questions needed**: crew portraits (chunk 4) and any "alive port" art (chunk 5) are content Adam may want to art-direct or source, same category as ship-photo tuning. Named-storm framing and community-voice copy (chunks 6, 8) benefit from Adam's own CalMac knowledge.

**Prioritised build order** (each chunk is a shippable increment; earlier = higher leverage / earlier dependency):

1. **Neglect must bite** — the sharpest gap. Wear and reliability genuinely degrade when unattended (unmaintained ships fail; missed sailings crater reliability; contracts can be lost), so attending the game *matters* instead of just printing money. Pure `sim/` work, unit-testable, with balance-sanity tests (an unattended fleet measurably decays over N seeded days). Must be designed together with a **humane away-handling**: a deliberate pause/fast-forward control (the open "pause & time controls" question) and the idle **digest** below, so the game demands care without demanding constant presence.

   **Done (2026-07-21).** Three pieces, each committed separately:
   - *A real pause control.* `GameContext`'s day-clock effect simply doesn't run while `paused` — a genuine freeze (no ticks, no calendar advance, no decay), not a display label; resuming resets the effect's elapsed-time tracking so no burst catches up. A topbar toggle (`App.tsx`'s `PauseToggle`), global since the clock runs above the tab switch, disabled while hand-docking (which already stops the clock).
   - *Passive condition decay.* `sim/shipCondition.ts`'s `applyPassiveDecay` (0.02/day) and `applyRoutineUpkeep` (0.006/day — this is what finally gives the previously-inert `maintenancePerDay` charge a real effect, closing that dead-mechanic disconnect). Net −0.014/day drift on every owned ship even with routine upkeep; an actively-sailing ship adds ~0.01/day outcome wear on top. Applied once per day *per day advanced* in the day-clock tick, skipping drydocked ships. The player's manual `applyMaintenance` (+0.20 for £500) is the deliberate counter-lever — cheap insurance, so the cost of neglect is paid in *presence*, not cash.
   - *A breakdown channel (`sim/captain.ts`'s `breakdownChance`).* The teeth: passive decay alone barely changes outcomes on a sheltered route (the risk formula multiplies by hazard, so doubling a tiny number stays tiny). A hazard-and-weather-independent breakdown chance — zero at/above 50% condition, quadratic up to ~40% at condition 0 — makes a run-down ship increasingly just *fail to sail* (a `cancelled` outcome), which craters reliability and loses contracts. This is "broken ships and nothing sailing" (Adam's own words) working on every route, not just exposed ones. Kept out of `effectiveRisk` so the whole existing risk/balance suite stays valid.

   Balance-sanity in `neglectBalance.test.ts` (the phase's exit bar): an untended ship rots past the breakdown threshold in ~30 days while a maintained one holds >85%; a neglected ship fails several times more sailings than a kept one on the same sheltered route. Verified live: condition drifts exactly −0.014/day, a run-down ship's sailing resolved as a breakdown cancellation, Maintain clawed +0.20 back, and pause froze the clock dead. 262 tests, typecheck/lint/build clean.

   *Deliberately deferred within this chunk:* **fast-forward** (only pause was needed as the humane counterpart; fast-forward becomes its own later increment), the **idle digest** (belongs with real offline/closed-tab catch-up, Phase 7), and a finding worth a design call — **drydock still resets a repaired ship to pristine**, so there's no permanent aging; it's no longer load-bearing for the money-printer (breakdowns lose you contracts before drydock can "save" a ship), but real ship lifecycle/retirement is a future question.
2. **Captains belong to ships, not routes** — a small model change (`gameStateStore`, `CompanyOverview`, resolution) done *before* more UI piles onto the current per-route assignment. Captain + ship becomes a bonded unit.
3. **The Bridge Log** — one feed aggregating every trigger (forecasts, docking notices, contract renewals, letters, drydock-ready). Turns scattered tabs into a single narrative surface, and is the first concrete step toward the home-screen reframe (chunk 9). Biggest "feels like a game" win for the effort.
4. **Crew as people** — named captains with portraits and a little personality, not a "seasoned" tier label. Presentation + light data layer on top of the existing `sim/crew.ts`. Attachment/investment hook.
5. **Docking hero-moment pass** — the differentiator, in feel order: (a) **wakes / prop-wash feedback** so you see thrust firing before the hull responds — the single biggest feel fix; (b) **touch controls** for iPad, driving the existing input intents; (c) **ship-select + per-class handling** (per-ship docking params, rudder/thruster differences by class); (d) a **port that feels alive**; (e) **tutorial mode** on practice boats, where only real sailings count toward the licence.
6. **Community & reputation (the "tribe" reward)** — per-island standing plus letters/headlines reacting to your reliability. The biggest untapped immersion lever; makes cancellations *cost* something felt, not just a number.
7. **Tenders & contract structure** — routes are *won* with terms and renewal dates rather than merely "proposed," giving the career spine structure and a steady drip of future triggers.
8. **Named storms + offline digest** — the set-piece (a named weather event on the forecast days out → pre-position → sail/cancel triage → a reckoning and a story) plus the return digest. Depends on chunks 1 (decay), 3 (feed), 6 (community reaction).
9. **Home-screen / harbour-office reframe** — the screens transformation from peer-tab tool to a place you act from. Threaded through the phase (the Bridge Log in chunk 3 is its seed) and consolidated here rather than done as one risky big-bang rewrite.

**Runs in parallel, not blocking**: **map build-out** continues region by region via the `regional-chart-import` skill (gated on Adam's per-region data-scope calls); **Island/Loch/Streaker presets** and **truer CalMac-like builder work** remain Adam's own tuning-workflow todos.

**Exit criteria**: leaving the game unattended has real consequences; there's a single surface that tells you what needs you; a new player is onboarded in-fiction; and at least one storm has produced a story worth retelling. Open-ended beyond that, like Phase 5.

---

## Phase 7 (stretch) — Offline depth & platform ports

Explicitly not scoped in detail yet — revisit `docs/GAME_DESIGN.md`'s "Offline/idle" notes under Time & simulation when the earlier phases are solid. Note the offline *digest* and basic catch-up now land earlier, in Phase 6, as the humane counterpart to neglect-decay; what remains here is deeper idle/offline catch-up simulation (the determinism work from Phase 0 pays off here), the iPad/Capacitor wrap, and — only if it ever becomes real rather than hypothetical — beginning a Unity port using `sim/` as the specification per the Portability strategy above.
