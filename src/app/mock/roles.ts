import type { AnalyticsSection, DataEntity, DataScope, Role, RoleCode, ScreenPermission, User } from '../types'
import { NAV, MODULES_BY_ROLE } from '../components/shell/nav'

export const ROLES: Role[] = [
  { code: 'ase_asm', label: 'ASE / ASM', colorVar: '--p-ase', blurb: 'Scout candidates, submit recommendations, respond to flags.' },
  { code: 'finance', label: 'Finance', colorVar: '--p-finance', blurb: 'Review flagged financial criteria, approve or reject.' },
  { code: 'channel_dev', label: 'Channel Development', colorVar: '--p-channel', blurb: 'Review infrastructure & coverage, own DB onboarding.' },
  { code: 'mdm', label: 'MDM', colorVar: '--p-mdm', blurb: 'Verify documents, confirm & onboard partner records.' },
  { code: 'leadership', label: 'Leadership', colorVar: '--p-leadership', blurb: 'Read analytics, ask the copilot, share insights.' },
  { code: 'admin', label: 'Admin', colorVar: '--ai-strong', blurb: 'Configure templates, manage partner types & workflows.' },
]

export const ROLE_BY_CODE: Record<RoleCode, Role> = ROLES.reduce(
  (acc, r) => { acc[r.code] = r; return acc },
  {} as Record<RoleCode, Role>,
)

const ALL_SCREENS = NAV.flatMap((g) => g.items).map((i) => i.to)

// Whether a persona can act on (not just view) the screens it has access to — the baseline
// "Manage" default for that role's screens. Individual users can still be tuned per-screen
// from Admin > Team > permissions.
const CAN_MANAGE_BY_ROLE: Record<RoleCode, boolean> = {
  ase_asm: false,
  finance: true,
  channel_dev: true,
  mdm: true,
  leadership: false,
  admin: true,
}

// Default per-screen View/Manage permission per persona, derived from which screens that
// role's sidebar shows (nav.ts MODULES_BY_ROLE) plus its baseline Manage capability.
export const DEFAULT_ACCESS_BY_ROLE: Record<RoleCode, Record<string, ScreenPermission>> = Object.fromEntries(
  (Object.keys(MODULES_BY_ROLE) as RoleCode[]).map((role) => {
    const allowed = new Set(MODULES_BY_ROLE[role])
    const canManage = CAN_MANAGE_BY_ROLE[role]
    const perms: Record<string, ScreenPermission> = {}
    ALL_SCREENS.forEach((path) => {
      const view = allowed.has(path)
      perms[path] = { view, manage: view && canManage }
    })
    return [role, perms]
  }),
) as Record<RoleCode, Record<string, ScreenPermission>>

// Data-level (row) access default per persona — the Super Admin can retune this from
// Admin > Data access. Field roles are region-scoped by default; HQ/oversight roles see
// everything so they aren't blind to regions they don't personally cover.
export const DEFAULT_DATA_SCOPE_BY_ROLE: Record<RoleCode, DataScope> = {
  ase_asm: 'all',
  channel_dev: 'own_region',
  finance: 'all',
  mdm: 'all',
  leadership: 'all',
  admin: 'all',
}

// Every data-bearing screen the Super Admin can independently enable/disable row-level
// scoping for, per persona — a scoped persona defaults to being scoped on all of them, but
// the admin can uncheck e.g. GTM Coverage while keeping Partners restricted.
export const DATA_ENTITIES: { key: DataEntity; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'partners', label: 'Partners directory' },
  { key: 'gtm_coverage', label: 'GTM Coverage' },
  { key: 'analytics', label: 'Analytics' },
]
const ALL_DATA_ENTITIES: DataEntity[] = DATA_ENTITIES.map((e) => e.key)
export const DEFAULT_DATA_ENTITIES_BY_ROLE: Record<RoleCode, DataEntity[]> = {
  ase_asm: [...ALL_DATA_ENTITIES],
  channel_dev: [...ALL_DATA_ENTITIES],
  finance: [...ALL_DATA_ENTITIES],
  mdm: [...ALL_DATA_ENTITIES],
  leadership: [...ALL_DATA_ENTITIES],
  admin: [...ALL_DATA_ENTITIES],
}

// Finer than DATA_ENTITIES' whole-screen scoping toggle — which of Analytics' own tabs a persona
// can see at all. Everyone sees everything by default; the Super Admin can hide a tab per persona
// (e.g. hide "Onboarding Efficiency" from ASE/ASM, keep it visible for Leadership/Channel Dev).
export const ANALYTICS_SECTIONS: { key: AnalyticsSection; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'detail', label: 'Distributor Detail' },
  { key: 'efficiency', label: 'Onboarding Efficiency' },
]
const ALL_ANALYTICS_SECTIONS: AnalyticsSection[] = ANALYTICS_SECTIONS.map((s) => s.key)
export const DEFAULT_ANALYTICS_SECTIONS_BY_ROLE: Record<RoleCode, AnalyticsSection[]> = {
  ase_asm: [...ALL_ANALYTICS_SECTIONS],
  channel_dev: [...ALL_ANALYTICS_SECTIONS],
  finance: [...ALL_ANALYTICS_SECTIONS],
  mdm: [...ALL_ANALYTICS_SECTIONS],
  leadership: [...ALL_ANALYTICS_SECTIONS],
  admin: [...ALL_ANALYTICS_SECTIONS],
}

export const DEMO_USERS: Record<RoleCode, User> = {
  ase_asm: { id: 'u1', name: 'R. Malhotra', email: 'r.malhotra@acme.in', roleCode: 'ase_asm', region: 'West', state: 'Maharashtra', access: DEFAULT_ACCESS_BY_ROLE.ase_asm },
  finance: { id: 'u2', name: 'S. Iyer', email: 's.iyer@acme.in', roleCode: 'finance', region: 'HQ', access: DEFAULT_ACCESS_BY_ROLE.finance },
  channel_dev: { id: 'u3', name: 'A. Deshpande', email: 'a.deshpande@acme.in', roleCode: 'channel_dev', region: 'West', state: 'Gujarat', access: DEFAULT_ACCESS_BY_ROLE.channel_dev },
  mdm: { id: 'u4', name: 'P. Nair', email: 'p.nair@acme.in', roleCode: 'mdm', region: 'HQ', access: DEFAULT_ACCESS_BY_ROLE.mdm },
  leadership: { id: 'u5', name: 'Atishay Jain', email: 'atishay.jain@acme.in', roleCode: 'leadership', region: 'HQ', access: DEFAULT_ACCESS_BY_ROLE.leadership },
  admin: { id: 'u6', name: 'Platform Admin', email: 'admin@rcpl.in', roleCode: 'admin', region: 'HQ', access: DEFAULT_ACCESS_BY_ROLE.admin },
}
