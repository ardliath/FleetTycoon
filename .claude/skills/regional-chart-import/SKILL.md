---
name: regional-chart-import
description: Add one region's real geography (ports, coastline, depth contours, hazards) to Fleet Tycoon's Scottish-waters map, following the pipeline proven on the Clyde pilot. Use whenever Adam asks to expand the map to a new region of Scotland (Argyll, Inner Hebrides, Outer Hebrides/Minch, Orkney, Shetland, etc).
---

# Regional chart import

The map started as a Clyde-only pilot and is growing into one continuous chart of Scottish waters (see `src/ui/MapView.tsx` and `sim/geography.ts`'s shared km-projection), built out one region at a time. This skill is the mechanical half of adding a region: real ports, real coastline, real depth contours, honest hazard framing. It does not cover *which* ports/routes/hazards matter — that's Scottish-ferry-network judgment that's explicitly Adam's call (see the map/geography note in `CLAUDE.md` and the `solo-passion-project-stance` memory), not something to infer from data.

## Steps

1. **Confirm scope with Adam first, one batch of questions** — the region's bounding box, which ports and routes matter, which stretches are hazardous or unprofitable to serve, any region-specific framing (the Clyde pilot's hazard zone was deliberately mild; Hebridean regions will need real named dangers like the Minch's rough water or Leverburgh/Berneray-grade hazards). Don't source data until this is settled — same discipline as `phase-kickoff`'s "ask up front, not mid-implementation."
2. **Verify network access** works via a quick `curl` test before doing real work (Overpass and EMODnet are both external services).
3. **Ports**: real town-centre lat/lon per each port's English Wikipedia infobox (or a better source if a port looks visually wrong once rendered) — see `src/map/clyde.ts`'s doc comment for the standard this is held to.
4. **Coastline**: query OSM's `natural=coastline` ways via the Overpass API (`https://overpass-api.de/api/interpreter`) for the region's bbox, stitch ways into chains by shared node id, close mainland chains (clipped at the query box) via the enclosing-rectangle/smaller-area method, simplify with Douglas-Peucker (~0.12km tolerance), project into the shared km-space. Full algorithm and its reasoning are in `src/map/clydeCoastline.ts`'s doc comment.
5. **Depth contours**: query EMODnet Bathymetry's WCS (`https://ows.emodnet-bathymetry.eu/wcs`, `emodnet__mean` coverage, `GetCoverage` with `format=text/plain` returns a real numeric grid directly, no image decoding needed) for the same bbox. Check the region's actual min/max depth before picking contour bands — the Clyde used 20/50/100/150m off an observed ~14–197m range; deeper regions (the Minch, west of the Hebrides) will need coarser or different bands. Run marching squares to extract isolines, stitch segments into polylines, drop sub-1.5km fragments as grid noise, simplify, project. Full method is in `src/map/clydeDepthContours.ts`'s doc comment.
6. **Hazard zones**: encode per Adam's briefing from step 1 as `HazardZone` entries — real named dangers where he's named them, not invented severities.
7. **Generate the region's data files** (`src/map/<region>.ts`, `<region>Coastline.ts`, `<region>DepthContours.ts`) with the same provenance doc-comment discipline as the Clyde files: real source, real processing steps, regeneration instructions, required attribution (OSM/ODbL, EMODnet).
8. **Merge into the shared map** rather than standing up a new view — this is one continuous map across Scottish waters, not a sheet per region.
9. **Re-bake route paths**: `npm run bake:routes` (see `scripts/bakeRoutePaths.ts`) — the new region's coastline changes what's near any existing route too, not just its own new routes, and `src/map/routePaths.test.ts` will fail CI if this is skipped.
10. **Verify live** in both light and dark mode via the dev server before committing: screenshot, check for label collisions or data running outside the intended view, check the console for genuinely new errors (not stale historical HMR noise), run `npm run build`.
11. **Commit** with a provenance-focused message (what was sourced, how it was processed, what was verified) — only after Adam has reviewed the region's ports/routes/hazards from step 1.

## Notes

- Coastline complexity scales fast for larger regions — consider a coarser Douglas-Peucker tolerance for wide-area regions if point counts get unwieldy.
- This skill covers adding a region's *data*. It doesn't cover the map's pan/zoom camera or projection-accuracy work needed to view the whole of Scotland at once — that's one-time architecture work, not a per-region repeat, and should already be in place before the first post-Clyde region lands.
