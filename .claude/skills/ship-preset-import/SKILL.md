---
name: ship-preset-import
description: Import a ShipDesign JSON that Adam has tuned in the ship builder into the hardcoded hero presets. Use whenever Adam pastes ship design JSON, or asks to add/update a hero ship preset. Validates, edits src/ship/presets.ts, and verifies the build.
---

# Ship preset import

Adam tunes ship designs visually in the Shipyard tab (tracing overlay against reference photos) and hands back the exported JSON. Your job is the mechanical half: get that JSON into `src/ship/presets.ts` safely. **Never adjust the numbers yourself** — the values are the product of visual matching you cannot do (see the `tuning-workflow` memory). If a value looks wrong (e.g. out of a slider's range), ask; don't fix.

## Steps

1. **Validate** the pasted JSON against `ShipDesign` in `src/ship/types.ts`:
   - All required fields present with correct types (name, lengthM, bow, stern, superstructure, funnel, masts, lifeboats, hull).
   - Enum values legal (`BowStyle`, `SternStyle`, `BridgeStyle`, `FunnelStyle`, `WindowStyle`, `MainmastStyle`).
   - Optional fields (`upperStartFrac`, `baseDeckDrop`, `mainmastFrac`, ...) kept only if present in the JSON — never inject defaults that weren't there.
   - Unknown/extra fields: ask before dropping them (they may be from a newer schema than you know about).
2. **Insert or replace** in `HERO_SHIPS` in `src/ship/presets.ts`:
   - If a preset with the same `name` exists, replace it in place (preserving its position in the array).
   - If new, append at the end unless Adam says otherwise.
   - Match the file's existing formatting style.
3. **Verify**: run `npm run build` (must pass). If snapshot tests exist for presets (Phase 0+), run `npm test` — an updated preset legitimately changes its snapshot, so update that ship's snapshot deliberately and say so; a *different* ship's snapshot changing means you broke something.
4. **Report**: one-line summary per ship imported (new vs. replaced, and anything notable like new optional fields used). Don't commit unless asked.
