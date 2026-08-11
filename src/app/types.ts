// Domain types — modeled on the scope document's conceptual/physical data model.
// This is a prototype: everything is mock data, no backend.

export type RoleCode =
  | 'ase_asm'
  | 'finance'
  | 'channel_dev'
  | 'mdm'
  | 'leadership'
  | 'admin'

export interface Role {
  code: RoleCode
  label: string
  /** persona accent color (CSS var name) */
  colorVar: string
  blurb: string
}

/** Whether a user can open (View) and/or act on (Manage) a given screen. */
export interface ScreenPermission {
  view: boolean
  manage: boolean
}

/** Row-level (data) access, layered on top of screen-level access: 'all' sees every record;
 *  'own_region' only sees records whose state falls in the persona's own macro-region
 *  (User.region); 'own_state' narrows further to the persona's own specific state (User.state).
 *  Set per persona (and which data-bearing screens it applies to) by the Super Admin. */
export type DataScope = 'all' | 'own_region' | 'own_state'

/** A data-bearing screen the Super Admin can toggle row-level scoping on/off for, independently
 *  per persona — e.g. a persona might be region-scoped on Partners but see all of GTM Coverage. */
export type DataEntity = 'partners' | 'gtm_coverage' | 'dashboard' | 'analytics'

/** One of Analytics' three tabs — the Super Admin can hide specific tabs per persona (e.g. ASE/ASM
 *  sees Overview + Distributor Detail but not Onboarding Efficiency, which is leadership's view). */
export type AnalyticsSection = 'overview' | 'detail' | 'efficiency'

export interface User {
  id: string
  name: string
  email: string
  roleCode: RoleCode
  region?: string
  /** Specific state name (e.g. "Maharashtra") — matched against GTM_STATES for 'own_state' scope. */
  state?: string
  isActive?: boolean
  /** Per-screen View/Manage permission, keyed by nav route path (e.g. '/leads'). */
  access?: Record<string, ScreenPermission>
}

export type Scenario = 'clean' | 'flagged'

export type PartnerTypeCode = 'distributor' | 'vendor' | 'logistics' | 'copacker'

export interface PartnerType {
  code: PartnerTypeCode
  label: string
  isActive: boolean // false => "Coming soon"
  documents: string[]
  workflow: string[]
}

export type ApplicationStatus =
  | 'draft'
  | 'auto_cleared'
  | 'flagged'
  | 'approved'
  | 'rejected'

export type ApplicationSubtype = 'new' | 'replacement' | 'additional'

export interface Candidate {
  slot: 1 | 2 | 3
  name: string
  town: string
  turnoverMonthly: number // Rs Lakh
  coverageOutlets: number
  infraScore: number // 1-10
  financialScore: number // 1-10
  isRecommended: boolean
  confidencePct: number
}

// Pipeline stage a candidate/lead sits in — replaces the old fixed DB1/DB2/DB3 slots
// with an arbitrary-length, drag-and-drop-able pipeline. 'rejected' is a dead-end stage (not a
// deletion) — a rejected lead stays visible on Leads and can be sent back into New Application.
export type CandidateStage = 'open' | 'pending' | 'approval_1' | 'approval_2' | 'active' | 'rejected'

export interface CandidateCard {
  id: string
  name: string
  town: string
  dbCategory: string
  turnoverMonthly: number // Rs L
  expectedAcmeTurnover: number // Rs L
  coverageOutlets: number
  infraScore: number // 0-10 avg
  finEvalPct: number // %
  stage: CandidateStage
  confidencePct: number
  isBestMatch?: boolean
  // set when a user explicitly created this lead (Intake Review "Review & create lead",
  // distributor Evaluate) — the Leads page's pipeline panel shows only these, not seeded ones
  userCreated?: boolean
  // persona that created the lead — ASE/ASM sees only their own leads on the Leads page;
  // Channel Development/Admin see everything the field team created
  createdBy?: RoleCode
  // epoch ms when the lead was created — drives the live SLA timer on the dashboard
  createdAt?: number
  // the mock/intake.ts EXTRACTIONS id this lead was created from, if any — lets New
  // Application's comparison table show the original intake details in a popup
  sourceIntakeId?: string
  // New DB (fresh town) vs Replacement (swapping out an existing DB) vs Additional (same town,
  // second DB) — set from the Create Lead / intake form. Undefined means 'new' (the common case).
  subtype?: ApplicationSubtype
  // "OLD DB Code" — only meaningful when subtype is 'replacement'; the Discontinuation Form for
  // this code must be linked (see CaseRecord.hasDiscontinuationForm) before the replacement can
  // be approved.
  oldDbCode?: string
  // The old DB's legalName, captured alongside its code at pick time (from the Partners
  // directory) — a code alone means nothing to a reviewer without the name attached to it.
  oldDbName?: string
  // Free-text reason, only meaningful when subtype is 'additional' (a second DB in the same town).
  additionalReason?: string
  // Filled in up front at Create Lead time (matching the workbook's own "If Replacement, fill up
  // next sheet" instruction) — carried onto the raised CaseRecord so the Discontinuation Form
  // gate in Approvals is already cleared instead of needing to be filled in again there.
  discontinuationForm?: DisengagementForm
}

