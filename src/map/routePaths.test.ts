/**
 * Guards that the baked route paths (scripts/bakeRoutePaths.ts) stay in
 * sync with the routes/ports/coastline they were baked from — a route
 * added without running the bake script would silently fall back to
 * computing its path live in the browser (routeHelpers.ts's
 * routeSeaPath), which is exactly the first-load cost baking exists to
 * remove. This test recomputes the real pathfind for every route (the
 * cost this file exists to keep out of the browser is completely fine to
 * pay here) and fails if the baked data doesn't match.
 */
import { describe, expect, it } from 'vitest'
import { ALL_COASTLINE, ALL_ROUTES, findPort } from './regions'
import { ROUTE_PATHS } from './routePaths'
import { pathLengthKm, projectPort } from '../sim/geography'
import { findSeaRoute } from '../sim/seaRoute'

describe('ROUTE_PATHS', () => {
  it('has a baked path for every route', () => {
    for (const route of ALL_ROUTES) {
      expect(ROUTE_PATHS[route.id], `missing baked path for ${route.id} — run npm run bake:routes`).toBeDefined()
    }
  })

  it('matches a fresh pathfind for every route — stale if this fails, re-run npm run bake:routes', () => {
    for (const route of ALL_ROUTES) {
      const a = findPort(route.portAId)
      const b = findPort(route.portBId)
      if (!a || !b) continue
      const fresh = findSeaRoute(projectPort(a), projectPort(b), ALL_COASTLINE)
      const baked = ROUTE_PATHS[route.id]
      // compare by length (same km, small tolerance for the bake script's
      // 3-decimal rounding) rather than exact points, since that rounding
      // means the baked coordinates are never bit-identical to a fresh
      // computation.
      expect(pathLengthKm(baked)).toBeCloseTo(pathLengthKm(fresh), 1)
      expect(baked.length).toBe(fresh.length)
    }
  })
})
