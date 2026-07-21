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

## Game shape & engagement (the Hooked loop)

*Added 2026-07-21 after a step-back design session. The systems below (economy, reliability, docking, crew, map) are largely built as independent pieces; this section is about the connective tissue that turns them into one game you keep coming back to, framed with Nir Eyal's Hooked model (Trigger → Action → Variable reward → Investment). Framed as **stewardship, not exploitation** — the hook is caring for islands that depend on you, deliberately not energy timers, pay-to-skip, or manufactured FOMO. That's both an ethics call for a passion project and simply the better game.*

**The loop, in ferry terms:**

- **Trigger.** The compressed real-time clock plus the forecast and docking-notice systems already generate anticipation triggers ("Force 8 for the Minch tomorrow — three sailings at risk"). Externally these become notifications; internally, over time, they're replaced by *the itch* — a mix of stewardship anxiety and curiosity ("are my islands still being served? did the gamble pay off?"). Because time always runs, you always leave something in flight — that unresolved question is the re-entry hook, and it falls out of the clock for free.
- **Action.** The minimum session must be a ~20-second glance at the map (which is already good-looking enough that the glance feels good). Actions escalate from there: check a route → cover a gap → accept a tender → *take the helm.* The docking minigame is the hero action but must never be the price of entry.
- **Variable reward.** Must stay *variable* — finite variability is solvable and kills long-term play; infinite variability sustains it. Three types, all latent in the current build:
  - *Hunt* — every sailing is a pull of the lever (weather × hazard × crew skill decides the outcome); money and tenders arrive unpredictably. The slot-machine core, already built in `sim/captain.ts`/`reliability.ts`.
  - *Self* — mastery: a clean hand-docking in a gale, licence advancement, reliability clawing back up. **Completing the real CalMac fleet/network is finite; designing your own ships is infinite** — the two builder modes map exactly onto exhaustible-collection and endless-creation, which is why the player-facing builder is the endgame retention engine.
  - *Tribe* — **the islanders** (currently unbuilt, the biggest untapped lever): letters of thanks when reliable, complaints when you cancel the school-run sailing, a local-paper headline after a storm, a reputation per community. People depending on you creates stakes money never will, and it's what makes the game immersive rather than a spreadsheet.
- **Investment.** Nearly everything built already stores value and *loads the next trigger*: a ship in drydock is ready in N days (trigger); a trained captain's experience ticks up (attachment); a won lifeline contract commits you and its renewal date is a future trigger; reliability is stored value a storm can threaten; a ship you designed and nursed through a storm is one you'll never scrap.

**The aspiration spine (career arc, told in-fiction — the licence-as-tutorial decision already commits to this):**

- *Act I — Your ticket.* Island-class licence, one wee ferry, one sheltered Clyde hop. Learn the loop and learn to dock. Low stakes.
- *Act II — The company.* Win tenders across the Clyde and Argyll; collect named ships; hire and train crew; earn the Loch-class licence *by hand-docking well.* Plate-spinning begins.
- *Act III — The lifelines.* The hard, subsidised, exposed island routes (the Minch, the Sound of Harris, the Small Isles). Big Ships, real hazards, a community's lifeline and your name on the line.
- *Act IV — Your CalMac.* The whole network, seasonal pressure, your own designed ships in service. Endgame = optimisation + collector/creator itch + weathering the big storms.

