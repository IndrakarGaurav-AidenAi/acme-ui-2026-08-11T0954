// Wraps GET/PUT /api/me/settings (backend-springboot's UserSettingsController). Field names match
// UserSettingsController.UserSettingsDto exactly — see that file for the authoritative shape. Plain
// functions (not an Angular service class) so store.ts, which already holds the auth token, can
// call these directly without DI plumbing.
import { apiGet, apiPut } from '../lib/api'

export interface BackendUserSettings {
  inboxProvider: string | null
  inboxAddress: string | null
  autoForwardUnmatched: boolean
  slaHours: number
}

export interface UpdateSettingsRequest {
  inboxProvider?: string
  inboxAddress?: string
  autoForwardUnmatched?: boolean
  slaHours?: number
}

const base = '/api/me/settings'

export function getMySettings(token: string | null): Promise<BackendUserSettings> {
  return apiGet(base, token)
}

export function updateMySettings(token: string | null, req: UpdateSettingsRequest): Promise<BackendUserSettings> {
  return apiPut(base, token, req)
}