export type VerificationStatus = 'not_checked' | 'pending' | 'verified' | 'mismatch'

export interface SubmittedDocument {
  id: string
  caseCode: string
  partnerType: PartnerTypeCode
  docName: string
  claimed?: string
  extracted?: string
  status: VerificationStatus
  /** original uploaded file name, e.g. gst_certificate_cmp2291.pdf */
  fileName?: string
  /** upload date, e.g. '12 May 2025' */
  uploadedOn?: string
  /** upload time of day, e.g. '11:20 AM' */
  uploadedAt?: string
  /** date verification cleared, e.g. '10 May 2025' */
  verifiedOn?: string
  /** doc is optional for this partner type (Document Intelligence off) */
  optional?: boolean
  /** counted toward "uploaded this week" */
  thisWeek?: boolean
}

// Acme Distribution's "Distributor Disengagement Recommendation Form" — the real sheet a Replacement DB's
// old distributor gets filled in against, before the Discontinuation Form gate can clear
// (see CaseRecord.hasDiscontinuationForm / .discontinuationForm below).
export interface DisengagementForm {
  distributorNameAddressDbCode: string
  dateOfAppointment: string
  majorTownsCovered: string
  handlesOtherCompanies: boolean
  competingCompanies: string[] // up to 4, only meaningful when handlesOtherCompanies is true
  salesHistory: {
    fy24: { avgSalesPerMonth: number; growthPct: number }
    fy25: { avgSalesPerMonth: number; growthPct: number }
  }
  terminationReason: string
  terminationReasonOther?: string
  distributorDesireReason: string
  distributorDesireReasonOther?: string
  stockValueLakh: number
  actionPlanned: { transferredTo?: string; liquidatedInMarket?: string; others?: string }
  ndcSubmitted: boolean
  ndcSubmittedTillMonth?: string
}

export interface CaseMessage {
  id: string
  authorRole: RoleCode
  authorName: string
  body: string
  isNextReplier?: boolean
}

