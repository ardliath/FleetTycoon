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

**Determinism is a hard rule, not a nice-to-have.** No `Math.random()` or `Date.now()` inside `sim/` — every function that needs randomness or time takes it as an argument (a seeded RNG instance, an explicit timestamp). This costs nothing now and is the only sane foundation for: reproducing a specific day's outcome while debugging, and phase-2 offline/idle catch-up simulation later. A tiny hand-rolled seeded PRNG (e.g. mulberry32, ~5 lines) is enough — no dependency needed.

## Testing strategy

- **Vitest** for unit tests — it's Vite-native, needs almost no setup, and runs fast without a browser.
- **Priority is `sim/`.** Pure functions, cheap to test, and bugs here are gameplay/balance bugs that are much harder to spot than a visual glitch — exactly the "expensive to eyeball" case from the guiding principles.
- **Golden/snapshot tests for the existing SVG renderers.** `ShipSideView`/`ShipTopView` output for each hero preset, snapshotted. This is retroactive protection for the exact bugs we already hit tuning Isle of Arran and Caledonian Isles — a snapshot diff would have flagged "this refactor reshaped an existing ship" immediately, before it needed a human to notice a phantom deck.
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

Sonnet is the right default for essentially all of this project's work — it's already handled the ship builder, the SVG geometry, the persistence layer, and the git history surgery well over the course of this build. I'd reach for **Opus** (or Sonnet at high reasoning effort) specifically for the handful of moments where getting the *shape* of something wrong is expensive to unwind later:

- Designing the risk/reliability formulas (Phase 2) and economy formulas (Phase 3) — many later systems build on this shape. Phase 0 itself is pure scaffolding (folder structure, a well-known PRNG algorithm, test/CI config) with no real judgement calls in it, so it doesn't need this despite being where `sim/` first appears.
- Tuning the docking minigame's *feel* (Phase 1) — "is this actually fun" is a subtle judgement call worth the extra depth.
- Any future genuine architecture decision (starting the iPad/Capacitor work for real, or the hypothetical Unity port).

Routine, well-specified work (a new UI panel following an established pattern, a new ship preset once the schema exists, writing tests for already-designed pure functions, content entries once a format is set) doesn't need it.

Honestly, the biggest token-economy lever for a project shaped like this isn't clever per-task model switching — it's **keeping `CLAUDE.md` and these docs lean, and writing them well enough that a new session loads state fast instead of me re-deriving context from scrollback.** That's most of what these two docs are for. Secondary lever: use `Explore`/general-purpose subagents for research-heavy digging once the codebase is bigger (finding every call site of something, auditing a pattern) so the main conversation thread doesn't spend its own context scanning files.

### Skills

Two are worth building, both narrow and mechanical enough to be safe automations rather than judgement calls:

- **Ship preset import.** Adam pastes a `ShipDesign` JSON matched in the builder against a reference photo → validate it against the type, hardcode it into `src/ship/presets.ts` in the right place, run the build, confirm the dev preview still renders. This is already a proven recurring workflow (see `tuning-workflow` memory) and is close to fully mechanical.
- **Phase kickoff.** Load the relevant phase section of this roadmap plus `GAME_DESIGN.md`, restate scope/exit-criteria/testing expectations, and seed `TaskCreate` entries for that phase — so every phase starts from the same grounding instead of being re-derived from memory each time.

I haven't scaffolded these as actual skill files yet — I don't have a confirmed skill-file schema for this environment in front of me, and getting that wrong silently (a file that looks right but doesn't register) is worse than not having it. Worth doing as a real Phase 0 task once confirmed, not guessed at here.

---

## Phase 0 — Foundation

**Fun payoff**: none directly — this is the one phase that's pure infrastructure. Kept deliberately small so it doesn't delay Phase 1.

**Scope**:
- Scaffold `src/sim/` with the layering above; add a seeded PRNG utility.
- Add Vitest (`npm i -D vitest`, a `test` script, minimal config) with one real test to prove the harness works.
- Add golden-snapshot tests for the existing `ShipSideView`/`ShipTopView` renderers across all current hero presets — immediate regression protection for work already done.
- Add a CI job (test + typecheck + lint) gating on push/PR.
- Scaffold `src/input/` with the intent-mapping pattern (even with just one or two intents wired up, to establish the shape before Phase 1 needs it in earnest).

**Testing**: this phase *is* testing infrastructure — exit criteria includes "tests actually run in CI and fail the build on a real regression," proven by deliberately breaking something and watching it fail.

**Model**: Sonnet is fine throughout.

**Assets/questions needed**: none — this is pure infrastructure on existing code.

**Kickoff prompt**:
> Set up Phase 0 of the Fleet Tycoon roadmap (see `docs/ROADMAP.md`). Scaffold `src/sim/` as a pure, dependency-free TypeScript module with a seeded PRNG utility. Add Vitest with a `test` script and golden-snapshot tests covering every current hero preset's `ShipSideView`/`ShipTopView` output. Add a CI workflow that runs typecheck, lint, and tests on push/PR. Scaffold `src/input/` with an intent-mapping pattern (name a couple of example intents, don't over-build). No gameplay code yet — this phase is infrastructure only.

