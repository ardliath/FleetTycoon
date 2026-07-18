# Fleet Tycoon — Game Design Vision

A living document. This captures the vision as discussed through July 2026; it will be revised as design decisions firm up. Open questions are marked explicitly rather than guessed at.

**How to read this document.** This is the dream — the full shape of the game Adam wants to build and play, not a v1 spec. Real development will be iterative: build a piece, learn it's not right, revise. That's expected and healthy, not a sign this document failed. There is deliberately no user research or market-fit validation planned — the audience is Adam himself, and that's sufficient. Don't propose "what would other players want" style features or suggest playtesting; optimise for the game Adam actually wants.

## Elevator pitch

A ferry management tycoon in the vein of RollerCoaster Tycoon / Airline Tycoon, set on Scotland's west coast with a CalMac-inspired fleet. Run routes, keep island communities served, keep your contracts — and when a docking goes bad because you cheaped out on the crew, you can grab the helm yourself and try to save it.

## Core loop

You run a ferry company operating under contract to serve island routes.

- **Propose and run routes** to serve island communities. Demand varies by island (Arran is busy; Lismore is quiet).
- **Some routes carry a subsidy** — lifeline routes (e.g. Tiree, Barra) that can't be commercially viable on fares alone.
- **Reliability is the core constraint.** Each route contract has a reliability bar (on-time / non-cancelled sailings). Miss it too often and you lose the contract — it's re-tendered away from you.
- **The central tension**: sailing in marginal conditions risks damaging the ship (and losing it to drydock, which risks *more* cancellations); cancelling protects the ship but burns your reliability score directly. There's rarely a free choice.

Whether a fully simulated rival operator exists, or losing a contract is more abstracted ("someone else gets it"), is open — leaning toward abstracted-but-real-feeling to start (see Open Questions).

## Economy

Not aiming for a GDP-accurate CalMac financial model — real subsidised ferry routes generally aren't profitable, and that's not fun to simulate literally. Aiming instead for numbers that are internally consistent and satisfying to optimise, RCT-guest-happiness-style.

- **Revenue**: fares, freight, and per-route subsidy for lifeline routes.
- **Costs**: fuel, crew wages, maintenance, ship purchase/lease, repair/drydock.
- Exact subsidy model (flat lifeline top-up vs. usage-scaling) is undecided.

## Geography & hazard

The map is grounded in real CalMac geography — real islands, real routes, real relative distances — but hazard data is **authored, not live**. No external weather/tidal API integration for now; that's a possible future stretch, not a dependency to build around.

- Hand-authored **hazard zones** overlaid on the map: shallow banks, exposed open-water stretches, and specific notoriously dangerous passages (Sound of Harris / Berneray–Leverburgh, the Corryvreckan, etc.).
- A **daily/session weather forecast** is visible to the player ahead of sailings — risk should be a decision you can see coming, not pure bad luck discovered after the fact.
- **Route risk** is a function of: hazard zones crossed × today's weather × ship suitability (size/seaworthiness for the crossing) × crew/captain skill.
- Ship/route mismatches are a hard structural signal, not just a probability tweak: put a tiny Loch class ferry on the Minch and the captain should **refuse to sail** rather than the game quietly rolling dice on a disaster you didn't understand you were risking.

## Time & simulation

Real-time, heavily compressed — roughly **10–15 real minutes per game day**, giving something like a 60–90x compression ratio. A long crossing (Oban–Barra, ~5 real hours) takes roughly 5 real minutes in-game; a short hop takes roughly 1 real minute.

- **Live**: simulation runs while you're actively playing.
- **Offline/idle (stretch)**: the game keeps simulating (in compressed/catch-up form) while you're not playing. Mechanism TBD. (Note: "stretch" here is a scope call, not a build-order phase — see `docs/ROADMAP.md` for actual sequencing, which owns "Phase N" numbering.)

## Views & visual language

- **Map / route planning** is top-down — the spatial, tactical layer.
- **The docking minigame** is top-down with extra close-quarters detail: channel/route buoys, wind indicator, pier/slipway geometry.
- **The side-profile ship renders** (already built — see Fleet & ship building below) are the "hero shot," used whenever a specific ship is the focus rather than the map: watching it out on passage, and the in-port management screens (crew assignment, maintenance, refits, condition/damage inspection). Top-down is for spatial decisions; side elevation is for anything that's about the ship itself as an object.
- Whether the main "watch your fleet sail" view shows all ships top-down on the map (with side-profile reserved for when you focus on one) or is itself side-on is still open — leaning toward the former since a side-on view doesn't obviously generalise to watching several ships on different headings across the whole map at once.

