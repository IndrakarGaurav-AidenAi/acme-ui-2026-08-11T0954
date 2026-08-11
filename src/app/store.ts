import { Injectable, effect, signal } from '@angular/core'
import type { AnalyticsSection, CandidateCard, CandidateStage, CaseMessage, CaseRecord, DataEntity, DataScope, DisengagementForm, Partner, PartnerTypeCode, RoleCode, Scenario, ScreenPermission, User } from './types'
import { DEFAULT_DATA_SCOPE_BY_ROLE, DEFAULT_DATA_ENTITIES_BY_ROLE, DEFAULT_ANALYTICS_SECTIONS_BY_ROLE } from './mock/roles'
import { DEMO_PARTNERS, QUEUE_CASES } from './mock/cases'
import type { CopilotAgent } from './lib/copilot'
import { INITIAL_USERS } from './mock/personas'
import { DEFAULT_INFRA } from './mock/onboarding'
import type { InfraState } from './mock/onboarding'
import { INITIAL_GRIEVANCES } from './mock/grievances'
import type { RequiredDoc } from './mock/intake'
import type { Grievance, GrievanceStatus } from './mock/grievances'
import { INITIAL_THREADS } from './mock/communication'
import type { Thread } from './mock/communication'
import { INITIAL_NOTIFICATIONS } from './mock/notifications'
import type { AppNotification } from './mock/notifications'
import { INITIAL_AUDIT } from './mock/audit'
import type { AuditEntry } from './mock/audit'
import { MODULES_BY_ROLE } from './components/shell/nav'
import * as candidatesApi from './services/candidates.service'
import type { BackendCandidate } from './services/candidates.service'
import * as grievancesApi from './services/grievances.service'
import type { BackendGrievance } from './services/grievances.service'
import * as communicationApi from './services/communication.service'
import type { BackendThread } from './services/communication.service'
import * as notificationsApi from './services/notifications.service'
import * as reportsApi from './services/reports.service'
import * as auditApi from './services/audit.service'
import * as casesApi from './services/cases.service'
import type { BackendCase } from './services/cases.service'
import * as partnersApi from './services/partners.service'
import type { BackendPartner } from './services/partners.service'
import * as mySettingsApi from './services/my-settings.service'
import * as rolesAdminApi from './services/roles-admin.service'
import * as usersAdminApi from './services/users-admin.service'
import type { BackendUserProfile } from './services/users-admin.service'
import * as intakeActionsApi from './services/intake-actions.service'
import * as authExtraApi from './services/auth-extra.service'
import { ApiError } from './lib/api'

// Formats the configurable SLA window (My Settings) into the "<n>h left" / "<n>d left" label
// Dashboard's SlaTimer already parses — days once the window is a whole multiple of 24h.
export function slaLabelFromHours(hours: number): string {
  return hours > 0 && hours % 24 === 0 ? `${hours / 24}d left` : `${hours}h left`
}

// Next case code for a newly-flagged candidate — matches the CMP-#### / VND-#### convention
// used by every seeded case, instead of leaking the candidate's internal id into the code.
export function nextCaseCode(existing: CaseRecord[], partnerType: PartnerTypeCode): string {
  const prefix = partnerType === 'vendor' ? 'VND' : 'CMP'
  const base = prefix === 'VND' ? 417 : 2291
  const nums = existing
    .map((c) => c.code)
    .filter((code) => code.startsWith(`${prefix}-`))
    .map((code) => parseInt(code.slice(prefix.length + 1), 10))
    .filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : base) + 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

// Local-only UI state (selectedCandidateId, evalIds, processedIntakeIds, intakeDocOverrides,
// scenario, viewingAs — see PersistedShape) that has no real per-resource backend endpoint of its
// own. Everything else in PersistedShape (candidates, cases, grievances, threads, notifications,
// audit, reports, partners, users, my-settings...) is now backed by a real REST endpoint (see the
// sync*FromServer methods below) and persists there instead. This used to also round-trip through
// a generic `/session` blob endpoint on a separate Python service that isn't part of this backend
// (no Spring Boot controller ever handled that path — SecurityConfig's `/session` permit-all was a
// leftover migration shim with nothing behind it, so those calls always silently 404'd and fell
// back to localStorage anyway); keeping a whole-app blob dump around once every domain has its own
// real endpoint would just be a second, competing source of truth for the same data.
const SESSION_KEY = 'rcpl-session'
const sessionFileStorage = {
  getItem: (): string | null => localStorage.getItem(SESSION_KEY),
  setItem: (value: string): void => localStorage.setItem(SESSION_KEY, value),
  removeItem: (): void => localStorage.removeItem(SESSION_KEY),
}

// Next DB Code for a freshly onboarded distributor — one past whatever's already in the
// directory, so a partner onboarded live can itself be looked up as an "OLD DB Code" the next
// time someone replaces it.
function nextDbCode(partners: Partner[]): string {
  const nums = partners.map((p) => parseInt(p.dbCode?.replace(/^DB-/, '') ?? '', 10)).filter((n) => !isNaN(n))
  return `DB-${(nums.length ? Math.max(...nums) : 1000) + 1}`
}

// A candidate that clears its final Leadership sign-off — OR auto-clears straight through the
// wizard without ever being flagged — gets a real, live Partner record here, keyed by candidateId
// (not name+town) so it never collides with/overwrites an unrelated seeded partner that happens
// to share a name. Calling this again for the same candidate just re-marks it active.
function upsertActivePartner(partners: Partner[], c: { candidateId?: string; partnerName: string; partnerType: PartnerTypeCode; state: string; town: string }): Partner[] {
  const id = `candidate:${c.candidateId}`
  return partners.some((p) => p.id === id)
    ? partners.map((p) => (p.id === id ? { ...p, status: 'active' as const } : p))
    : [...partners, {
      id, legalName: c.partnerName, partnerType: c.partnerType, state: c.state, town: c.town, status: 'active' as const, onboardedAt: dateStamp(),
      dbCode: c.partnerType === 'distributor' ? nextDbCode(partners) : undefined,
    }]
}

// Maps the backend's CandidateDto onto the frontend's CandidateCard — same fields, just
// null-vs-undefined and a couple of backend-only flags (shortlisted tracked separately here via
// evalIds, isBestMatch/userCreated coerced to undefined when false so they behave like the
// frontend's own optional-boolean convention elsewhere).
function candidateFromBackend(b: BackendCandidate): CandidateCard {
  return {
    id: b.id, name: b.name, town: b.town ?? '', dbCategory: b.dbCategory ?? '',
    turnoverMonthly: b.turnoverMonthly ?? 0, expectedAcmeTurnover: b.expectedAcmeTurnover ?? 0,
    coverageOutlets: b.coverageOutlets ?? 0, infraScore: b.infraScore ?? 0, finEvalPct: b.finEvalPct ?? 0,
    stage: b.stage as CandidateStage, confidencePct: b.confidencePct ?? 0,
    isBestMatch: b.isBestMatch || undefined, userCreated: b.userCreated || undefined,
    createdBy: (b.createdBy ?? undefined) as RoleCode | undefined, createdAt: b.createdAt ?? undefined,
    sourceIntakeId: b.sourceIntakeId ?? undefined, subtype: (b.subtype ?? undefined) as CandidateCard['subtype'],
    oldDbCode: b.oldDbCode ?? undefined, oldDbName: b.oldDbName ?? undefined,
    additionalReason: b.additionalReason ?? undefined,
    discontinuationForm: (b.discontinuationForm ?? undefined) as CandidateCard['discontinuationForm'],
  }
}

// Merge live server candidates over whatever's already in the signal (persisted/local-only rows
// the server doesn't know about yet are kept, not dropped) — same resilient-overlay pattern as
// the Intake Inbox's pull().
function mergeCandidatesFromServer(local: CandidateCard[], server: BackendCandidate[]): CandidateCard[] {
  const mapped = server.map(candidateFromBackend)
  const serverIds = new Set(mapped.map((c) => c.id))
  return [...mapped, ...local.filter((c) => !serverIds.has(c.id))]
}

function grievanceFromBackend(b: BackendGrievance): Grievance {
  return {
    id: b.id, distributor: b.distributor, town: b.town, channel: b.channel as Grievance['channel'],
    category: b.category as Grievance['category'], priority: b.priority as Grievance['priority'],
    status: b.status as GrievanceStatus, subject: b.subject, detail: b.detail, raisedOn: b.raisedOn,
    ageDays: b.ageDays, ownerRole: b.ownerRole as RoleCode, slaLabel: b.slaLabel, isOverdue: b.isOverdue,
    updates: b.updates.map((u) => ({ on: u.on, by: u.by, note: u.note })),
  }
}