**Exit criteria**: `npm test` runs and passes locally and in CI; a deliberately-introduced bug in a renderer fails a snapshot test; `src/sim/` and `src/input/` exist with clear conventions documented inline for what goes in them.

---

## Phase 1 — The docking feel

**Fun payoff**: this is the whole point of the phase. One ship, one crossing, and the manual ship-handling minigame — playable and, hopefully, actually fun, before a single line of economy code exists.

**Scope**:
- One hardcoded route between two fixed ports (reuse existing map/harbour visuals or something minimal — doesn't need real geography yet).
- One ship (reuse an existing preset, e.g. Isle of Arran) sailing that route in compressed real-time.
- The docking minigame itself: twin-screw differential thrust + bow thruster against a wind vector (start with a fixed or simple randomized wind, not the full weather system), rendered top-down with the detail called for in `GAME_DESIGN.md` (buoys, wind indicator, pier geometry).
- Manual takeover is always available (per design) — no notice/alert system yet, that's Phase 2 when there's something to be interrupted from.
- Win/fail feedback: successful alongside vs. a bump/damage outcome. No repair economy yet — a failed docking can just reset or show "you'd have damaged the ship here."
- Keyboard controls first; on-screen touch controls can follow once the keyboard scheme feels right, but both should go through the Phase 0 intent layer from the start so adding the second input method later is wiring, not rework.

**Testing**: the docking physics step (position/velocity given thrust inputs + wind, as a pure function in `sim/`) gets unit tests — given known inputs, verify known outputs. The *feel* of it doesn't get tested by an assertion; that's a human judgement call, playtested by Adam.

**Model**: lean toward Opus (or high-effort Sonnet) specifically for the physics/feel tuning pass — this is the "expensive to get the shape wrong" moment called out above. Routine wiring (rendering the buoys, hooking up the intent layer) is fine on Sonnet default.

**Assets/questions needed**:
- No new ship art needed (reuse an existing preset).
- Open design question to resolve during this phase: how forgiving should the physics feel be for a first pass? (Arcade-simple vs. something with real momentum/inertia — `GAME_DESIGN.md` leans arcade-simple; this phase is where that gets proven or revised.)

**Kickoff prompt**:
> Build Phase 1 of the Fleet Tycoon roadmap: the docking minigame, as its own small playable loop. One ship (reuse the Isle of Arran preset), one fixed two-port route, sailing in compressed real-time. Implement the docking physics (twin-screw differential thrust + bow thruster against a wind vector) as a pure, unit-tested function in `src/sim/docking.ts`, driven through the Phase 0 input-intent layer with a keyboard control scheme. Render it top-down with buoys, a wind indicator, and pier geometry per `docs/GAME_DESIGN.md`. No economy, no contracts, no crew yet — the only goal is: can you feel good bringing this ship alongside by hand.

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

**Testing**: reliability-bar bookkeeping and the risk-roll formula are pure `sim/` functions — both fully unit-testable, including "does a known seed produce a known outcome" determinism checks.

**Model**: this is one of the Opus-worthy moments from above — the risk/reliability formula shape that later phases build on. Lean toward Opus (or high-effort Sonnet) for that specific design pass; the surrounding wiring (day/week cadence, the notice alert) is fine on Sonnet default.

**Assets/questions needed**: resolves two `GAME_DESIGN.md` open questions — manual-mode failure severity (same tiers as automated risk, or different), and how literally "lose the contract" should be simulated at this stage.

**Kickoff prompt**:
> Build Phase 2 of the Fleet Tycoon roadmap: turn the Phase 1 route into a real contract. Add a reliability bar tracking on-time/cancelled sailings for that one route, a day/week cadence with a visible weather forecast, and an automated captain (one skill stat) who sails routine crossings and refuses structurally mismatched ones. Wire risk resolution through the Phase 0 seeded RNG. Add the docking "notice" alert as a ship nears port so manual takeover is an informed choice, not something you have to watch for constantly. Still one route, one ship — the goal is the sail-risky-vs-cancel-safe tension being real, not breadth.

**Exit criteria**: a played session can actually lose the contract through poor decisions, and it feels like *your* fault, not a random event.

---

## Phase 3 — Fleet & economy

**Fun payoff**: money and choices — buying ships, hiring crew, and living with the consequences of cheaping out.

**Scope**:
- Multiple ships, ship purchase/assignment.
- Basic economy: fares, running costs, maintenance, ship purchase/lease.
- Crew hiring with the experience stat from `GAME_DESIGN.md` actually affecting risk and costing more for better crew.
- Ship condition/wear model (age + maintenance history affecting breakdown odds) and the drydock repair flow.

**Testing**: economy calculations and the wear/condition model are pure `sim/` functions, unit tested. Worth a handful of "balance sanity" tests here too — e.g. a cheap crew + old ship combination should measurably raise incident rates over N simulated seeded days, proving the risk model actually responds to the levers it's supposed to.

**Model**: the core economy formula shape (fares/costs/subsidy/wear interacting) is the other Opus-worthy moment from the summary above — worth the extra depth since Phase 4's route economics build on it. Ship purchase/assignment UI and the crew-hiring flow itself are routine, Sonnet default.

**Assets/questions needed**: resolves the subsidy-model open question from `GAME_DESIGN.md` (needed once there's real money to balance against). No new art needed yet — still built on existing presets.

**Kickoff prompt**:
> Build Phase 3 of the Fleet Tycoon roadmap: fleet and economy. Support multiple ships and purchase/assignment, a basic economy (fares, running costs, maintenance, purchase/lease), crew hiring where experience measurably affects risk and cost, and a ship condition/wear model feeding the drydock repair flow from Phase 2's damage outcomes. Add balance-sanity tests: given a seeded RNG, a cheap-crew-old-ship combination should show a measurably higher incident rate over a simulated run than a well-crewed newer ship. Still one route — this phase is about depth on the company-management side, not the map.

**Exit criteria**: there's a real reason to spend more on crew and maintenance than the minimum, provable by the balance-sanity tests, not just vibes.

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

---

## Phase 5 — Depth & breadth

**Fun payoff**: the game stops being "the demo" and starts being the dream document — more of everything, now that the spine is proven.

**Scope**:
- Additional fleet classes (Island class, Loch class) — art already exists in `Reference Images/`, presets follow the same tuning workflow as Big Ships.
- Licence progression mechanics finalised (skill-gated vs. hours-logged, per the open question).
- Seasonal demand variation, freight vs. passenger split, rival-operator abstraction.
- General polish pass.

**Testing**: same discipline as before — new `sim/` behaviour gets unit tests, new content gets golden/snapshot coverage where it's the kind of thing that could silently regress.

**Model**: Sonnet default; Opus for whichever of the remaining open design questions turns out to need real judgement once you're in it.

**Assets/questions needed**: Island/Loch class reference photos already exist and are sorted; no new gathering needed, just the tuning workflow already established. Resolves the remaining `GAME_DESIGN.md` open questions not already closed by earlier phases.

**Kickoff prompt**:
> Build out Phase 5 of the Fleet Tycoon roadmap: Island and Loch class ship presets (photos already sorted in `Reference Images/`, follow the existing tuning workflow), finalise licence progression per whichever answer to the open question in `docs/GAME_DESIGN.md` Adam has settled on, and add seasonal demand and freight/passenger depth. Treat this phase as several independent chunks — pick them up in whatever order is most interesting, this isn't a strict sequence.

**Exit criteria**: genuinely open-ended — this phase is "keep going," not a fixed target.

---

## Phase 6 (stretch) — Offline progression & platform ports

Explicitly not scoped in detail yet — revisit `docs/GAME_DESIGN.md`'s "Offline/idle (stretch)" notes under Time & simulation when the earlier phases are solid. Candidate contents: idle/offline catch-up simulation (the determinism work from Phase 0 pays off here), the iPad/Capacitor wrap, and — only if it ever becomes real rather than hypothetical — beginning a Unity port using `sim/` as the specification per the Portability strategy above.
