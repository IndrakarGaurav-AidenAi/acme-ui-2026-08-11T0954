import type { RoleCode } from '../types'

export interface AppNotification {
  id: string
  title: string
  body: string
  href: string
  time: string
  read: boolean
  // when set, only this persona sees the notification (e.g. shortlist hand-offs
  // addressed to Trade Marketing / Channel Development)
  forRole?: RoleCode
}

// Ties back into the same demo cases used across Approvals/Communication/Grievances,
// so clicking one lands you on the exact record it's about.
export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1', title: 'CMP-2291 is overdue', body: 'Malhotra Distributors — Finance still needs a CC top-up commitment in writing.',
    href: '/approvals', time: '2h ago', read: false,
  },
  {
    id: 'n2', title: 'Trade Marketing replied', body: 'CMP-2280 (Deccan Trade Links) — reviewing the infra score now.',
    href: '/communication', time: '35m ago', read: false,
  },
  {
    id: 'n3', title: 'MDM is waiting on documents', body: 'VND-0417 (Krishna Packaging) — PAN and Cancelled Cheque still missing.',
    href: '/approvals', time: '1d ago', read: false,
  },
  {
    id: 'n4', title: 'Grievance overdue', body: 'A raised grievance has passed its SLA — check the Grievances queue.',
    href: '/grievances', time: '3h ago', read: true,
  },
]