function mergeGrievancesFromServer(local: Grievance[], server: BackendGrievance[]): Grievance[] {
  const mapped = server.map(grievanceFromBackend)
  const serverIds = new Set(mapped.map((g) => g.id))
  return [...mapped, ...local.filter((g) => !serverIds.has(g.id))]
}

function threadFromBackend(b: BackendThread): Thread {
  return {
    code: b.code, town: b.town, partnerName: b.partnerName, audience: b.audience as Thread['audience'],
    participants: b.participants.map((m) => ({ id: m.id, authorRole: m.authorRole as RoleCode, authorName: m.authorName, body: m.body, isNextReplier: m.isNextReplier || undefined })),
    last: b.last,
  }
}

function mergeThreadsFromServer(local: Thread[], server: BackendThread[]): Thread[] {
  const mapped = server.map(threadFromBackend)
  const serverCodes = new Set(mapped.map((t) => t.code))
  return [...mapped, ...local.filter((t) => !serverCodes.has(t.code))]
}

function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const serverIds = new Set(server.map((x) => x.id))
  return [...server, ...local.filter((x) => !serverIds.has(x.id))]
}

function userFromBackend(b: BackendUserProfile): User {
  return {
    id: b.id, name: b.name, email: b.email, roleCode: b.roleCode as RoleCode,
    region: b.region ?? undefined, state: b.state ?? undefined, isActive: b.isActive,
    access: b.access as Record<string, ScreenPermission>,
  }
}

function partnerFromBackend(b: BackendPartner): Partner {
  return {
    id: b.id, legalName: b.legalName, partnerType: b.partnerType as PartnerTypeCode, state: b.state, town: b.town,
    status: b.status as Partner['status'], onboardedAt: b.onboardedAt ?? undefined,
    discontinuedAt: b.discontinuedAt ?? undefined, dbCode: b.dbCode ?? undefined,
  }
}

function caseFromBackend(b: BackendCase): CaseRecord {
  return {
    code: b.code, partnerName: b.partnerName, partnerType: b.partnerType as PartnerTypeCode,
    town: b.town ?? '', state: b.state ?? '', subtype: b.subtype as CaseRecord['subtype'],
    status: b.status as CaseRecord['status'], ownerRole: b.ownerRole as RoleCode,
    involvedRoles: b.involvedRoles.length ? (b.involvedRoles as RoleCode[]) : undefined,
    slaLabel: b.slaLabel, isOverdue: b.isOverdue, hasDiscontinuationForm: b.hasDiscontinuationForm,
    discontinuationForm: (b.discontinuationForm ?? undefined) as DisengagementForm | undefined,
    confidencePct: b.confidencePct ?? 0, candidateId: b.candidateId ?? undefined,
    flagDetail: b.flagDetail ?? undefined, signoffAuthority: (b.signoffAuthority ?? undefined) as CaseRecord['signoffAuthority'],
    financeSnapshot: b.financeSnapshot ?? undefined, channelSnapshot: b.channelSnapshot ?? undefined,
    financeDocsUploaded: b.financeDocsUploaded ? Object.fromEntries(
      Object.entries(b.financeDocsUploaded).map(([k, v]) => [k, { name: v.name, dataUrl: v.dataUrl ?? undefined }]),
    ) : undefined,
    channelDocUploaded: b.channelDocUploaded ?? undefined, notesForLeadership: b.notesForLeadership ?? undefined,
    onboardingNotified: b.onboardingNotified || undefined,
  }
}

function mergeCasesFromServer(local: CaseRecord[], server: BackendCase[]): CaseRecord[] {
  const mapped = server.map(caseFromBackend)
  const serverCodes = new Set(mapped.map((c) => c.code))
  return [...mapped, ...local.filter((c) => !serverCodes.has(c.code))]
}

