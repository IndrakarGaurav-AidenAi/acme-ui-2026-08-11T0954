import type { User } from '../types'
import { DEFAULT_ACCESS_BY_ROLE, DEMO_USERS } from './roles'

// Full persona/user directory for the Admin panel. Each role's DEMO_USERS
// entry is included (id-aligned) plus a few extra seats per role, so the
// admin table reads like a real multi-user org rather than one row per role.
export const INITIAL_USERS: User[] = [
  { ...DEMO_USERS.ase_asm, isActive: true },
  { id: 'u1b', name: 'K. Bhosale', email: 'k.bhosale@acme.in', roleCode: 'ase_asm', region: 'North', isActive: true, access: DEFAULT_ACCESS_BY_ROLE.ase_asm },
  { ...DEMO_USERS.finance, isActive: true },
  { id: 'u2b', name: 'V. Rao', email: 'v.rao@acme.in', roleCode: 'finance', region: 'HQ', isActive: false, access: DEFAULT_ACCESS_BY_ROLE.finance },
  { ...DEMO_USERS.channel_dev, isActive: true },
  { ...DEMO_USERS.mdm, isActive: true },
  { id: 'u4b', name: 'T. Sen', email: 't.sen@acme.in', roleCode: 'mdm', region: 'East', isActive: true, access: DEFAULT_ACCESS_BY_ROLE.mdm },
  { ...DEMO_USERS.leadership, isActive: true },
  { ...DEMO_USERS.admin, isActive: true },
]
