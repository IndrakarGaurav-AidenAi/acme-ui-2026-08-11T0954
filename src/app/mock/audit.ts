// Audit trail — seeded here, then appended to live from the store as real actions happen
// (approvals, document onboarding, report exports, etc.).
export interface AuditEntry {
  id: string
  when: string
  actor: string
  kind: 'ai' | 'human' | 'admin'
  action: string
  entity: string
}

export const INITIAL_AUDIT: AuditEntry[] = [
  { id: 'a1', when: '2 Jul, 09:15', actor: 'Evaluation Agent', kind: 'ai', action: 'Flagged financial criteria (92% confidence)', entity: 'CMP-2291' },
  { id: 'a2', when: '2 Jul, 09:16', actor: 'Routing Agent', kind: 'ai', action: 'Routed to Finance queue', entity: 'CMP-2291' },
  { id: 'a3', when: '2 Jul, 10:02', actor: 'Finance', kind: 'human', action: 'Posted a message in case discussion', entity: 'CMP-2291' },
  { id: 'a4', when: '1 Jul, 16:40', actor: 'Document Intelligence Agent', kind: 'ai', action: 'Verified ISO 9001 Certificate', entity: 'Krishna Packaging' },
  { id: 'a5', when: '1 Jul, 11:20', actor: 'Admin', kind: 'admin', action: 'Updated Vendor template document checklist', entity: 'Templates' },
]
