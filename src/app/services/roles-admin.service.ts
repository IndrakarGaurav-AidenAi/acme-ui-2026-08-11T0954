// Wraps GET/PATCH /api/roles/** (backend-springboot's RoleAdminController: the role registry plus
// admin edits to per-screen access, data scope, and analytics-section visibility). Field names match
// that controller's inline record DTOs (RoleDto, ScreenAccessPatch, DataScopePatch,
// AnalyticsSectionsPatch — declared inside RoleAdminController.java itself, no separate DTOs file)
// exactly — see that file for the authoritative shape. Plain functions (not an Angular service
// class) so store.ts, which already holds the auth token, can call these directly without DI
// plumbing.
import { apiGet, apiPatch } from '../lib/api'

/** Mirrors com.rcpl.platform.auth.dto.ScreenPermissionDto. */
export interface BackendScreenPermission {
  view: boolean
  manage: boolean
}

/** Mirrors RoleAdminController.RoleDto — one row of the role registry (Admin > Roles). */
export interface BackendRole {
  code: string
  label: string
  colorVar: string | null
  blurb: string | null
}

/** Keyed by screen path (e.g. '/leads') — mirrors the Map<String, ScreenPermissionDto> returned by
 *  both GET and PATCH .../access. This is the wire-accurate, per-screen view/manage source of truth
 *  that store.ts's coarser moduleAccess (a plain string[] of visible paths) is derived from. */
export type RoleAccessMap = Record<string, BackendScreenPermission>

/** Mirrors RoleAdminController.ScreenAccessPatch — the body for PATCH .../access. */
export interface SetRoleAccessRequest {
  screenPath: string
  view: boolean
  manage: boolean
}

/** Mirrors RoleAdminController.DataScopePatch — the body for PATCH .../data-scope. `entity`/`scope`
 *  are free-form strings on the wire (frontend-side these line up with the DataEntity/DataScope
 *  unions in types.ts, e.g. entity: 'partners', scope: 'own_region'), but the backend itself does
 *  not constrain them to an enum — it stores whatever string is sent. The endpoint echoes the patch
 *  back as its response, so this same interface doubles as the response type. */
export interface SetRoleDataScopeRequest {
  entity: string
  scope: string
}

/** Mirrors RoleAdminController.AnalyticsSectionsPatch — the body for PATCH .../analytics-sections.
 *  A null/omitted `sections` is treated by the backend as an empty list (clears all sections for
 *  the role), same as sending `sections: []` explicitly. */
export interface SetRoleAnalyticsSectionsRequest {
  sections?: string[]
}

const base = '/api/roles'

export function listRoles(token: string | null): Promise<BackendRole[]> {
  return apiGet(base, token)
}

export function getRoleAccess(token: string | null, code: string): Promise<RoleAccessMap> {
  return apiGet(`${base}/${encodeURIComponent(code)}/access`, token)
}

export function setRoleAccess(token: string | null, code: string, req: SetRoleAccessRequest): Promise<RoleAccessMap> {
  return apiPatch(`${base}/${encodeURIComponent(code)}/access`, token, req)
}

export function setRoleDataScope(
  token: string | null,
  code: string,
  req: SetRoleDataScopeRequest,
): Promise<SetRoleDataScopeRequest> {
  return apiPatch(`${base}/${encodeURIComponent(code)}/data-scope`, token, req)
}

export function setRoleAnalyticsSections(
  token: string | null,
  code: string,
  req: SetRoleAnalyticsSectionsRequest,
): Promise<string[]> {
  return apiPatch(`${base}/${encodeURIComponent(code)}/analytics-sections`, token, req)
}
