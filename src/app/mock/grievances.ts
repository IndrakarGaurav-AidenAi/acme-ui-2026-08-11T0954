// Grievances raised by distributors (DBs). A distributor-support queue: payments,
// supply, scheme/claim disputes, logistics, system access. Mock data — no backend.
// Distributor names intentionally match those in mock/leads.ts and mock/cases.ts so
// the DB 360° profile can surface a partner's own grievances.
import type { RoleCode } from '../types'

export type GrievanceStatus = 'open' | 'in_progress' | 'resolved'
export type GrievancePriority = 'low' | 'medium' | 'high'
export type GrievanceCategory =
  | 'Payments & credit'
  | 'Supply & stock'
  | 'Scheme & claims'
  | 'Logistics'
  | 'System access'
  | 'Onboarding delay'
  | 'Other'

export interface GrievanceUpdate {
  on: string      // absolute date, e.g. '02 Jul 2026'
  by: string
  note: string
}

export interface Grievance {
  id: string              // GRV-####
  distributor: string     // DB / agency name
  town: string
  channel: 'Email' | 'Phone' | 'Portal' | 'Field visit'
  category: GrievanceCategory
  priority: GrievancePriority
  status: GrievanceStatus
  subject: string
  detail: string
  raisedOn: string        // absolute date
  ageDays: number
  ownerRole: RoleCode     // team currently handling it
  slaLabel: string        // 'On track' | '1d left' | 'Overdue' | 'Closed'
  isOverdue: boolean
  updates: GrievanceUpdate[]
}

export const CATEGORY_TONE: Record<GrievanceCategory, string> = {
  'Payments & credit': 'var(--p-finance)',
  'Supply & stock': 'var(--p-ase)',
  'Scheme & claims': 'var(--p-leadership)',
  Logistics: 'var(--p-channel)',
  'System access': 'var(--ai)',
  'Onboarding delay': 'var(--warn)',
  Other: 'var(--ink-mute)',
}

