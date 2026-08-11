// Wraps GET/PUT/DELETE /api/partner-types/** (backend-springboot's PartnerTypeController). Field
// names match com.rcpl.platform.template.PartnerTypeDtos exactly — see that file for the
// authoritative shape. BackendPartnerType corresponds 1:1 by field name to the frontend's own
// PartnerType (../types), but `code` is kept as plain string rather than the frontend's frozen
// PartnerTypeCode union — this API is exactly how partner-type codes get added/edited, so a new
// code wouldn't fit that union. Plain functions (not an Angular service class) so store.ts, which
// already holds the auth token, can call these directly without DI plumbing.
import { apiGet, apiPut, apiDelete } from '../lib/api'

export interface BackendPartnerType {
  code: string
  label: string
  isActive: boolean
  documents: string[]
  workflow: string[]
}

export interface UpsertPartnerTypeRequest {
  label: string
  isActive?: boolean
  sortOrder?: number
  documents?: string[]
  workflow?: string[]
}

const base = '/api/partner-types'

export function listPartnerTypes(token: string | null): Promise<BackendPartnerType[]> {
  return apiGet(base, token)
}

export function getPartnerType(token: string | null, code: string): Promise<BackendPartnerType> {
  return apiGet(`${base}/${encodeURIComponent(code)}`, token)
}

export function updatePartnerType(token: string | null, code: string, req: UpsertPartnerTypeRequest): Promise<BackendPartnerType> {
  return apiPut(`${base}/${encodeURIComponent(code)}`, token, req)
}

export function deletePartnerType(token: string | null, code: string): Promise<void> {
  return apiDelete(`${base}/${encodeURIComponent(code)}`, token)
}
