// Wraps GET/POST /api/audit (backend-springboot's AuditController). Field names match
// com.rcpl.platform.audit.AuditDtos.AuditDto exactly — see that file for the authoritative shape.
// Plain functions (not an Angular service class) so store.ts, which already holds the auth token,
// can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'

export interface BackendAuditEntry {
  id: string
  when: string | null
  actor: string | null
  kind: string | null
  action: string | null
  entity: string | null
}

// AuditDtos.AppendAuditRequest — actor/action/entity are @NotBlank; kind has no such constraint
// because AuditService.log() defaults a null/omitted kind to "human" server-side.
export interface CreateAuditEntryRequest {
  actor: string
  kind?: string
  action: string
  entity: string
}

const base = '/api/audit'

export function listAudit(token: string | null): Promise<BackendAuditEntry[]> {
  return apiGet(base, token)
}

export function createAuditEntry(token: string | null, req: CreateAuditEntryRequest): Promise<BackendAuditEntry> {
  return apiPost(base, token, req)
}
