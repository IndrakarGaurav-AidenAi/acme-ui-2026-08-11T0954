// Wraps GET /api/gtm-coverage and POST /api/gtm-coverage/import (backend-springboot's
// GtmController). Field names match com.rcpl.platform.gtm.GtmDtos exactly — see that file for the
// authoritative shape: a region-scoped state -> city -> area -> DB tree, plus factor definitions.
// StateDto/CityDto/AreaDto/DbDto are the very same Java records on both the GET response and the
// POST /import request body, so the nested cities/areas/dbs arrays here are optional: the GET
// response always populates them, but GtmDtos.ImportRequest's own comment ("Cities/areas/dbs
// optional per state") plus GtmService.importStates' null checks confirm they can be omitted on
// the way in. Plain functions (not an Angular service class) so store.ts, which already holds the
// auth token, can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'

export interface BackendGtmDb {
  name: string
  type: string
  status: string
}

export interface BackendGtmArea {
  name: string
  target: number | null
  actual: number | null
  dbs?: BackendGtmDb[]
}

export interface BackendGtmCity {
  name: string
  target: number | null
  actual: number | null
  areas?: BackendGtmArea[]
}

export interface BackendGtmState {
  code: string
  name: string
  region: string
  target: number | null
  actual: number | null
  cities?: BackendGtmCity[]
}

export interface BackendGtmFactor {
  key: string
  label: string
  sub: string
  icon: string
  perTarget: number | null
  delta: number | null
  money: boolean
  extra: boolean
}

export interface BackendCoverageResponse {
  states: BackendGtmState[]
  factors: BackendGtmFactor[]
}

/** POST /import body — bulk upsert of state trees (admin); cities/areas/dbs optional per state. */
export interface ImportCoverageRequest {
  states: BackendGtmState[]
}

export interface ImportCoverageResponse {
  importedStates: number
}

const base = '/api/gtm-coverage'

export function getGtmCoverage(token: string | null): Promise<BackendCoverageResponse> {
  return apiGet(base, token)
}

export function importGtmCoverage(token: string | null, req: ImportCoverageRequest): Promise<ImportCoverageResponse> {
  return apiPost(`${base}/import`, token, req)
}