## Platform & input

- **Web first.** Desktop browser is the primary target.
- **Architected for a possible future iPad port** — not built now, but core game logic should stay portable rather than accumulate web-only assumptions. Phaser's rendering and pointer-event model already work fine in mobile Safari/WKWebView, which keeps this realistic without a rewrite.
- **Every control surface goes through an input-intent layer** (e.g. `portEngineAhead`, `bowThrusterLeft`), not direct `keydown`/click bindings in gameplay code. Keyboard, mouse, and on-screen touch controls all drive the same intents. This matters most for the docking minigame, which is the most input-heavy piece of the game — on-screen virtual controls (sliders/buttons for the two engines and thruster) need designing alongside the keyboard scheme from the start, not bolted on after.

## Fleet & ship building

The parametric ship builder (`src/ship/`) already exists and is the intended asset pipeline: one `ShipDesign` JSON produces both a side-profile and top-down SVG render. It currently covers **Big Ships** only.

Four real CalMac-inspired fleet classes, per the original vision:

- **Island class** — small, near-identical shuttle ferries.
- **Loch class** — double-ended, wide range of sizes.
- **Streakers** — legacy/retired-flavoured, lower priority.
- **Big Ships** — the flagship vessels; the builder's current focus, with hero presets for Isle of Arran, Caledonian Isles, Clansman, and others being hand-tuned by Adam against reference photos (see the tuning-workflow memory).

Additional systems implied by gameplay, not yet modelled:

- **Ship condition/wear**: age and maintenance history should affect breakdown/damage odds, independent of the builder's cosmetic parameters.
- **Ship suitability**: a structural property (size/class vs. route hazard), used both for risk maths and for the captain-refuses-to-sail gate above.

## Crew & captains

- Crew (captains in particular) have an experience stat that offsets route risk.
- Cheaper/less experienced crew cost less but raise risk — a real economic trade-off, not just flavour.
- Automated captains handle routine sailings and will refuse a sailing that's a structural mismatch, teaching the risk system through friction rather than punishing a mistake the game let you make blindly.
- How crew gain experience over time (sailings logged? training investment? both?) is undecided.

## The player's own licence & manual ship-handling — the standout feature

This is the mechanic that differentiates Fleet Tycoon from a pure spreadsheet tycoon.

- **The player holds their own captain's licence**, progressing through the same tiers as hired crew: Island class → Loch class → Big Ships.
- **This licence progression *is* the tutorial.** Starting a new player on a small Island class shuttle in calm water isn't just easy content — it's the onboarding sequence, told entirely in-fiction rather than as a bolted-on separate tutorial mode.
- Once licensed for a class, the player can **take manual control of any of their own ships, at any time** — not gated to emergencies, though emergencies are naturally when it matters most. Example: the *Caledonian Isles* coming into Ardrossan in a crosswind at low tide, with a cheap captain aboard — take over, work the bow thruster to hold her off the dock while the (AI) dock crew get lines on.
- **Manual control carries real risk.** You can genuinely damage or write off your own ship with bad handling — it resolves through the same consequence tiers as automated-captain risk (delay + repair cost, vs. drydock + ship unavailable). This matters for balance: if manual takeover were free upside, hiring good crew would stop being a real decision for any reasonably skilled player.
- **Control scheme**: realistic twin-screw differential thrust (independent port/starboard engine, ahead/astern, for turning without needing headway) plus a bow thruster for lateral push — how real CalMac ferries actually dock without tugs. Leaning toward **no rudder** in the minigame, to keep it a tight, learnable 2–3-input scheme; a stern thruster may be modelled for the larger ships that have one in reality.
- **Mooring lines are an open question** (see below) — currently framed as the AI dock crew's job while the player handles propulsion, but Adam flagged lines as potentially a meaningful strategic layer in their own right, worth revisiting later rather than deciding now.
- **The docking view** is top-down, like the rest of the game, but with more visual detail specific to this close-quarters moment: channel/route buoys, a wind direction/strength indicator, presumably tide/current indicators, and the pier/slipway geometry itself.
- **You get a notice, not a surprise.** As a ship approaches its dock, the game surfaces an alert with enough lead time to decide whether to take over — current weather/conditions are visible at that point (the same forecast system from Geography & hazard), so the decision to intervene is informed, not a blind reaction. This resolves how takeover coexists with a real-time game: you don't need to be staring at every ship at all times, you get pulled in when it matters.