export interface CaseRecord {
  code: string // e.g. CMP-2291
  partnerName: string
  partnerType: PartnerTypeCode
  town: string
  state: string
  subtype: ApplicationSubtype
  status: ApplicationStatus
  ownerRole: RoleCode
  // Every role that has ever owned this case, including the current ownerRole — so a team that
  // cleared its own check (and either got parked at 'approved' while a sibling case is still
  // open, or handed off to Leadership) can still find this case in their own queue by having
  // ever been involved, not just by matching the CURRENT ownerRole. Undefined on seeded/legacy
  // cases that predate this — callers fall back to [ownerRole] for those.
  involvedRoles?: RoleCode[]
  slaLabel: string // '6h left' | 'Overdue' | '—'
  isOverdue: boolean
  hasDiscontinuationForm: boolean
  // The actual filled-in Disengagement Recommendation Form content, once submitted — undefined
  // until the ASE/ASM fills it in (hasDiscontinuationForm can still be true on old/seeded cases
  // that predate this and never carried the structured form itself).
  discontinuationForm?: DisengagementForm
  confidencePct: number
  // Set when this case was raised live from the New Application wizard (rather than seeded
  // mock data) — links it back to the candidate so approving it here can advance that pipeline.
  candidateId?: string
  // Human-readable reason for the flag, computed from the actual numbers at flag time —
  // shown instead of the generic per-role text used for seeded cases that carry no detail.
  flagDetail?: string
  // Who gives final sign-off once Finance/Channel Development clear their check — SM below the
  // ₹50L expected-turnover bar, RBL above it (see approvalAuthority in mock/onboarding.ts).
  // Defaults to 'SM' for seeded cases that never carried this through.
  signoffAuthority?: 'SM' | 'RBL'
  // Structured numbers behind the flag — populated only for cases the wizard raises live;
  // undefined for seeded demo cases that only carry flagDetail text.
  financeSnapshot?: CaseFinanceSnapshot
  channelSnapshot?: CaseChannelSnapshot
  // Required financial-verification documents actually uploaded (key = BANK_STATEMENT_KEY) —
  // persisted on the case itself, not local component state, so the gate survives navigation
  // and bulk-approve can see it too. dataUrl is the real file's own bytes (base64), so whoever
  // reviews it later — Finance now, Leadership once it's routed to them — sees the actual
  // document the reviewer attached, not a synthetic stand-in generated from the case numbers.
  financeDocsUploaded?: Record<string, { name: string; dataUrl?: string }>
  // The channel-gate "Updated Coverage Plan" document, once actually uploaded — file name.
  channelDocUploaded?: string
  // Notes left for Leadership (by whoever currently owns the case) — persisted on the case
  // itself, not just fired off as a one-time notification, so Leadership can actually read them
  // back when the case reaches their queue instead of finding only a terse audit-log line.
  notesForLeadership?: { author: string; body: string; when: string }[]
  // Set the one time Leadership's final sign-off notifies the ASE/ASM that onboarding is
  // complete — guards that ping from ever firing twice for the same case (e.g. a double-click
  // before the queue re-renders it out of the actionable list).
  onboardingNotified?: boolean
}

export interface CaseFinanceSnapshot {
  ownFunds: number // ₹L — "Total Own Funds/Borrowed", the recommendation form field
  ccLimit: number // ₹L — "CC Limit", the recommendation form field
  capitalAvailable: number // ₹L — ownFunds + ccLimit
  requiredInvestment: number // ₹L
  fundingGap: number // ₹L, max(0, required - available)
  readinessPct: number // capitalAvailable / requiredInvestment * 100, rounded
}

export interface CaseChannelSnapshot {
  score: number // infra score /10
  threshold: number // required infra threshold
  gap: number // max(0, threshold - score)
  readinessPct: number // score / threshold * 100, rounded
}

export interface Partner {
  id: string
  legalName: string
  partnerType: PartnerTypeCode
  state: string
  town: string
  status: 'in_review' | 'active' | 'discontinued'
  /** date this partner was onboarded/appointed, e.g. '18 Jun 2022' — drives the "aging"/tenure metric in Analytics. */
  onboardedAt?: string
  /** date a 'discontinued' partner actually deboarded, e.g. '20 Jun 2026' — undefined for active/in_review partners. */
  discontinuedAt?: string
  /** e.g. 'DB-1187' — the stable business code Create Lead's "OLD DB Code" field (Replacement
   *  DB) looks this partner up by. Undefined on partner types that don't carry one (vendor, etc). */
  dbCode?: string
}

export interface KPI {
  label: string
  value: string
  accent?: boolean
  /** e.g. '↑ 50%' — rendered alongside "vs last month" */
  delta?: string
  deltaGood?: boolean
}

export interface JourneyStep {
  label: string
  state: 'done' | 'current' | 'upcoming'
  // where clicking the step takes you — must exist in that persona's MODULES_BY_ROLE
  route?: string
  // static badge count; the Dashboard overrides it with live store counts where possible
  count?: number
}

/** The single next action the dashboard nudges this persona toward. */
export interface UpNext {
  lead: string   // e.g. 'Review AI-ranked candidates for'
  detail: string // e.g. 'Nashik · GT DB (with CSO/DSM)'
  cta: string    // button label
  route: string
}

export interface QuickAction {
  label: string
  route: string
  icon: string // IconName — kept as string so types.ts stays free of component imports
  count?: number
}

export interface PersonaDashboard {
  roleCode: RoleCode
  kpis: KPI[]
  journey: JourneyStep[]
  insight: string
  upNext: UpNext
  quickActions: QuickAction[]
}
