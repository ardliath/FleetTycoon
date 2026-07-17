---
name: phase-kickoff
description: Start a Fleet Tycoon roadmap phase from consistent grounding. Use when Adam says to start/kick off a phase (e.g. "let's start Phase 1", "kick off the docking phase") from docs/ROADMAP.md.
---

# Phase kickoff

Every roadmap phase should start from the same grounding instead of being re-derived from memory. Do these steps in order, and don't write code until step 4 is done.

1. **Load context**: read the phase's full section in `docs/ROADMAP.md` (scope, testing, model note, assets/questions, kickoff prompt, exit criteria) plus the sections of `docs/GAME_DESIGN.md` it references. Check the previous phase's exit criteria were actually met; flag honestly if not — don't silently build on an unfinished phase.
2. **Model check**: if the phase's model note flags design-shape work (Fable/Opus-worthy), say so *before starting* so Adam can switch models for that part. Don't silently proceed on the wrong tier for the flagged work; the routine parts of the phase are fine on the current model.
3. **Ask the phase's questions**: each phase lists open design questions and assets needed. Ask Adam these *up front* — one batch, not dribbled out mid-implementation. Where a question is explicitly listed as "resolve during this phase," agree with Adam whether to decide now or discover through building.
4. **Seed the plan**: restate the phase scope and exit criteria in your own words (a few sentences — confirm shared understanding, not a copy-paste), then create tasks (TaskCreate) for the phase's major chunks.
5. **Build**, following the phase's kickoff prompt adapted to the current state of the repo, honouring the conventions in `CLAUDE.md` (sim purity, fixed-tick determinism, input intents, storage behind interfaces).
6. **Close out**: when exit criteria are met, update `docs/ROADMAP.md` with a short dated "Done" note on the phase (plus anything learned that changes later phases), and update `docs/GAME_DESIGN.md` if open questions got resolved. Living documents — this is the step that keeps them true.
