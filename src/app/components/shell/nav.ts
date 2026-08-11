import type { IconName } from '../ui/icons'

export interface NavItem {
  to: string
  label: string
  ic: IconName
  count?: number
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', ic: 'dashboard' },
    // { to: '/agents', label: 'AI Agents', ic: 'spark' }, // commented out — needs a design pass
  ] },
  {
    label: 'Prospecting',
    items: [
      { to: '/intake-inbox', label: 'Intake Inbox', ic: 'comms' },
      { to: '/document-authenticity', label: 'Document Authenticity', ic: 'shield' },
      { to: '/leads', label: 'Leads', ic: 'leads' },
      { to: '/new-application', label: 'New Application', ic: 'new' },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { to: '/approvals', label: 'Approvals', ic: 'approvals' },
      { to: '/documents', label: 'Documents', ic: 'documents' },
    ],
  },
  { label: 'Collaborate', items: [
    { to: '/communication', label: 'Communication', ic: 'comms' },
    { to: '/grievances', label: 'Grievances', ic: 'flag' },
  ] },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', ic: 'analytics' },
      { to: '/gtm-coverage', label: 'GTM Coverage', ic: 'target' },
      { to: '/reports', label: 'Reports', ic: 'documents' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/partners', label: 'Partners', ic: 'partners' },
      { to: '/templates', label: 'Templates', ic: 'templates' },
      { to: '/settings', label: 'Admin & Settings', ic: 'settings' },
      { to: '/audit-log', label: 'Audit Log', ic: 'list' },
      { to: '/my-settings', label: 'My Settings', ic: 'settings' },
    ],
  },
]

export const LABEL_BY_PATH: Record<string, string> = NAV.flatMap((g) => g.items).reduce(
  (acc, i) => { acc[i.to] = i.label; return acc },
  {} as Record<string, string>,
)

// Which modules each persona sees. Everyone gets Dashboard + Analytics; the rest
// is scoped to what that role actually does, so the sidebar differs per persona.
// '/agents' left out of every list below — AI Agents screen is commented out for now.
export const MODULES_BY_ROLE: Record<string, string[]> = {
  // ASE/ASM scouts and creates leads (Intake Inbox → Leads shortlist); the New Application
  // wizard — comparing the shortlist and running the appointment — belongs to Channel Development.
  // Every persona gets the Audit Log — actions are cross-team, so the trail is shared.
  // Grievances are owned by Trade Marketing (Channel Development) exclusively.
  ase_asm:     ['/dashboard', '/intake-inbox', '/document-authenticity', '/leads', '/approvals', '/communication', '/analytics', '/gtm-coverage', '/partners', '/audit-log', '/my-settings'],
  finance:     ['/dashboard', '/approvals', '/documents', '/communication', '/analytics', '/audit-log'],
  // Channel Development can cover the field team's Intake Inbox (and start an application from it)
  // when the ASE/ASM is unavailable — they don't own the mailbox config, only the triage.
  channel_dev: ['/dashboard', '/intake-inbox', '/document-authenticity', '/leads', '/new-application', '/approvals', '/documents', '/communication', '/grievances', '/analytics', '/gtm-coverage', '/partners', '/audit-log'],
  mdm:         ['/dashboard', '/approvals', '/documents', '/communication', '/partners', '/analytics', '/audit-log'],
  // Leadership now owns the final SM/RBL sign-off queue (Finance/Channel Dev route cleared
  // cases here once both checks pass), so Approvals has to be reachable, not just viewable data.
  leadership:  ['/dashboard', '/approvals', '/analytics', '/gtm-coverage', '/reports', '/partners', '/audit-log'],
  admin:       ['/dashboard', '/intake-inbox', '/document-authenticity', '/leads', '/new-application', '/approvals', '/documents', '/communication', '/analytics', '/gtm-coverage', '/reports', '/partners', '/templates', '/settings', '/audit-log', '/my-settings'],
}
