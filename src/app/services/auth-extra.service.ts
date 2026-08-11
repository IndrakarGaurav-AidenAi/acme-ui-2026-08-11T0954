// Wraps GET /auth/me and GET /auth/can/{screenPath} (backend-springboot's AuthController — the two
// routes not already wired via /auth/login, called directly from login.component.ts). Response
// shapes mirror com.rcpl.platform.auth.dto.AuthDtos.MeResponse and .ScreenPermissionDto exactly.
// BackendUserProfile/BackendScreenPermission below intentionally match the same UserProfileDto/
// ScreenPermissionDto records that users-admin.service.ts already wraps for the admin user
// directory — duplicated here (not imported from that file) so this file stays self-contained, per
// the established services/*.ts convention. Plain functions (not an Angular service class) so
// store.ts, which already holds the auth token, can call these directly without DI plumbing.
import { apiGet } from '../lib/api'

/** Mirrors com.rcpl.platform.auth.dto.ScreenPermissionDto. */
export interface BackendScreenPermission {
  view: boolean
  manage: boolean
}

/** Mirrors com.rcpl.platform.auth.dto.UserProfileDto — the authenticated user's own profile (the
 *  same shape TokenResponse.user already carries back from /auth/login). Deliberately has no
 *  password field: the backend never returns credentials to the SPA. */
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

/** Mirrors com.rcpl.platform.auth.dto.AuthDtos.MeResponse. */
export interface MeResponse {
  user: BackendUserProfile
}

const base = '/auth'

export function getMe(token: string | null): Promise<MeResponse> {
  return apiGet(`${base}/me`, token)
}

export function canAccessScreen(token: string | null, screenPath: string): Promise<BackendScreenPermission> {
  // AuthController's @PathVariable captures a single path segment and itself re-adds a leading '/'
  // before the permission lookup (RoleScreenAccess keys — and the frontend's own User.access map —
  // are stored WITH the leading slash, e.g. '/leads'). Strip it here so callers can pass either
  // '/leads' or 'leads' and the request always carries one clean segment on the wire (a literal
  // '/' inside a single path segment, e.g. an encoded %2F, is not guaranteed to reach the handler).
  const segment = screenPath.startsWith('/') ? screenPath.slice(1) : screenPath
  return apiGet(`${base}/can/${encodeURIComponent(segment)}`, token)
}
