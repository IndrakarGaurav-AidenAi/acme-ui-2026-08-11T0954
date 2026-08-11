// Wraps GET/PATCH/POST /api/notifications/** (backend-springboot's NotificationController). Field
// names match com.rcpl.platform.notification.NotificationDto exactly — see that file for the
// authoritative shape. Plain functions (not an Angular service class) so store.ts, which already
// holds the auth token, can call these directly without DI plumbing.
import { apiGet, apiPatch, apiPost } from '../lib/api'

export interface BackendNotification {
  id: string
  title: string | null
  body: string | null
  href: string | null
  forRole: string | null
  read: boolean
  time: string | null
}

const base = '/api/notifications'

export function listNotifications(token: string | null): Promise<BackendNotification[]> {
  return apiGet(base, token)
}

// PATCH /{id} takes no request body — NotificationController.markRead has no @RequestBody
// parameter, it just flips the read flag server-side and returns the updated row.
export function markNotificationRead(token: string | null, id: string): Promise<BackendNotification> {
  return apiPatch(`${base}/${encodeURIComponent(id)}`, token)
}

// POST /read-all returns void (NotificationController.markAllRead has no return value) — Spring
// sends that as a 200 with an empty body; api.ts's unwrap() reads the body as text first and only
// JSON.parses it when non-empty, so an empty 200 just resolves to undefined here.
export function markAllNotificationsRead(token: string | null): Promise<void> {
  return apiPost(`${base}/read-all`, token)
}
