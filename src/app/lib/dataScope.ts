// Data-level (row) RBAC — layered on top of screen-level access. Maps a record's state (or
// town, for records that only carry a town — Analytics' DB performance rows, Dashboard's
// candidate/lead rows) to its macro-region (reusing the same GTM_STATES/REGION_OF data GTM
// Coverage and Analytics already use), then checks it against the viewer's own region/state
// when their persona is scoped.
import { GTM_STATES, REGION_OF, stateCodeForTown } from '../mock/gtm'
import type { DataScope } from '../types'

const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  GTM_STATES.map((s) => [s.code, s.name]),
)

/** Whether a record whose state is `stateCode` (a GTM_STATES code like "MH", "GJ" — how every
 *  real record stores it, e.g. Partner.state / FlaggedCase.state) is visible under the given
 *  scope + viewer region/state. 'all' always sees it; 'own_region' only sees records in the
 *  viewer's own macro-region; 'own_state' narrows further to an exact state match — viewerState
 *  comes from DEMO_USERS as a full name ("Maharashtra"), so it's compared against the code's
 *  resolved name, not the raw code. A viewer missing the needed field (e.g. an HQ persona with
 *  no region) sees nothing under a scoped setting — they should be on 'all' instead, which is
 *  the default for every HQ persona. */
export function inDataScope(stateCode: string, scope: DataScope, viewerRegion?: string, viewerState?: string): boolean {
  if (scope === 'all') return true
  if (scope === 'own_state') return !!viewerState && NAME_BY_CODE[stateCode] === viewerState
  if (!viewerRegion) return false
  return REGION_OF[stateCode] === viewerRegion
}

/** Same check, but for records that only carry a town (Analytics' DB performance, Dashboard's
 *  leads/candidates) — resolves the town to its tracked state/region first via stateCodeForTown. */
export function inDataScopeByTown(town: string, scope: DataScope, viewerRegion?: string, viewerState?: string): boolean {
  if (scope === 'all') return true
  const code = stateCodeForTown(town)
  if (!code) return false
  if (scope === 'own_state') return !!viewerState && NAME_BY_CODE[code] === viewerState
  if (!viewerRegion) return false
  return REGION_OF[code] === viewerRegion
}