**Session shapes** (one design serving several real-life session lengths, thanks to the compressed clock): the Glance (~20s: all's well / one thing needs me), the Tend (2–5 min: handle the day), the Storm (20+ min: the set-piece — multiple hand-dockings and hard sail/cancel triage), and idle catch-up (a digest on return: "34 sailings, 2 cancelled at Colonsay, £12,400, a complaint from Tiree" — simultaneously a reward and the next trigger).

**Named storms** are the key set-piece: a named weather event ("Storm Fionn") appears on the forecast days out (existing weather system, escalated), you pre-position and choose which crossings to attempt, and the aftermath is a reckoning *and a story you retell.* Storms convert systems into stories, and stories are what make it immersive rather than mechanical.

**Screens: a place, not a tab bar.** The current app is a peer-tab tool (Shipyard / Fleet / Map / Routes / Company / Docking) — a tool's information architecture, not a game's. The direction is a **home you inhabit** — a harbour office / bridge you act *from*, with the other surfaces reached from within that world rather than sitting as equal tabs. The **Bridge Log** (a single feed aggregating every trigger — forecasts, notices, renewals, letters, drydock-ready) is both the first step toward that home screen and the narrative surface that makes scattered systems read as one game. (The Views & visual language section covers the top-down/side-elevation split this sits on top of.)

**Neglect must bite.** Left running unattended, the game currently just accrues money — there's no reason to attend, which hollows out the entire loop. In reality an unattended network *degrades*: ships wear without maintenance and eventually fail, sailings start missing, reliability craters, contracts are lost. Wear and reliability need to genuinely bite when you're away — paired with a humane away-handling (deliberate pause/fast-forward and the idle digest above) so the game demands care without demanding constant presence. This is the single sharpest gap between "idle money-printer" and "management game," and it's what gives the stewardship trigger something to be anxious *about*.

## Economy

Not aiming for a GDP-accurate CalMac financial model — real subsidised ferry routes generally aren't profitable, and that's not fun to simulate literally. Aiming instead for numbers that are internally consistent and satisfying to optimise, RCT-guest-happiness-style.

- **Revenue**: fares, freight, and per-route subsidy for lifeline routes.
- **Costs**: fuel, crew wages, maintenance, ship purchase/lease, repair/drydock.
- ~~Exact subsidy model~~ — **Resolved (Phase 3, 2026-07-18):** flat top-up. The subsidy is a fixed daily payment per route (`sim/economy.ts`'s `subsidyPerDay`), landing regardless of whether the sailing happened — simple and predictable to balance costs against, rather than scaling with usage/passengers.

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
- ~~How crew gain experience over time~~ — **Resolved (Phase 3, 2026-07-18):** sailings logged, not training investment. Experience climbs automatically and asymptotically from time on the job (`sim/crew.ts`'s `experienceOf`) — simplest to simulate, no separate training-spend mechanic needed yet. A paid-training lever remains a possible later addition, not built now.
- **Crew are people, not stat blocks** (direction set 2026-07-21): named individuals with portraits, not a generic "seasoned" tier label. The current tier-only hiring UI (`ui/CompanyOverview.tsx`) is placeholder — a named captain you've trained through storms is an investment/attachment hook, and a face makes the "cheaped out on the crew" moment land emotionally.
- **Captains belong to ships, not routes** (direction set 2026-07-21): a captain is bonded to *their boat*, not reassigned per crossing — a model change from the current per-route assignment, and it makes captain + ship a unit with shared history. (Ships, in turn, are assigned to routes.)
- **Other crew roles beyond captains** are wanted, but their roles and effects are undecided — parked as an open item, don't invent them.

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

**Docking minigame — build-out intentions (set 2026-07-21).** The physics (`sim/docking.ts`) and a first scene exist, but the minigame needs real polish to be the hero moment it's meant to be:

- **Wakes / prop-wash visual feedback** — flagged as *important*: you must see thrust and thruster firing *before* the hull responds, so you're reading the boat rather than guessing. This is what makes the heavy, deliberate inertia feel fair instead of sluggish — the single biggest feel fix.
- **Touch controls for iPad** — on-screen engine levers + thruster, driving the same input intents as the keyboard (the intent layer was built for exactly this swap). Design alongside, not bolted on.
- **Select which ship to dock** — an Island or Loch class handles nothing like a major unit or a Streaker, so docking parameters (mass, inertia, thrust, and *whether she even has a rudder or thruster*) become per-class. `sim/docking.ts` currently hard-codes one Isle-of-Arran-ish parameter set; this becomes per-ship. (Rudder status confirmed: the model is currently rudderless for everyone — a real major unit should gain a rudder that bites once she has way on, which is one of the per-class differences.)
- **A port that feels alive** — activity and life around the berth, not a static diagram.
- **Tutorials on practice boats** — so you're not learning on your real ships. Crucially, **only real sailings on real ships count toward your licence** (`sim/licence.ts`); the tutorial is a safe sandbox that cleanly separates learning from stakes.

## Open questions (deliberately deferred)

- **Mooring lines**: automated (AI dock crew) vs. a strategic layer the player also engages with. Explicitly parked — "don't need to worry about that now."
- ~~**Manual-mode failure severity**~~ — **Resolved (Phase 2, 2026-07-18):** different, deliberately. Automated sailings resolve through the risk-roll odds/tiers in `sim/captain.ts` (hazard × weather × captain skill). Manual dockings instead resolve deterministically from the docking attempt's own physics — impact speed at contact (see `sim/dockingOutcome.ts`'s `SEVERE_IMPACT_SPEED` threshold) decides `damaged` vs. `severelyDamaged`, with no separate roll. A human reading the situation live gets to earn (or blow) the outcome directly, rather than have it re-randomized on top of their play.
- ~~**Licence progression gating**~~ — **Resolved (Phase 5, 2026-07-21):** skill-demonstrated, not hours-logged. `sim/licence.ts`'s `recordManualDocking` only advances the player's own licence on a clean (on-time) manual docking of a ship at the licence's *current* tier — proving yourself on an easier class already licensed for doesn't count a second time, and a bad docking doesn't erase progress already earned, it just doesn't add to it. Five clean dockings promote Island class → Loch class → Big Ships.
- ~~**Subsidy model**~~ — **Resolved (Phase 3, 2026-07-18):** see Economy section above — flat top-up.
- ~~**Rival operator**~~ — **Partially resolved (Phase 2, 2026-07-18):** contract loss is route-scoped and abstracted, not a simulated rival — losing the one route Phase 2 tracks just ends that contract ("re-tendered away"), no competing-operator simulation underneath it. Whether a fuller rival-operator layer ever gets built on top of that abstraction is still open.
- ~~**Freight vs. passenger simulation depth**~~ — **Resolved (Phase 5, 2026-07-21):** real mechanics, not a flavour multiplier. `sim/routeEconomics.ts` models two independent demand streams (passengers, freight units), each derived from route distance, each capped by the assigned ship's own length-derived capacity before its fare counts — undersized ships genuinely leave revenue on the table, proven by `demandBalance.test.ts`'s balance-sanity tests.
- ~~**Seasonal demand variation**~~ — **Resolved (Phase 5, 2026-07-21):** a sine-wave seasonal curve over the 365-day calendar year, peaking day-of-year 195 (mid-July, matching CalMac's real summer timetable). Passenger/tourist demand swings hard (±40% amplitude); lifeline freight barely moves (±10%) — islands need groceries and mail year-round regardless of season.
- **Day-to-day route operation mechanics**: capacity-to-demand matching landed in Phase 5 (see above) — timetabling and sailing frequency are still one-sailing-per-route-per-day, undiscussed beyond that.
- **Pause & time controls**: a real-time game with 10–15-minute days needs an answer for stepping away — pause, and possibly fast-forward through quiet stretches. Still open. The one piece that's ~~resolved~~ — **Phase 2, 2026-07-18:** no hard pause when a docking notice fires unattended; the automated captain resolves it normally after a short response window (`sim/captain.ts`'s risk roll, same as any other automated sailing). The broader pause/fast-forward question for quiet stretches between notices is still undiscussed.
- **Audio**: entirely undiscussed. Flagging because docking feel is half sound (engine note under load, wind, gulls, the ramp clunk) — the roadmap notes a cheap placeholder pass as a Phase 1 stretch, but the actual audio direction is an open design area.
- **Offline/idle progression mechanism** (stretch): catch-up simulation approach undecided. Note (2026-07-21): now coupled to the **neglect-must-bite** direction (see Game shape & engagement) — the idle digest is the humane counterpart to a network that genuinely degrades when unattended; the two want designing together.
- **Ship builder — truer CalMac-like ships**: Adam wants more builder work to make genuinely CalMac-authentic vessels (parametrics, detail). Explicitly a *todo, not specified now* — don't design against it until he firms it up. (See [[tuning-workflow]] and the two-modes note: builder-as-authoring-tool now, player-facing design mode later.)
- **Other crew roles**: captains are modelled; Adam wants additional crew types but their roles/effects are undecided. Parked.

## Risks & things to watch

Flagged during design discussion — not blockers, just things worth being deliberate about:

- **Determinism.** Risk rolls (weather, accidents) should come from a seeded RNG rather than raw randomness, so a day's outcome is reproducible — useful for debugging now, and the only sane foundation for the offline/idle catch-up simulation later (see Time & simulation).
- **Scope discipline.** This is a dream-scope document by design (see "How to read this document" above), spanning contracts/reliability, economy, authored hazard/weather geography, crew progression, ship wear, a real-time docking minigame with dual-input support, four fleet classes, and web-now-tablet-later portability. The phased plan should sequence a genuinely thin, playable vertical slice first — one route, one ship class, the core reliability loop, docking minigame optional/stubbed — before building breadth across every system in parallel.
- **Map/hazard geography is content-authoring work, not just code** — plotting real island positions, route paths, and hazard zones for the west coast at a usable stylised level is production effort, in the same spirit as the ship-photo tuning workflow. A lightweight "map builder" tool, same philosophy as the ship builder, is likely worth building rather than hand-coding coordinates.
- **Save-game persistence** (company, fleet, contracts, progress) needs its own store, related to but distinct from the ship-builder's localStorage persistence. The swappable `DesignStore` pattern already built is good precedent to reuse — and keeping storage behind an interface now is exactly what makes a future iPad storage swap easy later.

## Relationship to existing work

- The ship builder (`src/ship/`) is built and works for Big Ships; Island class, Loch class, and Streakers are unmodelled.
- See the `tuning-workflow` memory: Adam visually matches hero ships against reference photos using the builder's tracing overlay and hands back JSON for Claude to hardcode into `src/ship/presets.ts` — Claude does not eyeball photos to tune presets.
