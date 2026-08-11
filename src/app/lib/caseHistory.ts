import type { AuditEntry } from '../mock/audit'

export interface CaseAuditItem {
  title: string
  when: string
  by: string
  tone: 'ai' | 'good' | 'warn' | 'neutral'
}

const KIND_TONE: Record<AuditEntry['kind'], CaseAuditItem['tone']> = { ai: 'ai', human: 'good', admin: 'warn' }

// Every audit-trail entry logged against this case code (approvals/rejections, emails, notes for
// leadership, info requests, etc.) — oldest first, so leadership reads it top-to-bottom like a story.
export function getCaseAuditTrail(code: string, auditLog: AuditEntry[]): CaseAuditItem[] {
  return auditLog
    .filter((a) => a.entity === code)
    .map((a) => ({ title: a.action, when: a.when, by: a.actor, tone: KIND_TONE[a.kind] }))
    .reverse()
}
