import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { Router } from '@angular/router'
import { ButtonComponent, CardComponent, PillComponent, StreamingTextComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { SparklineComponent } from '../components/ui/Sparkline'
import { DASHBOARDS } from '../mock/dashboards'
import { ROLE_BY_CODE, DEMO_USERS } from '../mock/roles'
import { CANDIDATE_STAGES } from '../mock/candidates'
import { AppStore } from '../store'
import { inDataScope, inDataScopeByTown } from '../lib/dataScope'
import type { CandidateCard, RoleCode } from '../types'

// Owner-role personas (Finance/Channel Development/MDM/Leadership) — screen-local to Approvals
// in the React source (imported from './Approvals' there); inlined here since screens no longer
// import one another under the Angular conversion.
const OWNER_ROLES: RoleCode[] = ['finance', 'channel_dev', 'mdm', 'leadership']

const KPI_ICONS: IconName[] = ['leads', 'approvals', 'target', 'clock']
const KPI_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--ai)', 'var(--chart-4)']

// Ambient "agents at work" feed — reinforces that agents are doing the work.
const ACTIVITY: { agent: string; short: string; color: string; action: string; meta: string; time: string; count?: number }[] = [
  { agent: 'Evaluation Agent', short: 'EV', color: 'var(--ai)', action: 'Auto-cleared', meta: 'CMP-2265 · Surat · 95% confidence', time: '2m ago' },
  { agent: 'Routing Agent', short: 'RO', color: 'var(--p-mdm)', action: 'Routed to Finance', meta: 'CMP-2291 · Nashik · SLA started', time: '14m ago' },
  { agent: 'Recommendation Engine', short: 'RE', color: 'var(--p-ase)', action: 'Ranked 3 candidates', meta: 'Nashik territory · picked DB 1', time: '22m ago' },
  { agent: 'Communication Agent', short: 'CO', color: 'var(--p-channel)', action: 'Notified Finance', meta: 'CMP-2288 · awaiting reply', time: '1h ago' },
  { agent: 'Document Intelligence', short: 'DI', color: 'var(--ink-mute)', action: 'Standing by', meta: 'Off by default · enable per case', time: '—' },
]

// "Last updated" per queue case — kept in step with the agent feed timings above.
const CASE_UPDATED: Record<string, string> = {
  'CMP-2265': '2m ago', 'CMP-2291': '14m ago', 'CMP-2288': '35m ago', 'CMP-2280': '1h ago', 'VND-0417': '1d ago',
}

/* ---- live SLA timers ---- */
// Mock cases carry labels like "6h left" — anchor them to page load so they tick for real.
const APP_START = Date.now()
const LEAD_SLA_MS = 48 * 3600e3 // created leads get a 48h review SLA

// Where a lead sits in the onboarding pipeline, at a glance — the linear track a lead moves
// through (rejected is a terminal branch off it, not a step on it).
const LEAD_STAGE_TRACK: CandidateCard['stage'][] = ['open', 'pending', 'approval_1', 'approval_2', 'active']