## Open questions (deliberately deferred)

- **Mooring lines**: automated (AI dock crew) vs. a strategic layer the player also engages with. Explicitly parked — "don't need to worry about that now."
- ~~**Manual-mode failure severity**~~ — **Resolved (Phase 2, 2026-07-18):** different, deliberately. Automated sailings resolve through the risk-roll odds/tiers in `sim/captain.ts` (hazard × weather × captain skill). Manual dockings instead resolve deterministically from the docking attempt's own physics — impact speed at contact (see `sim/dockingOutcome.ts`'s `SEVERE_IMPACT_SPEED` threshold) decides `damaged` vs. `severelyDamaged`, with no separate roll. A human reading the situation live gets to earn (or blow) the outcome directly, rather than have it re-randomized on top of their play.
- **Licence progression gating**: skill-demonstrated (must actually dock competently to advance) vs. experience/hours-logged, or a mix?
- **Subsidy model**: flat lifeline top-up per route, or something that scales with usage/passengers carried?
- ~~**Rival operator**~~ — **Partially resolved (Phase 2, 2026-07-18):** contract loss is route-scoped and abstracted, not a simulated rival — losing the one route Phase 2 tracks just ends that contract ("re-tendered away"), no competing-operator simulation underneath it. Whether a fuller rival-operator layer ever gets built on top of that abstraction is still open.
- **Freight vs. passenger simulation depth**: not yet discussed.
- **Seasonal demand variation**: not yet discussed.
- **Day-to-day route operation mechanics**: timetabling, sailing frequency, capacity-to-demand matching — the actual UI/mechanical shape of "running a route properly" hasn't been discussed in detail yet.
- **Pause & time controls**: a real-time game with 10–15-minute days needs an answer for stepping away — pause, and possibly fast-forward through quiet stretches. Still open. The one piece that's ~~resolved~~ — **Phase 2, 2026-07-18:** no hard pause when a docking notice fires unattended; the automated captain resolves it normally after a short response window (`sim/captain.ts`'s risk roll, same as any other automated sailing). The broader pause/fast-forward question for quiet stretches between notices is still undiscussed.
- **Audio**: entirely undiscussed. Flagging because docking feel is half sound (engine note under load, wind, gulls, the ramp clunk) — the roadmap notes a cheap placeholder pass as a Phase 1 stretch, but the actual audio direction is an open design area.
- **Offline/idle progression mechanism** (stretch): catch-up simulation approach undecided.

## Risks & things to watch

Flagged during design discussion — not blockers, just things worth being deliberate about:

- **Determinism.** Risk rolls (weather, accidents) should come from a seeded RNG rather than raw randomness, so a day's outcome is reproducible — useful for debugging now, and the only sane foundation for the offline/idle catch-up simulation later (see Time & simulation).
- **Scope discipline.** This is a dream-scope document by design (see "How to read this document" above), spanning contracts/reliability, economy, authored hazard/weather geography, crew progression, ship wear, a real-time docking minigame with dual-input support, four fleet classes, and web-now-tablet-later portability. The phased plan should sequence a genuinely thin, playable vertical slice first — one route, one ship class, the core reliability loop, docking minigame optional/stubbed — before building breadth across every system in parallel.
- **Map/hazard geography is content-authoring work, not just code** — plotting real island positions, route paths, and hazard zones for the west coast at a usable stylised level is production effort, in the same spirit as the ship-photo tuning workflow. A lightweight "map builder" tool, same philosophy as the ship builder, is likely worth building rather than hand-coding coordinates.
- **Save-game persistence** (company, fleet, contracts, progress) needs its own store, related to but distinct from the ship-builder's localStorage persistence. The swappable `DesignStore` pattern already built is good precedent to reuse — and keeping storage behind an interface now is exactly what makes a future iPad storage swap easy later.

## Relationship to existing work

- The ship builder (`src/ship/`) is built and works for Big Ships; Island class, Loch class, and Streakers are unmodelled.
- See the `tuning-workflow` memory: Adam visually matches hero ships against reference photos using the builder's tracing overlay and hands back JSON for Claude to hardcode into `src/ship/presets.ts` — Claude does not eyeball photos to tune presets.