export interface ReportItem { id: string; name: string; date: string; format: string }
const INITIAL_REPORTS: ReportItem[] = [
  { id: 'rep1', name: 'Q2 Coverage & Approval Summary', date: '1 Jul 2026', format: 'PDF' },
  { id: 'rep2', name: 'June appointments by state', date: '30 Jun 2026', format: 'Excel' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "6 Jul, 14:30" — matches the audit log's existing timestamp style.
const auditStamp = () => {
  const d = new Date()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
// "6 Jul 2026" — matches the Reports list style.
const dateStamp = () => {
  const d = new Date()
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const PERSIST_VERSION = 16

interface PersistedShape {
  roleCode: RoleCode | null
  viewingAs: RoleCode | null
  authToken: string | null
  authUser: User | null
  scenario: Scenario
  candidates: CandidateCard[]
  selectedCandidateId: string
  evalIds: string[]
  processedIntakeIds: string[]
  notifications: AppNotification[]
  auditLog: AuditEntry[]
  flaggedCases: CaseRecord[]
  partners: Partner[]
  slaHours: number
  intakeDocOverrides: Record<string, Record<string, RequiredDoc>>
}

@Injectable({ providedIn: 'root' })
export class AppStore {
  // session / auth — real login against the Python auth service (backend/, proxied at /auth).
  // roleCode/authUser both come from the server's JWT-backed response, not a client-side pick.
  readonly roleCode = signal<RoleCode | null>(null)
  readonly authToken = signal<string | null>(null)
  readonly authUser = signal<User | null>(null)

  // persona switcher ("viewing as") — defaults to the logged-in role
  readonly viewingAs = signal<RoleCode | null>(null)

  // demo scenario
  readonly scenario = signal<Scenario>('flagged')

  // working New Application case
  readonly selectedPartnerType = signal<PartnerTypeCode | null>(null)
  readonly isReplacement = signal(false)

  // copilot dock
  readonly copilotOpen = signal(false)
  readonly copilotAgent = signal<CopilotAgent>('general')
  // a question queued from another screen — the dock opens, asks it, then clears it
  readonly copilotAsk = signal<string | null>(null)

  // in-app support sidebar — shares the same rail column as Copilot, so only one is ever open
  readonly supportOpen = signal(false)

  // persona / user directory (admin-managed, mock — no backend)
  readonly users = signal<User[]>(INITIAL_USERS)

  // which sidebar screens each persona can see (Admin > Screen access) — seeded from
  // nav.ts's MODULES_BY_ROLE, then admin-editable per role from there on
  readonly moduleAccess = signal<Record<RoleCode, string[]>>(
    Object.fromEntries(Object.entries(MODULES_BY_ROLE).map(([role, paths]) => [role, [...paths]])) as Record<RoleCode, string[]>,
  )

  // Data-level (row) access per persona — 'all' vs 'own_region', set by the Super Admin from
  // Admin > Data access. Enforced wherever a record carries a `state` (Partners, GTM Coverage).
  readonly dataScopeByRole = signal<Record<RoleCode, DataScope>>({ ...DEFAULT_DATA_SCOPE_BY_ROLE })
  // Which data-bearing screens that scope actually applies to, per persona — lets the Super
  // Admin scope a persona on Partners but leave GTM Coverage unrestricted, or vice versa.
  readonly dataEntitiesByRole = signal<Record<RoleCode, DataEntity[]>>(
    Object.fromEntries(Object.entries(DEFAULT_DATA_ENTITIES_BY_ROLE).map(([role, entities]) => [role, [...entities]])) as Record<RoleCode, DataEntity[]>,
  )
  // Which of Analytics' own tabs (Overview / Distributor Detail / Onboarding Efficiency) a
  // persona can see at all — finer-grained than dataEntitiesByRole's whole-screen toggle.
  readonly analyticsSectionsByRole = signal<Record<RoleCode, AnalyticsSection[]>>(
    Object.fromEntries(Object.entries(DEFAULT_ANALYTICS_SECTIONS_BY_ROLE).map(([role, sections]) => [role, [...sections]])) as Record<RoleCode, AnalyticsSection[]>,
  )

  // Partner directory (Manage > Partners) — seeded with the mock roster; a candidate that clears
  // Leadership sign-off gets added here for real instead of vanishing from the app once approved.
  readonly partners = signal<Partner[]>(DEMO_PARTNERS)

  // candidate pipeline — shared between the Candidate Pipeline screen and New Application.
  // Starts empty — Trade Marketing pulls in the leads the field team created & shortlisted on
  // the Leads page; nothing is pre-seeded.
  readonly candidates = signal<CandidateCard[]>([])
  readonly selectedCandidateId = signal('')
  // Leads ticked for side-by-side comparison. Lives in the store (not wizard-local state) so the
  // shortlist an ASE/ASM builds from intake is the same one Channel Development opens and compares.
  readonly evalIds = signal<string[]>([])
  // intake items already reviewed & converted to a lead — hidden from the Intake Inbox
  readonly processedIntakeIds = signal<string[]>([])
  // EXTRACTIONS (mock/intake.ts) is a plain in-memory object, not persisted — a document actually
  // uploaded/replaced from Intake Review would otherwise vanish on the next page reload. Keyed by
  // intake id, then required-doc name, holding the real replacement (with its own dataUrl).
  readonly intakeDocOverrides = signal<Record<string, Record<string, RequiredDoc>>>({})
  readonly infra = signal<InfraState>({ ...DEFAULT_INFRA })
  readonly ownFunds = signal(120)
  readonly ccLimit = signal(80)

  // The Approvals queue — seeded with the mock demo cases, plus real entries the New
  // Application wizard raises when a candidate is actually flagged to Finance/Channel Development.
  readonly flaggedCases = signal<CaseRecord[]>(QUEUE_CASES)

  // per-ASE/ASM inbox configuration (My Settings page) — the Intake Agent watches this mailbox
  readonly inboxProvider = signal<'gmail' | 'outlook' | null>('outlook')
  readonly inboxAddress = signal('rmalhotra@acme-field.in')
  readonly autoForwardUnmatched = signal(true)
  // per-ASE/ASM SLA review window (My Settings page)
  readonly slaHours = signal(24)

  // distributor grievances (Grievances module + surfaced on the DB 360° profile)
  readonly grievances = signal<Grievance[]>(INITIAL_GRIEVANCES)

  // case/partner communication — shared so any screen can nudge a partner or open a thread.
  readonly commThreads = signal<Thread[]>(INITIAL_THREADS)
  readonly selectedThreadCode = signal(INITIAL_THREADS[0].code)

  // topbar notifications bell
  readonly notifications = signal<AppNotification[]>(INITIAL_NOTIFICATIONS)

  // live audit trail — appended to by real actions (approvals, onboarding, exports)
  readonly auditLog = signal<AuditEntry[]>(INITIAL_AUDIT)

  // shareable reports (Leadership export/share)
  readonly reports = signal<ReportItem[]>(INITIAL_REPORTS)

  // Becomes true once the persisted session (backend file, else localStorage) has been read and
  // applied — replaces zustand persist's `useApp.persist.hasHydrated()` / `onFinishHydration`.
  readonly hydrated = signal(false)

  constructor() {
    void this.hydrate()

    // Auto-persist-on-change — mirrors zustand persist's own subscribe-and-save, restricted to
    // exactly the fields the original `partialize` selected: session/auth identity, the lead
    // pipeline & comparison shortlist, and everything else that must survive reloads/persona
    // switches. Everything else resets to its mock seed on every load, same as the original.
    effect(() => {
      const snapshot: PersistedShape = {
        roleCode: this.roleCode(),
        viewingAs: this.viewingAs(),
        authToken: this.authToken(),
        authUser: this.authUser(),
        scenario: this.scenario(),
        candidates: this.candidates(),
        selectedCandidateId: this.selectedCandidateId(),
        evalIds: this.evalIds(),
        processedIntakeIds: this.processedIntakeIds(),
        notifications: this.notifications(),
        auditLog: this.auditLog(),
        flaggedCases: this.flaggedCases(),
        partners: this.partners(),
        slaHours: this.slaHours(),
        intakeDocOverrides: this.intakeDocOverrides(),
      }
      if (!this.hydrated()) return
      void sessionFileStorage.setItem(JSON.stringify({ version: PERSIST_VERSION, state: snapshot }))
    })
  }

  private async hydrate(): Promise<void> {
    try {
      const raw = await sessionFileStorage.getItem()
      if (raw) {
        const parsed = JSON.parse(raw) as { version: number; state: Partial<PersistedShape> }
        const state = parsed.version !== PERSIST_VERSION ? this.migrate(parsed.state) : parsed.state
        this.applyPersisted(state)
      }
    } catch {
      /* corrupt or missing session — start from defaults */
    } finally {
      this.hydrated.set(true)
    }
    this.syncAllFromServer()
  }

  // Fired once after a persisted session restores an existing token (end of hydrate()) and again
  // right after a fresh login() sets a new one — hydrate() only runs once at app startup, so
  // without this second call site, a brand-new login in a session that started with no persisted
  // token would never pull any server data in. A no-op (all calls just 401-and-catch) if there's
  // no token at all yet.
  private syncAllFromServer(): void {
    if (!this.authToken()) return
    void this.syncCandidatesFromServer()
    void this.syncGrievancesFromServer()
    void this.syncThreadsFromServer()
    void this.syncNotificationsFromServer()
    void this.syncAuditFromServer()
    void this.syncReportsFromServer()
    void this.syncCasesFromServer()
    void this.syncPartnersFromServer()
    void this.syncMySettingsFromServer()
    void this.syncUsersFromServer()
    authExtraApi.getMe(this.authToken()).then((r) => {
      this.authUser.set(userFromBackend(r.user))
    }).catch(() => { /* backend not running/reachable, or token expired — keep persisted authUser */ })
  }

  private async syncUsersFromServer(): Promise<void> {
    try {
      const server = await usersAdminApi.listUsers(this.authToken())
      this.users.update((local) => mergeById(local, server.map(userFromBackend)))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncPartnersFromServer(): Promise<void> {
    try {
      const server = await partnersApi.listPartners(this.authToken())
      this.partners.update((local) => mergeById(local, server.map(partnerFromBackend)))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  // My Settings is per-logged-in-user server state, so the server response is authoritative
  // outright (no local-wins merge needed like the list-based domains above).
  private async syncMySettingsFromServer(): Promise<void> {
    try {
      const s = await mySettingsApi.getMySettings(this.authToken())
      if (s.inboxProvider) this.inboxProvider.set(s.inboxProvider as 'gmail' | 'outlook')
      if (s.inboxAddress) this.inboxAddress.set(s.inboxAddress)
      this.autoForwardUnmatched.set(s.autoForwardUnmatched)
      this.slaHours.set(s.slaHours)
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncCasesFromServer(): Promise<void> {
    try {
      const server = await casesApi.listCases(this.authToken())
      this.flaggedCases.update((local) => mergeCasesFromServer(local, server))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncNotificationsFromServer(): Promise<void> {
    try {
      const server = await notificationsApi.listNotifications(this.authToken())
      this.notifications.update((local) => mergeById(local, server.map((n) => ({
        id: n.id, title: n.title ?? '', body: n.body ?? '', href: n.href ?? '', time: n.time ?? 'just now',
        read: n.read, forRole: (n.forRole ?? undefined) as RoleCode | undefined,
      }))))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncAuditFromServer(): Promise<void> {
    try {
      const server = await auditApi.listAudit(this.authToken())
      this.auditLog.update((local) => mergeById(local, server.map((a) => ({
        id: a.id, when: a.when ?? '', actor: a.actor ?? '', kind: (a.kind ?? 'human') as AuditEntry['kind'],
        action: a.action ?? '', entity: a.entity ?? '',
      }))))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncReportsFromServer(): Promise<void> {
    try {
      const server = await reportsApi.listReports(this.authToken())
      this.reports.update((local) => mergeById(local, server.map((r) => ({
        id: r.id, name: r.name, date: r.date ?? '', format: r.format ?? '',
      }))))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  // Overlays live server candidates on top of whatever's persisted/local — mirrors the Intake
  // Inbox's pull(): silently keeps the local/mock state if the backend isn't reachable.
  private async syncCandidatesFromServer(): Promise<void> {
    try {
      const server = await candidatesApi.listCandidates(this.authToken())
      this.candidates.update((local) => mergeCandidatesFromServer(local, server))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncGrievancesFromServer(): Promise<void> {
    try {
      const server = await grievancesApi.listGrievances(this.authToken())
      this.grievances.update((local) => mergeGrievancesFromServer(local, server))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private async syncThreadsFromServer(): Promise<void> {
    try {
      const server = await communicationApi.listThreads(this.authToken())
      this.commThreads.update((local) => mergeThreadsFromServer(local, server))
    } catch { /* backend not running/reachable — keep local state */ }
  }

  private applyPersisted(s: Partial<PersistedShape>): void {
    if (s.roleCode !== undefined) this.roleCode.set(s.roleCode)
    if (s.viewingAs !== undefined) this.viewingAs.set(s.viewingAs)
    if (s.authToken !== undefined) this.authToken.set(s.authToken)
    if (s.authUser !== undefined) this.authUser.set(s.authUser)
    if (s.scenario !== undefined) this.scenario.set(s.scenario)
    if (s.candidates !== undefined) this.candidates.set(s.candidates)
    if (s.selectedCandidateId !== undefined) this.selectedCandidateId.set(s.selectedCandidateId)
    if (s.evalIds !== undefined) this.evalIds.set(s.evalIds)
    if (s.processedIntakeIds !== undefined) this.processedIntakeIds.set(s.processedIntakeIds)
    if (s.notifications !== undefined) this.notifications.set(s.notifications)
    if (s.auditLog !== undefined) this.auditLog.set(s.auditLog)
    if (s.flaggedCases !== undefined) this.flaggedCases.set(s.flaggedCases)
    if (s.partners !== undefined) this.partners.set(s.partners)
    if (s.slaHours !== undefined) this.slaHours.set(s.slaHours)
    if (s.intakeDocOverrides !== undefined) this.intakeDocOverrides.set(s.intakeDocOverrides)
  }

  // v2: drop the 3 hand-seeded demo candidates (c1/c2/c3) from any already-persisted session —
  // the pipeline is meant to start empty and be filled from Leads, not carry stale demo rows.
  // v3: pre-v3 sessions never had flaggedCases — start from the current seed and keep only
  // wizard-raised cases (candidateId set) a user actually created, not a stale seed copy.
  // v4: rewrite any legacy `NA-${candidateId}` codes into the CMP-#### / VND-#### format.
  // v5: a Finance/Channel Dev approval closed the case outright with no next step. Push any such
  // case still short of a real Leadership sign-off into that queue now.
  // v6: sessions never had `partners` — start from the seed roster, then catch up any case
  // that's already active-bound but never got its Partner record created.
  // v7: the Kolhapur intake email's replacement candidate was seeded with the SAME name as the
  // unrelated, already-discontinued "Ganesh Distributors" seed partner (p4) — once the candidate
  // went active it showed up as a confusing second "Ganesh Distributors" row. Renamed the seed
  // intake data to "Ganpati Distributors"; rename it in any session that already created this
  // candidate/case/partner under the old, colliding name.
  // v8: sessions saved right around the v7 rollout got persisted already stamped `version: 7`
  // but from BEFORE this rename migration existed, so it never actually ran for them — bump to
  // 8 to force it to run once more (the rename logic itself is unchanged and idempotent).
  // v9: new demo cases/partners added to the seed data (mock/cases.ts) after a session was
  // already persisted never showed up for that session — flaggedCases already self-heals this
  // way (any QUEUE_CASES code not already carried over gets appended below), but `partners` was
  // only ever backfilled from DEMO_PARTNERS when totally absent. Added the same catch-up merge
  // for partners, and bumped the version so already-persisted sessions actually pick it up.
  // v10: appending missing partners (v9) doesn't help the ones already persisted — every partner
  // saved before `onboardedAt`/`discontinuedAt` existed on the Partner type is still missing them,
  // so Analytics' Partner Aging renders empty for any session older than those fields. Backfill
  // both fields from the current DEMO_PARTNERS seed (matched by id) whenever a persisted partner
  // doesn't already have them.
  // v11: same v7/v8 problem again — sessions saved right around the v10 rollout got persisted
  // already stamped `version: 10` but from before the onboardedAt/discontinuedAt backfill above
  // actually ran, so Partner Aging still only shows the handful of partners created after that
  // point. Bump to 11 to force the same (unchanged, idempotent) backfill to run once more.
  // v12: mock/cases.ts's seed data (QUEUE_CASES, DEMO_PARTNERS) was replaced wholesale from the
  // ingested RCPL_Distributor_Onboarding_Dataset.xlsx — flaggedCases already self-heals on every
  // migrate, but partners was only ever appended-to by id (v9), never resynced, so a persisted
  // seed partner kept showing its pre-ingestion legalName/status forever. Seed ids (`p#`) are
  // never mutated by the app itself — only `candidate:${id}` rows are — so it's safe to fully
  // resync every already-persisted seed-id partner from the current DEMO_PARTNERS row.
  // v13: financeDocsUploaded's values changed shape from a plain filename string to
  // `{ name, dataUrl }` — a session persisted before this rollout still has the old string, which
  // reads back as `undefined.name`/`undefined.dataUrl` today.
  // v14: DEMO_PARTNERS grew by ~221 entries (mock/gtmPartners.ts) — folded in so
  // Partners/GTM Coverage/Analytics all derive their distributor counts from the same live array.
  // The v9 catch-up below only appends a DEMO_PARTNERS id missing from the persisted `partners`
  // array, but it's gated behind migrate() actually running — bump to force it once more.
  // v15: added ~8 recently-discontinued distributors to the seed roster so Analytics' Partner
  // Aging "deboarded" line shows real churn instead of a flat zero. New seed ids get appended by
  // the v9 catch-up below, but only when migrate() actually runs — bump so sessions already
  // sitting at v14 pick them up.
  // v16: added `dbCode` to every distributor in DEMO_PARTNERS — the v12 full-resync below already
  // backfills any new seed field onto an already-persisted partner, but only runs when migrate()
  // actually fires. Bump so sessions already sitting at v15 pick up dbCode instead of an empty picker.
  private migrate(persisted: Partial<PersistedShape>): Partial<PersistedShape> {
    const SEED_IDS = new Set(['c1', 'c2', 'c3'])
    const p: Partial<PersistedShape> = { ...persisted }

    if (p.candidates) {
      p.candidates = p.candidates.filter((c) => !SEED_IDS.has(c.id))
      const candidates = p.candidates
      p.evalIds = (p.evalIds ?? []).filter((id) => candidates.some((c) => c.id === id))
      if (p.selectedCandidateId && !candidates.some((c) => c.id === p.selectedCandidateId)) {
        p.selectedCandidateId = candidates[0]?.id ?? ''
      }
    }

    // Pre-v3 sessions never had flaggedCases — start from the current seed and keep only
    // wizard-raised cases (candidateId set) a user actually created, not a stale seed copy.
    const carried = (p.flaggedCases ?? []).filter((c) => c.candidateId)
    // Rewrite any legacy `NA-${candidateId}` codes (pre-v4) into the CMP-#### / VND-#### format,
    // one at a time so codes generated within the same old session still land on distinct numbers.
    const rewritten: CaseRecord[] = []
    for (const c of carried) {
      if (c.code.startsWith('NA-')) {
        const code = nextCaseCode([...QUEUE_CASES, ...rewritten], c.partnerType)
        rewritten.push({ ...c, code })
      } else {
        rewritten.push(c)
      }
    }
    let flaggedCases = [...rewritten, ...QUEUE_CASES.filter((c) => !rewritten.some((x) => x.code === c.code))]
    // Pre-v5: a Finance/Channel Dev approval closed the case outright with no next step.
    // Push any such case still short of a real Leadership sign-off into that queue now.
    flaggedCases = flaggedCases.map((c) => {
      const stuck = c.status === 'approved' && (c.ownerRole === 'finance' || c.ownerRole === 'channel_dev')
        && !(c.candidateId && p.candidates?.some((cd) => cd.id === c.candidateId && cd.stage === 'active'))
      if (!stuck) return c
      const authority = c.signoffAuthority ?? 'SM'
      return { ...c, status: 'flagged' as const, ownerRole: 'leadership' as const, flagDetail: `Financial & infra checks clear — routed to ${authority} for final sign-off.` }
    })
    p.flaggedCases = flaggedCases

    // Pre-v6 sessions never had `partners` — start from the seed roster, then catch up any
    // case that's already active-bound (leadership-owned + approved, or a candidate already at
    // stage 'active') but never got its Partner record created.
    let partners = p.partners ?? DEMO_PARTNERS
    // v9: also catch up any DEMO_PARTNERS entry a session's persisted `partners` predates.
    partners = [...partners, ...DEMO_PARTNERS.filter((seed) => !partners.some((pt) => pt.id === seed.id))]
    // v10/v12: fully resync any seed-id partner (never touched by app logic — only
    // `candidate:${id}` rows are) from the current DEMO_PARTNERS row, so a stale
    // legalName/status/town/onboardedAt/discontinuedAt/dbCode from before a seed-data refresh
    // doesn't linger forever in an already-persisted session.
    partners = partners.map((pt) => {
      const seed = DEMO_PARTNERS.find((s) => s.id === pt.id)
      return seed ? { ...pt, ...seed } : pt
    })
    for (const c of flaggedCases) {
      const candidateActive = c.candidateId && p.candidates?.some((cd) => cd.id === c.candidateId && cd.stage === 'active')
      if (c.ownerRole === 'leadership' && (c.status === 'approved' || candidateActive) && c.candidateId) {
        partners = upsertActivePartner(partners, c)
      }
    }

    // Rename the one candidate/case/partner set that collided with the unrelated discontinued
    // seed partner of the same name — never touches p4 (Ganesh Distributors) itself.
    const RENAMED_CANDIDATE_ID = 'intake-ganesh-distributors'
    if (p.candidates) {
      p.candidates = p.candidates.map((cd) => (cd.id === RENAMED_CANDIDATE_ID ? { ...cd, name: 'Ganpati Distributors' } : cd))
    }
    p.flaggedCases = flaggedCases.map((c) => (c.candidateId === RENAMED_CANDIDATE_ID ? { ...c, partnerName: 'Ganpati Distributors' } : c))
    p.partners = partners.map((pt) => (pt.id === `candidate:${RENAMED_CANDIDATE_ID}` ? { ...pt, legalName: 'Ganpati Distributors' } : pt))

    // v13: coerce any pre-v13 financeDocsUploaded string value into the current { name, dataUrl }
    // shape — no real file bytes to backfill (only the filename ever existed), but at least the
    // name displays and it stops silently reading as undefined.
    p.flaggedCases = (p.flaggedCases ?? []).map((c) => {
      if (!c.financeDocsUploaded) return c
      const fixed = Object.fromEntries(
        Object.entries(c.financeDocsUploaded).map(([k, v]) => [k, typeof v === 'string' ? { name: v } : v]),
      )
      return { ...c, financeDocsUploaded: fixed }
    })

    return p
  }

  // ---- session / auth ----

  login(payload: { token: string; user: User }): void {
    this.roleCode.set(payload.user.roleCode)
    this.viewingAs.set(payload.user.roleCode)
    this.authToken.set(payload.token)
    this.authUser.set(payload.user)
    this.syncAllFromServer()
  }

  logout(): void {
    this.roleCode.set(null)
    this.viewingAs.set(null)
    this.authToken.set(null)
    this.authUser.set(null)
    this.copilotOpen.set(false)
    this.supportOpen.set(false)
  }

  setViewingAs(role: RoleCode): void {
    this.viewingAs.set(role)
  }

  setScenario(s: Scenario): void {
    this.scenario.set(s)
  }

  setSelectedPartnerType(t: PartnerTypeCode | null): void {
    this.selectedPartnerType.set(t)
  }

  setIsReplacement(v: boolean): void {
    this.isReplacement.set(v)
  }

  // ---- copilot dock ----

  toggleCopilot(): void {
    this.copilotOpen.update((v) => !v)
  }

  setCopilotOpen(v: boolean): void {
    this.copilotOpen.set(v)
    if (v) this.supportOpen.set(false)
  }

  setSupportOpen(v: boolean): void {
    this.supportOpen.set(v)
    if (v) this.copilotOpen.set(false)
  }

  setCopilotAgent(a: CopilotAgent): void {
    this.copilotAgent.set(a)
  }

  askCopilot(q: string): void {
    this.copilotOpen.set(true)
    this.copilotAsk.set(q)
  }

  clearCopilotAsk(): void {
    this.copilotAsk.set(null)
  }

  // ---- persona / user directory ----

  // Local-only: UserController's CreateUserRequest.password is @NotBlank, but the Admin > Team
  // "Add user" form (admin.component.ts) never collects a password today — there's nothing to
  // forward. Wiring this for real needs a password field added to that form first.
  addUser(u: Omit<User, 'id'>): void {
    this.users.update((s) => [...s, { ...u, id: `u${Date.now()}` }])
  }

  updateUser(id: string, patch: Partial<Omit<User, 'id'>>): void {
    this.users.update((s) => s.map((u) => (u.id === id ? { ...u, ...patch } : u)))
    usersAdminApi.updateUser(this.authToken(), id, patch).catch(() => { /* backend not running/reachable */ })
  }

  removeUser(id: string): void {
    this.users.update((s) => s.filter((u) => u.id !== id))
    usersAdminApi.deleteUser(this.authToken(), id).catch(() => { /* backend not running/reachable */ })
  }

  // Preserves whatever `manage` bit the role already has server-side for this screen (the
  // frontend's own moduleAccess only ever tracks view/visibility, not manage) rather than
  // guessing — reads current access first, flips just `view`, then patches.
  private syncRoleScreenAccess(role: RoleCode, path: string, view: boolean): void {
    const token = this.authToken()
    rolesAdminApi.getRoleAccess(token, role)
      .then((access) => rolesAdminApi.setRoleAccess(token, role, { screenPath: path, view, manage: access[path]?.manage ?? false }))
      .catch(() => { /* backend not running/reachable */ })
  }

  toggleModuleAccess(role: RoleCode, path: string): void {
    const current = this.moduleAccess()[role] ?? []
    const has = current.includes(path)
    // '/dashboard' is every persona's landing page and can't be switched off.
    if (path === '/dashboard') return
    this.moduleAccess.update((s) => ({
      ...s,
      [role]: has ? current.filter((p) => p !== path) : [...current, path],
    }))
    this.syncRoleScreenAccess(role, path, !has)
  }

  // bulk-replace a persona's visible screens — used when a user's per-screen "View" toggles
  // are saved from Admin > Team, so the sidebar actually reflects what was just unticked
  setModuleAccessForRole(role: RoleCode, paths: string[]): void {
    const prev = new Set(this.moduleAccess()[role] ?? [])
    const next = new Set(['/dashboard', ...paths])
    this.moduleAccess.update((s) => ({ ...s, [role]: Array.from(next) }))
    for (const path of next) if (!prev.has(path)) this.syncRoleScreenAccess(role, path, true)
    for (const path of prev) if (!next.has(path)) this.syncRoleScreenAccess(role, path, false)
  }

  // The backend models data scope per (role, entity) pair; the frontend models one scope value
  // per role applied across whichever entities dataEntitiesByRole has toggled on for that role —
  // so this replicates the same scope onto every entity currently enabled for the role.
  setDataScopeForRole(role: RoleCode, scope: DataScope): void {
    this.dataScopeByRole.update((s) => ({ ...s, [role]: scope }))
    const token = this.authToken()
    for (const entity of this.dataEntitiesByRole()[role] ?? []) {
      rolesAdminApi.setRoleDataScope(token, role, { entity, scope }).catch(() => { /* backend not running/reachable */ })
    }
  }

  toggleDataEntity(role: RoleCode, entity: DataEntity): void {
    const current = this.dataEntitiesByRole()[role] ?? []
    const has = current.includes(entity)
    this.dataEntitiesByRole.update((s) => ({ ...s, [role]: has ? current.filter((e) => e !== entity) : [...current, entity] }))
    // Turning an entity's scoping ON adopts the role's current scope value; turning it OFF has no
    // clean backend equivalent (data-scope is set per-entity, not toggled per-entity), so only the
    // "turning on" direction has anything meaningful to sync.
    if (!has) {
      rolesAdminApi.setRoleDataScope(this.authToken(), role, { entity, scope: this.dataScopeByRole()[role] })
        .catch(() => { /* backend not running/reachable */ })
    }
  }

  toggleAnalyticsSection(role: RoleCode, section: AnalyticsSection): void {
    const current = this.analyticsSectionsByRole()[role] ?? []
    const has = current.includes(section)
    const next = has ? current.filter((x) => x !== section) : [...current, section]
    this.analyticsSectionsByRole.update((s) => ({ ...s, [role]: next }))
    rolesAdminApi.setRoleAnalyticsSections(this.authToken(), role, { sections: next }).catch(() => { /* backend not running/reachable */ })
  }

  // ---- candidate pipeline ----

  setSelectedCandidateId(id: string): void {
    this.selectedCandidateId.set(id)
  }

  // Applies a candidate mutation's backend response over local state once it resolves — the
  // local (optimistic) update below has already happened, so a failed/unreachable backend just
  // means the sync silently no-ops and the optimistic state stands (same resilience pattern as
  // the Intake Inbox's pull()).
  private syncCandidate(call: Promise<BackendCandidate>): void {
    call.then((b) => {
      const mapped = candidateFromBackend(b)
      this.candidates.update((s) => s.map((c) => (c.id === mapped.id ? mapped : c)))
    }).catch(() => { /* backend not running/reachable */ })
  }

  moveCandidate(id: string, stage: CandidateStage): void {
    this.candidates.update((s) => s.map((c) => (c.id === id ? { ...c, stage } : c)))
    this.syncCandidate(candidatesApi.moveCandidateStage(this.authToken(), id, stage))
  }

  // Moves a candidate to 'active' AND creates/upserts its real Partner directory record in one
  // step — unlike plain moveCandidate(id, 'active'), which only ever flipped the candidate's own
  // stage. Use this (not moveCandidate) for every path that completes onboarding.
  activateCandidate(id: string, info: { partnerName: string; partnerType: PartnerTypeCode; town: string; state: string }): void {
    this.candidates.update((s) => s.map((c) => (c.id === id ? { ...c, stage: 'active' as const } : c)))
    this.partners.update((s) => upsertActivePartner(s, { candidateId: id, ...info }))
    this.syncCandidate(candidatesApi.activateCandidate(this.authToken(), id, info))
  }

  addCandidate(): void {
    const n = this.candidates().length
    const draft: CandidateCard = {
      id: `c${n + 1}-${n}`, name: `New candidate ${n + 1}`, town: 'Nashik',
      dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 100, expectedAcmeTurnover: 20, coverageOutlets: 500,
      infraScore: 5, finEvalPct: 70, stage: 'open' as const, confidencePct: 50,
    }
    this.candidates.update((s) => [...s, draft])
    candidatesApi.createCandidate(this.authToken(), {
      name: draft.name, town: draft.town, dbCategory: draft.dbCategory, turnoverMonthly: draft.turnoverMonthly,
      expectedAcmeTurnover: draft.expectedAcmeTurnover, coverageOutlets: draft.coverageOutlets,
      infraScore: draft.infraScore, finEvalPct: draft.finEvalPct, stage: draft.stage, confidencePct: draft.confidencePct,
    }).then((b) => {
      const mapped = candidateFromBackend(b)
      this.candidates.update((s) => s.map((c) => (c.id === draft.id ? mapped : c)))
    }).catch(() => { /* backend not running — keep the local placeholder */ })
  }

  // No backend delete endpoint exists for candidates (by design — a lead is rejected, not
  // destroyed, once it's real); this stays a purely local operation.
  removeCandidate(id: string): void {
    const candidates = this.candidates().filter((c) => c.id !== id)
    const wasSelected = this.selectedCandidateId() === id
    this.candidates.set(candidates)
    if (wasSelected) this.selectedCandidateId.set(candidates[0]?.id ?? '')
    this.evalIds.update((s) => s.filter((x) => x !== id))
  }

  // Rejecting a lead at Evaluation no longer deletes it — it drops out of the comparison
  // shortlist (evalIds) and out of the active wizard selection, but the candidate itself stays
  // on Leads with a 'rejected' stage so it isn't silently lost.
  rejectCandidate(id: string): void {
    this.candidates.update((s) => s.map((c) => (c.id === id ? { ...c, stage: 'rejected' as const } : c)))
    this.evalIds.update((s) => s.filter((x) => x !== id))
    if (this.selectedCandidateId() === id) this.selectedCandidateId.set('')
    this.syncCandidate(candidatesApi.rejectCandidate(this.authToken(), id))
  }

  // Sends a rejected lead back to New Application by resetting it to 'open'.
  reinstateCandidate(id: string): void {
    this.candidates.update((s) => s.map((c) => (c.id === id ? { ...c, stage: 'open' as const } : c)))
    this.syncCandidate(candidatesApi.reinstateCandidate(this.authToken(), id))
  }

  setCandidateDiscForm(id: string, form: DisengagementForm): void {
    this.candidates.update((s) => s.map((c) => (c.id === id ? { ...c, discontinuationForm: form } : c)))
    this.syncCandidate(candidatesApi.setCandidateDiscontinuationForm(this.authToken(), id, form))
  }

  // Pulls a distributor from Leads into the pipeline for scoring (adds it if new, just selects it
  // if already there). Deliberately local-only: `c` may not exist server-side yet (a fresh
  // intake-derived lead), and minting it here would risk the server assigning a different id than
  // the one already referenced elsewhere in this session (evalIds, a raised case's candidateId) —
  // real persistence happens through the dedicated create/create-lead paths instead.
  evaluateCandidate(c: CandidateCard): void {
    this.candidates.update((s) => (s.some((x) => x.id === c.id) ? s : [...s, c]))
    this.selectedCandidateId.set(c.id)
  }

  setEvalIds(ids: string[]): void {
    const prev = new Set(this.evalIds())
    const next = new Set(ids)
    this.evalIds.set(ids)
    for (const id of next) if (!prev.has(id)) this.syncCandidate(candidatesApi.setCandidateShortlisted(this.authToken(), id, true))
    for (const id of prev) if (!next.has(id)) this.syncCandidate(candidatesApi.setCandidateShortlisted(this.authToken(), id, false))
  }

  toggleEvalId(id: string): void {
    const turningOn = !this.evalIds().includes(id)
    this.evalIds.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
    this.syncCandidate(candidatesApi.setCandidateShortlisted(this.authToken(), id, turningOn))
  }

  // add a lead to the pipeline AND the comparison shortlist (idempotent) — used by intake review.
  // Same local-then-reconcile pattern as addCandidate(): the locally-minted id is used immediately
  // (evalIds/selectedCandidateId/downstream navigation all need it synchronously), then swapped for
  // the server-confirmed record once the real create call lands.
  shortlistCandidate(c: CandidateCard): void {
    if (this.candidates().some((x) => x.id === c.id)) {
      this.selectedCandidateId.set(c.id)
      this.evalIds.update((s) => (s.includes(c.id) ? s : [...s, c.id]))
      return
    }
    this.candidates.update((s) => [...s, c])
    this.selectedCandidateId.set(c.id)
    this.evalIds.update((s) => (s.includes(c.id) ? s : [...s, c.id]))
    candidatesApi.createCandidate(this.authToken(), {
      name: c.name, town: c.town, dbCategory: c.dbCategory, turnoverMonthly: c.turnoverMonthly,
      expectedAcmeTurnover: c.expectedAcmeTurnover, coverageOutlets: c.coverageOutlets,
      infraScore: c.infraScore, finEvalPct: c.finEvalPct, stage: c.stage, confidencePct: c.confidencePct,
      sourceIntakeId: c.sourceIntakeId, subtype: c.subtype, oldDbCode: c.oldDbCode, oldDbName: c.oldDbName,
      additionalReason: c.additionalReason, discontinuationForm: c.discontinuationForm,
    }).then((b) => {
      const mapped = candidateFromBackend(b)
      this.candidates.update((s) => s.map((x) => (x.id === c.id ? mapped : x)))
    }).catch(() => { /* backend not running/reachable — keep the local placeholder */ })
  }

  // Best-effort: only intake ids that actually came from a real GET /api/intake response have a
  // matching backend row — a pure mock/intake.ts seed id 404s here and is silently ignored, same
  // as every other resilient sync call in this file.
  markIntakeProcessed(id: string): void {
    this.processedIntakeIds.update((s) => (s.includes(id) ? s : [...s, id]))
    intakeActionsApi.markIntakeItemProcessed(this.authToken(), id).catch(() => { /* mock-only id, or backend unreachable */ })
  }

  setIntakeDocOverride(intakeId: string, doc: RequiredDoc): void {
    this.intakeDocOverrides.update((s) => ({ ...s, [intakeId]: { ...s[intakeId], [doc.name]: doc } }))
    intakeActionsApi.setIntakeDocOverride(this.authToken(), intakeId, doc.name, doc.file, doc.dataUrl)
      .catch(() => { /* mock-only id, or backend unreachable */ })
  }

  setInfra(s: InfraState): void {
    this.infra.set(s)
  }

  setOwnFunds(n: number): void {
    this.ownFunds.set(n)
  }

  setCcLimit(n: number): void {
    this.ccLimit.set(n)
  }

  // ---- approvals / cases ----

  // Upsert by candidateId + ownerRole (falling back to code for the hand-seeded QUEUE_CASES
  // rows, which carry no candidateId): NewApplication mints a FRESH case code via nextCaseCode()
  // on every call, so deduping by code alone never matches and a candidate re-entering the same
  // review step would otherwise raise a brand-new duplicate case each time instead of updating
  // the one already raised for them. A candidate that fails BOTH Finance and Channel Development
  // needs two separate sibling cases (see decideCase's siblingStillOpen below) — matching by
  // candidateId alone made the second team's flagCandidateCase call silently overwrite the
  // first team's case instead of creating its own.
  // Applies a case mutation's backend response over local state once it resolves — same
  // resilient, optimistic-update-first pattern as syncCandidate(). CaseService.raise()/decide()/
  // attachFinanceDoc()/attachChannelDoc()/addNote() all replicate onto sibling cases (same
  // candidateId) server-side already, matching this store's own local sibling-fan-out logic, so a
  // single backend call per action is enough — no need to loop over siblings from here too.
  private syncCase(call: Promise<BackendCase>): void {
    call.then((b) => {
      const mapped = caseFromBackend(b)
      this.flaggedCases.update((s) => s.map((c) => (c.code === mapped.code ? mapped : c)))
    }).catch(() => { /* backend not running/reachable, or a gate the local optimistic update
      doesn't itself enforce (e.g. the replacement/discontinuation-form gate) blocked it server-side
      — the next server sync will reconcile local state back to the authoritative version */ })
  }

  flagCandidateCase(c: CaseRecord): void {
    const matches = (x: CaseRecord) => (c.candidateId ? x.candidateId === c.candidateId && x.ownerRole === c.ownerRole : x.code === c.code)
    const withHistory = { ...c, involvedRoles: [c.ownerRole] }
    this.flaggedCases.update((s) => (
      s.some(matches)
        ? s.map((x) => (matches(x) ? { ...x, ...withHistory, code: x.code, involvedRoles: [...new Set([...(x.involvedRoles ?? [x.ownerRole]), c.ownerRole])] } : x))
        : [withHistory, ...s]
    ))
    this.syncCase(casesApi.raiseCase(this.authToken(), {
      partnerName: c.partnerName, partnerType: c.partnerType, ownerRole: c.ownerRole, town: c.town, state: c.state,
      subtype: c.subtype, candidateId: c.candidateId, flagDetail: c.flagDetail, signoffAuthority: c.signoffAuthority,
      confidencePct: c.confidencePct, hasDiscontinuationForm: c.hasDiscontinuationForm,
      discontinuationForm: c.discontinuationForm, financeSnapshot: c.financeSnapshot, channelSnapshot: c.channelSnapshot,
    }))
  }

  // Finance/Channel Development only clear the ONE check that flagged the case — approving
  // there hands off to Leadership for final SM/RBL sign-off rather than closing the case outright
  // (unless a sibling case for the same candidate, owned by the other team, is still open).
  // MDM and Leadership decisions are terminal.
  decideCase(code: string, decision: 'approved' | 'rejected'): void {
    const target = this.flaggedCases().find((c) => c.code === code)
    if (!target) return
    if (decision === 'rejected') {
      this.flaggedCases.update((s) => s.map((c) => (c.code === code ? { ...c, status: 'rejected' as const } : c)))
      return
    }
    const siblingStillOpen = target.candidateId
      ? this.flaggedCases().some((c) =>
          c.candidateId === target.candidateId && c.code !== code && c.status === 'flagged'
          && (c.ownerRole === 'finance' || c.ownerRole === 'channel_dev'))
      : false
    if ((target.ownerRole === 'finance' || target.ownerRole === 'channel_dev') && !siblingStillOpen) {
      const authority = target.signoffAuthority ?? 'SM'
      this.flaggedCases.update((s) => s.map((c) => (c.code === code
        // involvedRoles keeps 'finance'/'channel_dev' even after ownerRole moves to
        // 'leadership' — so that team can still find this case in their own queue.
        ? { ...c, ownerRole: 'leadership' as const, flagDetail: `Financial & infra checks clear — routed to ${authority} for final sign-off.`, involvedRoles: [...new Set([...(c.involvedRoles ?? [c.ownerRole]), 'leadership' as RoleCode])] }
        : c)))
      return
    }
    // Leadership sign-off (or an MDM vendor-doc decision) — this closes the case for real, and
    // also promotes the candidate out of the approval pipeline and into a real Partner record.
    const becomesActive = target.ownerRole === 'leadership' && !!target.candidateId
    this.flaggedCases.update((s) => s.map((c) => (c.code === code ? { ...c, status: 'approved' as const } : c)))
    if (becomesActive) {
      this.candidates.update((s) => s.map((cd) => (cd.id === target.candidateId ? { ...cd, stage: 'active' as const } : cd)))
      this.partners.update((s) => upsertActivePartner(s, target))
    }
    this.syncCase(casesApi.decideCase(this.authToken(), code, decision))
  }

  // Both doc uploads write onto every sibling case (same candidateId), not just the one case
  // code open right now — a dual-fail candidate's Channel Dev case and Finance/Leadership case
  // are separate records; without this, a document uploaded on one would be invisible on the other.
  // CaseService.attachFinanceDoc() replicates the same way server-side, so syncCase() only needs
  // to fire the one call for `code` itself.
  uploadCaseFinanceDoc(code: string, key: string, fileName: string, dataUrl?: string): void {
    const target = this.flaggedCases().find((c) => c.code === code)
    const matches = (c: CaseRecord) => c.code === code || (!!target?.candidateId && c.candidateId === target.candidateId)
    this.flaggedCases.update((s) => s.map((c) => (matches(c)
      ? { ...c, financeDocsUploaded: { ...c.financeDocsUploaded, [key]: { name: fileName, dataUrl } } }
      : c)))
    this.syncCase(casesApi.attachCaseFinanceDoc(this.authToken(), code, key, fileName, dataUrl))
  }

  uploadCaseChannelDoc(code: string, fileName: string): void {
    const target = this.flaggedCases().find((c) => c.code === code)
    const matches = (c: CaseRecord) => c.code === code || (!!target?.candidateId && c.candidateId === target.candidateId)
    this.flaggedCases.update((s) => s.map((c) => (matches(c) ? { ...c, channelDocUploaded: fileName } : c)))
    this.syncCase(casesApi.attachCaseChannelDoc(this.authToken(), code, fileName))
  }

  // A dual-fail candidate has TWO sibling case records, so a note left on one of them has to be
  // written onto BOTH, not just the case the author happened to have open.
  addCaseNoteForLeadership(code: string, author: string, body: string): void {
    const note = { author, body, when: auditStamp() }
    const target = this.flaggedCases().find((c) => c.code === code)
    const matches = (c: CaseRecord) => c.code === code || (!!target?.candidateId && c.candidateId === target.candidateId)
    this.flaggedCases.update((s) => s.map((c) => (matches(c) ? { ...c, notesForLeadership: [...(c.notesForLeadership ?? []), note] } : c)))
    this.syncCase(casesApi.addCaseNote(this.authToken(), code, author, body))
  }

  markOnboardingNotified(code: string): void {
    this.flaggedCases.update((s) => s.map((c) => (c.code === code ? { ...c, onboardingNotified: true } : c)))
    this.syncCase(casesApi.markCaseOnboardingNotified(this.authToken(), code))
  }

  // ---- inbox / SLA settings ----

  connectInbox(provider: 'gmail' | 'outlook', address: string): void {
    this.inboxProvider.set(provider)
    this.inboxAddress.set(address)
    mySettingsApi.updateMySettings(this.authToken(), { inboxProvider: provider, inboxAddress: address })
      .catch(() => { /* backend not running/reachable */ })
  }

  // Local-only: UpdateSettingsRequest's fields are all "omitted/null means leave unchanged" (same
  // convention as UpdateCandidateRequest etc.), so there's no way to ask the server to actually
  // clear inboxProvider through this endpoint — nothing to call here.
  disconnectInbox(): void {
    this.inboxProvider.set(null)
  }

  setAutoForwardUnmatched(v: boolean): void {
    this.autoForwardUnmatched.set(v)
    mySettingsApi.updateMySettings(this.authToken(), { autoForwardUnmatched: v }).catch(() => { /* backend not running/reachable */ })
  }

  setSlaHours(h: number): void {
    this.slaHours.set(h)
    mySettingsApi.updateMySettings(this.authToken(), { slaHours: h }).catch(() => { /* backend not running/reachable */ })
  }

  // ---- grievances ----

  // Applies a grievance/thread mutation's backend response over local state once it resolves —
  // same resilient, optimistic-update-first pattern as syncCandidate() above. For threads, an
  // empty server participants list (e.g. a bare ensureThread with nothing posted yet) doesn't
  // overwrite the local optimistic seed message — only a non-empty server response is trusted.
  private syncGrievance(call: Promise<BackendGrievance>): void {
    call.then((b) => {
      const mapped = grievanceFromBackend(b)
      this.grievances.update((s) => s.map((g) => (g.id === mapped.id ? mapped : g)))
    }).catch(() => { /* backend not running/reachable */ })
  }

  private syncThread(call: Promise<BackendThread>): void {
    call.then((b) => {
      const mapped = threadFromBackend(b)
      this.commThreads.update((s) => s.map((t) => (t.code === mapped.code
        ? (mapped.participants.length ? mapped : { ...mapped, participants: t.participants, last: t.last })
        : t)))
    }).catch(() => { /* backend not running/reachable */ })
  }

  setGrievanceStatus(id: string, status: GrievanceStatus): void {
    this.grievances.update((s) => s.map((g) => {
      if (g.id !== id || g.status === status) return g
      const label = status === 'open' ? 'Reopened' : status === 'in_progress' ? 'Marked in progress' : 'Resolved'
      return {
        ...g,
        status,
        slaLabel: status === 'resolved' ? 'Closed' : g.slaLabel,
        isOverdue: status === 'resolved' ? false : g.isOverdue,
        updates: [...g.updates, { on: '04 Jul 2026', by: 'You', note: `${label} from the Grievances queue.` }],
      }
    }))
    this.syncGrievance(grievancesApi.setGrievanceStatus(this.authToken(), id, status))
  }

  // marks a grievance in progress and emails the distributor a holding reply — lands in
  // Communication as a partner-facing thread keyed by the grievance id
  sendGrievanceUpdate(id: string): void {
    const g = this.grievances().find((x) => x.id === id)
    if (!g) return
    const holdingReply = 'Our team is actively looking into it and will get back to you once the review is complete.'
    this.grievances.update((s) => s.map((x) => (x.id === id
      ? {
          ...x,
          status: (x.status === 'open' ? 'in_progress' : x.status) as GrievanceStatus,
          updates: [...x.updates, { on: dateStamp(), by: 'You', note: `Emailed distributor: "${holdingReply}"` }],
        }
      : x)))
    const msg: CaseMessage = { id: `grv-${Date.now()}`, authorRole: g.ownerRole, authorName: 'You', body: holdingReply }
    const exists = this.commThreads().some((t) => t.code === g.id)
    this.commThreads.update((s) => (exists
      ? s.map((t) => (t.code === g.id
          ? { ...t, audience: 'partner' as const, last: holdingReply, participants: [...t.participants, msg] }
          : t))
      : [...s, { code: g.id, town: g.town, partnerName: g.distributor, audience: 'partner' as const, participants: [msg], last: holdingReply }]))
    this.selectedThreadCode.set(g.id)
    this.notifications.update((s) => [{ id: `n${Date.now()}`, time: 'just now', read: false, title: 'Distributor emailed', body: `${g.distributor} was sent a holding reply on ${g.id}.`, href: '/grievances', forRole: g.ownerRole }, ...s])
    this.auditLog.update((s) => [{ id: `a${Date.now()}`, when: auditStamp(), actor: 'You', kind: 'human' as const, action: 'Emailed distributor a holding reply', entity: g.id }, ...s])
    this.syncGrievance(grievancesApi.sendGrievanceUpdate(this.authToken(), id))
  }

  // ---- communication ----

  setSelectedThreadCode(code: string): void {
    this.selectedThreadCode.set(code)
  }

  sendCommMessage(code: string, msg: CaseMessage): void {
    this.commThreads.update((s) => s.map((t) => (t.code === code
      ? { ...t, last: msg.body, participants: [...t.participants.map((m) => ({ ...m, isNextReplier: false })), msg] }
      : t)))
    this.syncThread(communicationApi.postThreadMessage(this.authToken(), code, { authorRole: msg.authorRole, authorName: msg.authorName, body: msg.body }))
  }

  // Opens (or creates) a partner-facing thread and drops in an outbound nudge — usable from
  // any screen that has case/partner context (Approvals, Partners, Distributor profile).
  nudgePartner(input: { code: string; town: string; partnerName: string; reason: string }): void {
    const { code, town, partnerName, reason } = input
    const msg: CaseMessage = { id: `nudge-${Date.now()}`, authorRole: 'ase_asm', authorName: 'You', body: reason }
    const exists = this.commThreads().some((t) => t.code === code)
    this.commThreads.update((s) => (exists
      ? s.map((t) => (t.code === code
          ? { ...t, audience: 'partner' as const, last: reason, participants: [...t.participants, msg] }
          : t))
      : [...s, { code, town, partnerName, audience: 'partner' as const, participants: [msg], last: reason }]))
    this.selectedThreadCode.set(code)
    this.syncThread(communicationApi.nudgeThread(this.authToken(), code, { town, partnerName, reason }))
  }

  // ---- notifications ----

  markNotificationRead(id: string): void {
    this.notifications.update((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)))
    notificationsApi.markNotificationRead(this.authToken(), id).catch(() => { /* backend not running/reachable */ })
  }

  markAllNotificationsRead(): void {
    this.notifications.update((s) => s.map((n) => ({ ...n, read: true })))
    notificationsApi.markAllNotificationsRead(this.authToken()).catch(() => { /* backend not running/reachable */ })
  }

  // No backend "create notification" endpoint exists (by design — notifications are always a
  // side effect the SERVER raises from some other action, never something a client posts
  // directly), so this stays purely local.
  pushNotification(n: { title: string; body: string; href: string; forRole?: RoleCode }): void {
    this.notifications.update((s) => [{ id: `n${Date.now()}`, time: 'just now', read: false, ...n }, ...s])
  }

  // ---- audit trail ----

  logAudit(e: { actor: string; kind: AuditEntry['kind']; action: string; entity: string }): void {
    this.auditLog.update((s) => [{ id: `a${Date.now()}`, when: auditStamp(), ...e }, ...s])
    auditApi.createAuditEntry(this.authToken(), e).catch(() => { /* backend not running/reachable */ })
  }

  // ---- reports ----

  addReport(r: { name: string; format: string }): void {
    this.reports.update((s) => [{ id: `r${Date.now()}`, date: dateStamp(), ...r }, ...s])
    reportsApi.createReport(this.authToken(), r).catch(() => { /* backend not running/reachable */ })
  }

  // ---- case discussion ----

  // open (creating if needed) the internal case-discussion thread and select it
  openCaseDiscussion(input: { code: string; town: string; partnerName: string }): void {
    const { code, town, partnerName } = input
    if (this.commThreads().some((t) => t.code === code)) {
      this.selectedThreadCode.set(code)
      return
    }
    const seed: CaseMessage = { id: `seed-${Date.now()}`, authorRole: 'ase_asm', authorName: 'R. Malhotra', body: `Opened the case thread for ${partnerName}.` }
    this.commThreads.update((s) => [...s, { code, town, partnerName, audience: 'internal' as const, participants: [seed], last: seed.body }])
    this.selectedThreadCode.set(code)
    this.syncThread(communicationApi.ensureThread(this.authToken(), { code, town, partnerName, audience: 'internal' }))
  }

  // a reviewer requests info from the ASM: posts to the case thread, notifies, logs the audit trail
  requestInfoFromAsm(input: { code: string; town: string; partnerName: string; reviewerRole: RoleCode; reviewerName: string; note: string }): void {
    const { code, town, partnerName, reviewerRole, reviewerName, note } = input
    const msg: CaseMessage = { id: `req-${Date.now()}`, authorRole: reviewerRole, authorName: reviewerName, body: note }
    const exists = this.commThreads().some((t) => t.code === code)
    this.commThreads.update((s) => (exists
      ? s.map((t) => (t.code === code
          ? { ...t, audience: 'internal' as const, last: note, participants: [...t.participants.map((m) => ({ ...m, isNextReplier: false })), msg] }
          : t))
      : [...s, { code, town, partnerName, audience: 'internal' as const, participants: [msg], last: note }]))
    this.selectedThreadCode.set(code)
    this.notifications.update((s) => [{ id: `n${Date.now()}`, title: `Info requested on ${code}`, body: `${partnerName} — ${reviewerName} needs more information. Reply in the case thread.`, href: '/communication', time: 'just now', read: false }, ...s])
    this.auditLog.update((s) => [{ id: `a${Date.now()}`, when: auditStamp(), actor: reviewerName, kind: 'human' as const, action: 'Requested info from ASM', entity: code }, ...s])
    this.syncThread(communicationApi.requestInfoOnThread(this.authToken(), code, { town, partnerName, reviewerRole, reviewerName, note }))
  }
}
