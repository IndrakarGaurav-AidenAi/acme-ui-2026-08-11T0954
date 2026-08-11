import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { Router } from '@angular/router'
import { ButtonComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { Profile360Component } from '../components/Profile360'
import type { Profile360Data } from '../components/Profile360'
import { AppStore } from '../store'
import { grievancesFor } from '../mock/grievances'
import type { Grievance } from '../mock/grievances'
import type { MatchedDistributor } from '../mock/leads'
import type { CandidateCard } from '../types'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const num = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0

function toCandidateCard(d: MatchedDistributor & { town: string }): CandidateCard {
  return {
    id: `dist-${slug(d.agency)}`, name: d.agency, town: d.town, dbCategory: d.dbCategory,
    turnoverMonthly: num(d.monthlyTurnover), expectedAcmeTurnover: num(d.acmeTurnover), coverageOutlets: num(d.coverage),
    infraScore: d.headroom === 'high' ? 8 : d.headroom === 'some' ? 6.5 : 5, finEvalPct: num(d.wsContribution) + 50,
    stage: d.status === 'Active' ? 'active' : 'open', confidencePct: d.status === 'Active' ? 88 : 60,
  }
}

const catColor: Record<string, string> = {
  'GT DB (with CSO/DSM)': 'var(--p-ase)', 'GM Excl DB': 'var(--p-mdm)', Traders: 'var(--p-channel)',
}

// Deterministic sales trend seeded by name (no randomness).
function trendFor(name: string): number[] {
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pts: number[] = []; let v = 40
  for (let i = 0; i < 7; i++) { v += ((seed * 5 + i * 13) % 15) - 6; pts.push(Math.max(12, Math.min(90, v))) }
  return pts
}

const headroomText = (h: string) => (h === 'high' ? 'High headroom' : h === 'some' ? 'Some headroom' : 'At capacity')

function toProfile(d: MatchedDistributor & { town?: string }, grievances: Grievance[]): Profile360Data {
  const active = d.status === 'Active'
  const town = d.town ?? 'Maharashtra'
  const email = `${slug(d.agency)}@gmail.com`
  return {
    grievances: grievances.map((g) => ({ id: g.id, subject: g.subject, status: g.status, priority: g.priority, raisedOn: g.raisedOn })),
    name: d.agency,
    color: catColor[d.dbCategory] ?? 'var(--ai)',
    statusBadge: active
      ? { tone: 'good' as Tone, dot: true, label: 'Active' }
      : { tone: 'warn' as Tone, dot: true, label: 'In review' },
    metaChips: [
      { icon: 'partners', text: d.dbCategory },
      { icon: 'target', text: `${town}, Maharashtra` },
      { icon: 'leads', text: headroomText(d.headroom) },
    ],
    contactVerified: active,
    timeline: (active
      ? ['Appointed & auto-cleared', 'Renewal current']
      : ['Application in review', 'Lead Generation Agent · matched to a coverage gap']
    ).reverse().map((t) => ({ title: t, tone: active ? 'good' as const : 'warn' as const })),
    kpis: [
      { label: 'Monthly turnover', value: d.monthlyTurnover, icon: 'analytics', tone: 'ai' },
      { label: 'Acme / month', value: d.acmeTurnover, icon: 'leads', tone: 'ai' },
      { label: 'Coverage', value: d.coverage, icon: 'partners', tone: 'ai' },
      { label: 'WS contribution', value: d.wsContribution, icon: 'flag', tone: active ? 'good' : 'warn' },
    ],
    details: [
      {
        title: 'Business background',
        rows: [
          { label: 'Agency / Firm name', value: d.agency },
          { label: 'DB category', value: d.dbCategory },
          { label: 'Town', value: town },
          { label: 'State', value: 'Maharashtra' },
          { label: 'Status', value: active ? 'Active' : 'In review' },
          { label: 'Capacity headroom', value: headroomText(d.headroom) },
        ],
      },
      {
        title: 'Coverage & turnover',
        rows: [
          { label: 'Total monthly turnover', value: d.monthlyTurnover },
          { label: 'Expected Acme turnover / mo', value: d.acmeTurnover },
          { label: 'Overall coverage', value: d.coverage },
          { label: 'WS contribution', value: d.wsContribution },
        ],
      },
      {
        title: 'Contact & registration',
        rows: [
          { label: 'Email', value: email },
          { label: 'GST', value: active ? 'Verified' : 'Awaiting submission' },
          { label: 'FSSAI', value: active ? 'Verified' : 'Awaiting submission' },
        ],
      },
    ],
    overview: `${d.agency} is ${active ? 'an active' : 'an in-review'} ${d.dbCategory} distributor. ${d.note}`,
    trend: trendFor(d.agency),
    docs: active
      ? [{ name: 'GST Certificate', status: 'verified' }, { name: 'FSSAI License', status: 'verified' }]
      : [{ name: 'GST Certificate', status: 'not_checked' }, { name: 'DB Onboarding Form', status: 'not_checked' }],
    history: active
      ? ['Appointed & auto-cleared', 'Renewal current']
      : ['Application in review'],
    agentLog: [
      'Lead Generation Agent · matched to a coverage/turnover gap',
      active ? 'Evaluation Agent · previously auto-cleared' : 'Evaluation Agent · scored 2 forks',
      'Document Intelligence · ' + (active ? 'GST + FSSAI verified' : 'pending'),
    ],
  }
}

@Component({
  selector: 'app-distributor-profile',
  standalone: true,
  imports: [ButtonComponent, IconComponent, Profile360Component],
  templateUrl: './distributor-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DistributorProfileComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // The distributor handed off from wherever this route was opened (e.g. a lead's matched
  // list) — mirrors the React screen's `useLocation().state` read. Read via
  // getCurrentNavigation()?.extras.state (captured here in the field initializer, which runs
  // during the constructor while the activating navigation is still in flight) rather than
  // history.state, because Angular's Router writes its own bookkeeping fields (navigationId,
  // etc.) into history.state on every navigation — including ones with no explicit
  // NavigationExtras.state — which would make history.state truthy even with no real
  // distributor data and break the "no distributor" empty-state branch below.
  // NOTE for the root-routing-config author: this only sees fresh state on a real navigation
  // to this route. A same-URL, state-only navigation to /distributor (onSameUrlNavigation reuse)
  // will not re-run this field initializer, so this component instance will keep stale data —
  // that reuse behavior must be fixed in the root routing config, not here.
  protected readonly distributor = (this.router.getCurrentNavigation()?.extras.state ?? null) as
    | (MatchedDistributor & { town: string })
    | null

  protected readonly profileData = computed<Profile360Data | null>(() => {
    const d = this.distributor
    return d ? toProfile(d, grievancesFor(d.agency, this.store.grievances())) : null
  })

  protected goToLeads(): void {
    this.router.navigate(['/leads'])
  }

  // Shortlist the distributor for comparison. ASE/ASM doesn't run the New Application wizard —
  // they land back on Leads where the created lead shows; Channel Development goes to the wizard.
  protected onEvaluate(): void {
    const d = this.distributor
    if (!d) return
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    this.store.shortlistCandidate({ ...toCandidateCard(d), userCreated: true, createdBy: viewingAs, createdAt: Date.now() })
    if (viewingAs === 'ase_asm') {
      // Hand-off signal for Trade Marketing (Channel Development)
      this.store.pushNotification({
        title: 'Lead shortlisted — please check',
        body: `${d.agency} (${d.town}) has been shortlisted from the distributor directory. Review and compare it in New Application.`,
        href: '/new-application',
        forRole: 'channel_dev',
      })
    }
    this.router.navigate([viewingAs === 'ase_asm' ? '/leads' : '/new-application'])
  }
}