// Ingested from the Grievances sheet (RCPL_Distributor_Onboarding_Dataset.xlsx) — 22 rows.
// The sheet has no channel column, so every grievance defaults to 'Field visit' (matches its
// "Distributor-raised grievance logged via ASM" description text). It also has no update-log
// column, so each grievance carries one synthesized update reflecting its current status.
export const INITIAL_GRIEVANCES: Grievance[] = [
  {
    id: "GRV-2000", distributor: "United Sales Corporation", town: "Panaji", channel: 'Field visit',
    category: "Payments & credit", priority: "high", status: "resolved",
    subject: "Credit limit dispute needs resolution",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Credit limit dispute grievance for United Sales Corporation, Panaji.)",
    raisedOn: "19 Jun 2026", ageDays: 4, ownerRole: "channel_dev", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "23 Jun 2026", by: "Channel Dev team", note: "Reviewed and closed by Trade Marketing on 23 Jun 2026." },
    ],
  },
  {
    id: "GRV-2001", distributor: "Shri Sales Corporation", town: "Margao", channel: 'Field visit',
    category: "Payments & credit", priority: "high", status: "in_progress",
    subject: "Payment delay against cleared dues",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Payment delay grievance for Shri Sales Corporation, Margao.)",
    raisedOn: "18 Jun 2026", ageDays: 21, ownerRole: "mdm", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "18 Jun 2026", by: "MDM team", note: "Picked up by MDM; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2002", distributor: "Godavari Sales Corporation", town: "Rajkot", channel: 'Field visit',
    category: "System access", priority: "low", status: "in_progress",
    subject: "Unable to access DB ordering system",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a System/technical issue grievance for Godavari Sales Corporation, Rajkot.)",
    raisedOn: "02 Jun 2026", ageDays: 37, ownerRole: "admin", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "02 Jun 2026", by: "Admin/IT team", note: "Picked up by IT Support; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2003", distributor: "Royal Agencies", town: "Chennai", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "open",
    subject: "Payment delay against cleared dues",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Payment delay grievance for Royal Agencies, Chennai.)",
    raisedOn: "11 May 2026", ageDays: 59, ownerRole: "admin", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "11 May 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to IT Support for action." },
    ],
  },
  {
    id: "GRV-2004", distributor: "New Trading Co.", town: "New Delhi", channel: 'Field visit',
    category: "Scheme & claims", priority: "low", status: "resolved",
    subject: "Scheme/claim credit not reflected",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Scheme/claim dispute grievance for New Trading Co., New Delhi.)",
    raisedOn: "16 Jun 2026", ageDays: 8, ownerRole: "finance", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "24 Jun 2026", by: "Finance team", note: "Reviewed and closed by Finance on 24 Jun 2026." },
    ],
  },
  {
    id: "GRV-2005", distributor: "Om Traders", town: "Solan", channel: 'Field visit',
    category: "System access", priority: "high", status: "in_progress",
    subject: "Unable to access DB ordering system",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a System/technical issue grievance for Om Traders, Solan.)",
    raisedOn: "08 Jun 2026", ageDays: 31, ownerRole: "ase_asm", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "08 Jun 2026", by: "ASE/ASM team", note: "Picked up by ASM; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2006", distributor: "Krishna Commercial Agency", town: "Hyderabad", channel: 'Field visit',
    category: "Other", priority: "high", status: "resolved",
    subject: "Territory/beat boundary conflict with neighbouring DB",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Territory conflict grievance for Krishna Commercial Agency, Hyderabad.)",
    raisedOn: "13 Jun 2026", ageDays: 3, ownerRole: "finance", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "16 Jun 2026", by: "Finance team", note: "Reviewed and closed by Finance on 16 Jun 2026." },
    ],
  },
  {
    id: "GRV-2007", distributor: "United General Stores", town: "Agartala", channel: 'Field visit',
    category: "Supply & stock", priority: "low", status: "open",
    subject: "Stock return not processed",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Stock return dispute grievance for United General Stores, Agartala.)",
    raisedOn: "28 May 2026", ageDays: 42, ownerRole: "channel_dev", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "28 May 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to Trade Marketing for action." },
    ],
  },
  {
    id: "GRV-2008", distributor: "Prime Distributors", town: "Gurugram", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "open",
    subject: "Credit limit dispute needs resolution",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Credit limit dispute grievance for Prime Distributors, Gurugram.)",
    raisedOn: "21 May 2026", ageDays: 49, ownerRole: "finance", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "21 May 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to Finance for action." },
    ],
  },
  {
    id: "GRV-2009", distributor: "Krishna Enterprises", town: "Nashik", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "in_progress",
    subject: "Credit limit dispute needs resolution",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Credit limit dispute grievance for Krishna Enterprises, Nashik.)",
    raisedOn: "14 May 2026", ageDays: 56, ownerRole: "channel_dev", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "14 May 2026", by: "Channel Dev team", note: "Picked up by Trade Marketing; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2010", distributor: "Deccan Sales Corporation", town: "Bilaspur", channel: 'Field visit',
    category: "Other", priority: "medium", status: "open",
    subject: "Territory/beat boundary conflict with neighbouring DB",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Territory conflict grievance for Deccan Sales Corporation, Bilaspur.)",
    raisedOn: "20 May 2026", ageDays: 50, ownerRole: "mdm", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "20 May 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to MDM for action." },
    ],
  },
  {
    id: "GRV-2011", distributor: "Jai & Sons", town: "Bhubaneswar", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "in_progress",
    subject: "Payment delay against cleared dues",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Payment delay grievance for Jai & Sons, Bhubaneswar.)",
    raisedOn: "04 Jun 2026", ageDays: 35, ownerRole: "admin", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "04 Jun 2026", by: "Admin/IT team", note: "Picked up by IT Support; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2012", distributor: "Godavari Sales Corporation", town: "Dibrugarh", channel: 'Field visit',
    category: "Payments & credit", priority: "medium", status: "open",
    subject: "Credit limit dispute needs resolution",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Credit limit dispute grievance for Godavari Sales Corporation, Dibrugarh.)",
    raisedOn: "01 Jul 2026", ageDays: 8, ownerRole: "ase_asm", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "01 Jul 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to ASM for action." },
    ],
  },
  {
    id: "GRV-2013", distributor: "Shri Marketing", town: "Cuttack", channel: 'Field visit',
    category: "Other", priority: "low", status: "resolved",
    subject: "Concern raised about field staff conduct",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Field staff behavioral issue grievance for Shri Marketing, Cuttack.)",
    raisedOn: "16 May 2026", ageDays: 4, ownerRole: "admin", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "20 May 2026", by: "Admin/IT team", note: "Reviewed and closed by IT Support on 20 May 2026." },
    ],
  },
  {
    id: "GRV-2014", distributor: "Shree Commercial Agency", town: "Patna", channel: 'Field visit',
    category: "Scheme & claims", priority: "high", status: "in_progress",
    subject: "Rate card mismatch on recent orders",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Rate card mismatch grievance for Shree Commercial Agency, Patna.)",
    raisedOn: "18 Jun 2026", ageDays: 21, ownerRole: "admin", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "18 Jun 2026", by: "Admin/IT team", note: "Picked up by IT Support; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2015", distributor: "United Trading Co.", town: "Siliguri", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "open",
    subject: "Credit limit dispute needs resolution",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Credit limit dispute grievance for United Trading Co., Siliguri.)",
    raisedOn: "29 Apr 2026", ageDays: 71, ownerRole: "channel_dev", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "29 Apr 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to Trade Marketing for action." },
    ],
  },
  {
    id: "GRV-2016", distributor: "Royal Marketing", town: "Chandigarh", channel: 'Field visit',
    category: "Supply & stock", priority: "medium", status: "in_progress",
    subject: "Stock return not processed",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Stock return dispute grievance for Royal Marketing, Chandigarh.)",
    raisedOn: "09 May 2026", ageDays: 61, ownerRole: "channel_dev", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "09 May 2026", by: "Channel Dev team", note: "Picked up by Trade Marketing; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2017", distributor: "Godavari Trading Co.", town: "Kohima", channel: 'Field visit',
    category: "Other", priority: "medium", status: "in_progress",
    subject: "Territory/beat boundary conflict with neighbouring DB",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Territory conflict grievance for Godavari Trading Co., Kohima.)",
    raisedOn: "07 Jun 2026", ageDays: 32, ownerRole: "admin", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "07 Jun 2026", by: "Admin/IT team", note: "Picked up by IT Support; investigation under way, distributor kept updated." },
    ],
  },
  {
    id: "GRV-2018", distributor: "Shree Distributors", town: "Faridabad", channel: 'Field visit',
    category: "Payments & credit", priority: "high", status: "resolved",
    subject: "Payment delay against cleared dues",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Payment delay grievance for Shree Distributors, Faridabad.)",
    raisedOn: "19 Jun 2026", ageDays: 4, ownerRole: "finance", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "23 Jun 2026", by: "Finance team", note: "Reviewed and closed by Finance on 23 Jun 2026." },
    ],
  },
  {
    id: "GRV-2019", distributor: "Om Sales Corporation", town: "Chandigarh", channel: 'Field visit',
    category: "Supply & stock", priority: "high", status: "resolved",
    subject: "Stock return not processed",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Stock return dispute grievance for Om Sales Corporation, Chandigarh.)",
    raisedOn: "09 May 2026", ageDays: 1, ownerRole: "admin", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "10 May 2026", by: "Admin/IT team", note: "Reviewed and closed by IT Support on 10 May 2026." },
    ],
  },
  {
    id: "GRV-2020", distributor: "Sri Enterprises", town: "Rajkot", channel: 'Field visit',
    category: "Scheme & claims", priority: "medium", status: "resolved",
    subject: "Scheme/claim credit not reflected",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Scheme/claim dispute grievance for Sri Enterprises, Rajkot.)",
    raisedOn: "19 May 2026", ageDays: 6, ownerRole: "ase_asm", slaLabel: "Closed", isOverdue: false,
    updates: [
      { on: "25 May 2026", by: "ASE/ASM team", note: "Reviewed and closed by ASM on 25 May 2026." },
    ],
  },
  {
    id: "GRV-2021", distributor: "Sri Traders", town: "Bengaluru", channel: 'Field visit',
    category: "Payments & credit", priority: "low", status: "open",
    subject: "Payment delay against cleared dues",
    detail: "Distributor-raised grievance logged via ASM — details captured during field visit. (Logged as a Payment delay grievance for Sri Traders, Bengaluru.)",
    raisedOn: "06 May 2026", ageDays: 64, ownerRole: "ase_asm", slaLabel: "Overdue", isOverdue: true,
    updates: [
      { on: "06 May 2026", by: "Intake Agent", note: "Logged from field/ASM report; routed to ASM for action." },
    ],
  },
]

/** Grievances for a given distributor by name — used by the DB 360° profile. */
export function grievancesFor(distributor: string, all: Grievance[]): Grievance[] {
  const key = distributor.trim().toLowerCase()
  return all.filter((g) => g.distributor.trim().toLowerCase() === key)
}
