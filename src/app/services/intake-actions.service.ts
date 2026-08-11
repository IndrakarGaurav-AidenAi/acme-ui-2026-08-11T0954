// Wraps the mutation routes of /api/intake/** (backend-springboot's IntakeController) not already
// covered by the read-only pull() in intake-inbox/intake-review.component.ts. Field names match
// com.rcpl.platform.intake.IntakeDtos exactly. These calls are best-effort: most intake ids the UI
// works with (mock/intake.ts's EXTRACTIONS seed) have no matching row in the backend at all, so a
// 404 here is expected and already handled by callers the same resilient way as everywhere else in
// this file — only IDs that actually came from a real GET /api/intake response persist for real.
// Plain functions (not an Angular service class) so store.ts, which already holds the auth token,
// can call these directly without DI plumbing.
import { apiPost } from '../lib/api'

const base = '/api/intake'

export function setIntakeDocOverride(
  token: string | null,
  intakeId: string,
  docName: string,
  fileName: string | undefined,
  dataUrl: string | undefined,
): Promise<unknown> {
  return apiPost(`${base}/${encodeURIComponent(intakeId)}/doc-override`, token, { docName, fileName, dataUrl })
}

export function markIntakeItemProcessed(token: string | null, intakeId: string): Promise<unknown> {
  return apiPost(`${base}/${encodeURIComponent(intakeId)}/process`, token)
}

export interface CreateLeadOverrides {
  name?: string
  town?: string
  dbCategory?: string
}

export function createLeadFromIntake(token: string | null, intakeId: string, overrides?: CreateLeadOverrides): Promise<unknown> {
  return apiPost(`${base}/${encodeURIComponent(intakeId)}/create-lead`, token, overrides)
}
