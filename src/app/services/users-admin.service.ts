// Wraps GET/POST/PATCH/DELETE /api/users/** (backend-springboot's UserController, the admin user
// directory API behind Settings > Team). Response shape mirrors com.rcpl.platform.auth.dto.
// UserProfileDto exactly (list/create/update all return it); request bodies mirror
// com.rcpl.platform.user.UserDtos.{CreateUserRequest,UpdateUserRequest} — see those files for the
// authoritative shape. Plain functions (not an Angular service class) so store.ts, which already
// holds the auth token, can call these directly without DI plumbing.
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api'

/** Mirrors com.rcpl.platform.auth.dto.ScreenPermissionDto. */
export interface BackendScreenPermission {
  view: boolean
  manage: boolean
}

/** Mirrors com.rcpl.platform.auth.dto.UserProfileDto — the admin user directory row. Deliberately
 *  has no password field: the backend never returns credentials to the SPA. */
export interface BackendUserProfile {
  id: string
  name: string
  email: string
  roleCode: string
  region: string | null
  state: string | null
  isActive: boolean
  /** Per-screen View/Manage permission, keyed by nav route path (e.g. '/leads'). */
  access: Record<string, BackendScreenPermission>
}

/** Mirrors com.rcpl.platform.user.UserDtos.CreateUserRequest. */
export interface CreateUserRequest {
  name: string
  email: string
  roleCode: string
  region?: string
  state?: string
  password: string
  isActive?: boolean
}

/** Mirrors com.rcpl.platform.user.UserDtos.UpdateUserRequest — every field is an optional patch;
 *  omitted fields are left unchanged server-side (including password: only re-hashed when sent). */
export interface UpdateUserRequest {
  name?: string
  email?: string
  roleCode?: string
  region?: string
  state?: string
  isActive?: boolean
  password?: string
}

const base = '/api/users'

export function listUsers(token: string | null): Promise<BackendUserProfile[]> {
  return apiGet(base, token)
}

export function createUser(token: string | null, req: CreateUserRequest): Promise<BackendUserProfile> {
  return apiPost(base, token, req)
}

export function updateUser(token: string | null, id: string, req: UpdateUserRequest): Promise<BackendUserProfile> {
  return apiPatch(`${base}/${encodeURIComponent(id)}`, token, req)
}

export function deleteUser(token: string | null, id: string): Promise<void> {
  return apiDelete(`${base}/${encodeURIComponent(id)}`, token)
}