const CASE_STATUS: Record<string, { label: string; tone: 'good' | 'warn' | 'crit' | 'neutral' }> = {
  auto_cleared: { label: 'Auto-cleared', tone: 'good' },
  flagged: { label: 'Flagged', tone: 'crit' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'crit' },
  draft: { label: 'Draft', tone: 'neutral' },
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonComponent, CardComponent, PillComponent, StreamingTextComponent, IconComponent, SparklineComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Class-field mirrors of module-level data the template reads directly.
  protected readonly KPI_ICONS = KPI_ICONS
  protected readonly KPI_COLORS = KPI_COLORS
  protected readonly LEAD_STAGE_TRACK = LEAD_STAGE_TRACK

  // Live "now" tick, driving every SlaTimer instance's countdown.
  private readonly now = signal(Date.now())
  private intervalId: ReturnType<typeof setInterval> | undefined

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.now.set(Date.now()), 1000)
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined) clearInterval(this.intervalId)
  }

  protected readonly viewingAs = computed<RoleCode>(() => this.store.viewingAs() ?? 'ase_asm')
  protected readonly role = computed(() => ROLE_BY_CODE[this.viewingAs()])
  protected readonly dash = computed(() => DASHBOARDS[this.viewingAs()])

  protected readonly canSeeApprovals = computed(() =>
    (this.store.moduleAccess()[this.viewingAs()] ?? []).includes('/approvals'))

  // Data-level RBAC: a scoped persona (set by the Super Admin in Admin > Data access) only sees
  // cases/leads in their own region/state on the dashboard — if "Dashboard" is checked as one
  // of the screens that scope applies to for this persona.
  private readonly myScope = computed(() => this.store.dataScopeByRole()[this.viewingAs()])
  private readonly myRegion = computed(() => DEMO_USERS[this.viewingAs()]?.region)
  private readonly myState = computed(() => DEMO_USERS[this.viewingAs()]?.state)
  private readonly scopesDashboard = computed(() =>
    (this.store.dataEntitiesByRole()[this.viewingAs()] ?? []).includes('dashboard'))
  private readonly isRegionScoped = computed(() => this.myScope() !== 'all' && this.scopesDashboard())

  // Owner-role personas (Finance/Channel Development/MDM) only see cases actually theirs to
  // act on — e.g. MDM shouldn't see Finance's still-open flagged cases on their dashboard,
  // mirroring how Approvals itself scopes the queue. Other personas keep the full portfolio view.
  private readonly ownerScoped = computed(() => {
    const viewingAs = this.viewingAs()
    const allCases = this.store.flaggedCases()
    return OWNER_ROLES.includes(viewingAs) ? allCases.filter((c) => c.ownerRole === viewingAs) : allCases
  })

  // Same queue Approvals reads — includes cases the New Application wizard raises live, not
  // just the seeded demo set.
  protected readonly recentCases = computed(() => {
    const scoped = this.ownerScoped()
    return this.isRegionScoped()
      ? scoped.filter((c) => inDataScope(c.state, this.myScope(), this.myRegion(), this.myState()))
      : scoped
  })

  // Prospecting leads aren't Finance's, MDM's, or Leadership's concern per the documented
  // process (they only see a case once it's flagged to them, same as Finance/MDM) — Channel
  // Development still needs the shortlist. Leadership also has no /leads module access, so
  // showing this row's "View lead" button (which navigates there) just bounced them straight
  // back to the dashboard.
  protected readonly showLeadRows = computed(() => {
    const viewingAs = this.viewingAs()
    return viewingAs !== 'finance' && viewingAs !== 'mdm' && viewingAs !== 'leadership'
  })

  private readonly ownLeads = computed(() => {
    const viewingAs = this.viewingAs()
    return this.store.candidates().filter((c) => c.userCreated && (viewingAs !== 'ase_asm' || c.createdBy === viewingAs))
  })

  protected readonly myLeads = computed(() => {
    const leads = this.ownLeads()
    return this.isRegionScoped()
      ? leads.filter((c) => inDataScopeByTown(c.town, this.myScope(), this.myRegion(), this.myState()))
      : leads
  })

  // Which agent currently "has" each created lead — derived from its pipeline stage,
  // so the Agents-at-work feed names the actual leads in flight.
  private agentForLead(l: CandidateCard): { agent: string; short: string; color: string; action: string } {
    if (l.stage === 'approval_1') return { agent: 'Routing Agent', short: 'RO', color: 'var(--p-mdm)', action: 'Routed to Finance review' }
    if (l.stage === 'approval_2') return { agent: 'Routing Agent', short: 'RO', color: 'var(--p-mdm)', action: 'Routed to Channel review' }
    if (l.stage === 'active') return { agent: 'Evaluation Agent', short: 'EV', color: 'var(--ai)', action: 'Cleared — partner onboarded' }
    if (this.store.evalIds().includes(l.id)) return { agent: 'Evaluation Agent', short: 'EV', color: 'var(--ai)', action: 'Scoring in shortlist comparison' }
    return { agent: 'Intake Agent', short: 'IN', color: 'var(--p-ase)', action: 'Lead created from intake' }
  }

  // One feed row per agent+activity, carrying how many leads that agent is on right now.
  protected readonly feedItems = computed(() => {
    const grouped = new Map<string, { agent: string; short: string; color: string; action: string; leads: CandidateCard[] }>()
    for (const l of this.myLeads()) {
      const a = this.agentForLead(l)
      const key = a.agent + ' — ' + a.action
      const g = grouped.get(key) ?? { ...a, leads: [] }
      g.leads.push(l)
      grouped.set(key, g)
    }
    const leadActivity = [...grouped.values()].map((g) => ({
      agent: g.agent, short: g.short, color: g.color, action: g.action,
      count: g.leads.length as number | undefined,
      meta: g.leads.map((l) => l.name + ' (' + l.confidencePct + '%)').join(', '),
      time: 'now',
    }))
    return [...leadActivity, ...ACTIVITY].slice(0, 7)
  })

  protected exportView(): void {
    this.store.addReport({ name: this.role().label + ' dashboard snapshot', format: 'PDF' })
    this.store.logAudit({ actor: 'You', kind: 'human', action: 'Exported dashboard snapshot to Reports', entity: 'Dashboard' })
    this.router.navigate(['/reports'])
  }

  protected createLead(): void {
    this.router.navigate(['/intake-inbox'], { state: { openCreateLead: true } })
  }

  protected viewLead(): void {
    this.router.navigate(['/leads'])
  }

  protected viewCase(): void {
    this.router.navigate(['/approvals'])
  }

  protected goUpNext(): void {
    this.router.navigate([this.dash().upNext.route])
  }

  protected goQuickAction(route: string): void {
    this.router.navigate([route])
  }

  // Deterministic mini-trend for a KPI tile (no randomness — seeded by label).
  protected trendFor(label: string): number[] {
    const seed = label.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const pts: number[] = []
    let v = 45
    for (let i = 0; i < 7; i++) { v += ((seed * 7 + i * 17) % 13) - 5; pts.push(Math.max(12, Math.min(88, v))) }
    return pts
  }

  private slaDeadline(label: string): number | null {
    if (label === 'Overdue') return APP_START - (2 * 3600 + 13 * 60 + 40) * 1000 // counts up from ~2h14m over
    const m = label.match(/^(\d+)([hd]) left$/)
    if (!m) return null
    return APP_START + +m[1] * (m[2] === 'h' ? 3600e3 : 86400e3)
  }

  protected caseDeadline(slaLabel: string): number | null {
    return this.slaDeadline(slaLabel)
  }

  protected leadDeadline(l: CandidateCard): number {
    return (l.createdAt ?? APP_START) + LEAD_SLA_MS
  }

  protected slaTimerText(deadline: number): string {
    const diff = deadline - this.now()
    const over = diff < 0
    const s = Math.floor(Math.abs(diff) / 1000)
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    const txt = h > 0 ? h + 'h ' + m + 'm ' + sec + 's' : m + 'm ' + sec + 's'
    return over ? txt + ' over' : txt + ' left'
  }

  protected slaTimerTone(deadline: number): 'good' | 'warn' | 'crit' {
    const diff = deadline - this.now()
    if (diff < 0) return 'crit'
    return diff < 12 * 3600e3 ? 'warn' : 'good'
  }

  protected leadInitials(name: string): string {
    return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase()
  }

  protected stageLabel(stage: CandidateCard['stage']): string {
    return CANDIDATE_STAGES.find((s) => s.id === stage)?.label ?? stage
  }

  protected leadProgressLabel(stage: CandidateCard['stage']): string {
    return CANDIDATE_STAGES.find((s) => s.id === stage)?.label ?? stage
  }

  protected leadProgressIdx(stage: CandidateCard['stage']): number {
    return LEAD_STAGE_TRACK.indexOf(stage)
  }

  protected caseStatus(status: string): { label: string; tone: 'good' | 'warn' | 'crit' | 'neutral' } {
    return CASE_STATUS[status]
  }

  protected linkedCandidate(candidateId: string | undefined): CandidateCard | undefined {
    return this.store.candidates().find((cand) => cand.id === candidateId)
  }

  protected caseUpdated(code: string): string {
    return CASE_UPDATED[code] ?? '—'
  }

  protected confBarColor(pct: number): string {
    return pct >= 85 ? 'var(--good)' : pct >= 50 ? 'var(--warn)' : 'var(--crit)'
  }

  protected asIconName(name: string): IconName {
    return name as IconName
  }
}
