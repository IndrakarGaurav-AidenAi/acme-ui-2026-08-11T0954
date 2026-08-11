import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, signal, untracked, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { SparklineComponent } from '../components/ui/Sparkline'
import { AppStore } from '../store'
import {
  DB_PERFORMANCE, DB_GAP_CATEGORIES, TREND, RISK_TREND, REGION_PERFORMANCE,
  dbAttainment, dbCoverage, dbGaps, dbStatus,
} from '../mock/analytics'
import type { BarDatum, DbPerf, DbStatus } from '../mock/analytics'
import type { Grievance } from '../mock/grievances'
import {
  FUNNEL_STAGES, LEAD_TO_ONBOARD_CONVERSION_PCT, TAT_TREND_HOURS, AVG_TAT_HOURS, TAT_TARGET_HOURS,
  APP_DOWNLOAD_TO_REGISTRATION_PCT, FTR_TREND_PCT, FTR_RATE_PCT, KYC_REJECTION_REASONS, KYC_REJECTION_RATE_PCT,
  CREDIT_ELIGIBILITY_PASS_PCT, FTB_TREND_PCT, FTB_RATE_PCT, FTL_TICKET_TREND_INR_L, AVG_FTL_TICKET_INR_L,
  STAGNANT_AT_BIRTH_TREND_PCT, STAGNANT_AT_BIRTH_PCT, WHITE_SPACE_CONVERSIONS, WHITE_SPACE_TOTAL,
  CATEGORY_REPRESENTATION, FIELD_EXECUTIVES, AVG_ONBOARDINGS_PER_FOS_PER_DAY, AVG_CAC_INR, CAC_TREND_INR,
} from '../mock/onboardingEfficiency'
import { GTM_STATES, SVG_ID, REGION_OF, stateCodeForTown } from '../mock/gtm'
import type { GtmRegion } from '../mock/gtm'
import { DEMO_USERS } from '../mock/roles'
import { inDataScope, inDataScopeByTown } from '../lib/dataScope'
import { tenureYears, tenureBucket } from '../lib/dates'
import type { AnalyticsSection, Partner } from '../types'
import INDIA_MAP from '@svg-maps/india'

/* ==================================================================
   Module-level constants / pure helpers — mirror the same-named
   top-level consts/functions in Analytics.tsx, verbatim.
   ================================================================== */
const TONE_VAR: Record<string, string> = { ai: '--ai', good: '--good', warn: '--warn', crit: '--crit', blue: '--chart-5' }

type OverviewKpiKey = 'on_track' | 'attainment' | 'coverage' | 'low_fill' | 'tenure'
const OVERVIEW_KPI_TITLE: Record<OverviewKpiKey, string> = {
  on_track: 'Distributors on track', attainment: 'Target attainment by distributor',
  coverage: 'Coverage by distributor', low_fill: 'Distributors with low fill rate',
  tenure: 'Partner tenure by distributor',
}

interface KpiSub { text: string; cls?: string }

// How many of `list` were still active as of `cutoff` (epoch ms) — onboarded on/before that
// date, and not yet discontinued by it.
function partnersActiveAsOf(list: Partner[], cutoff: number): number {
  return list.filter((p) => {
    const onboarded = new Date(p.onboardedAt as string).getTime()
    if (Number.isNaN(onboarded) || onboarded > cutoff) return false
    if (p.discontinuedAt && new Date(p.discontinuedAt).getTime() <= cutoff) return false
    return true
  }).length
}

// Signed delta → an honest "▲/▼ N{unit} vs last month" pill, or a flat dash when there's
// literally no change — never a fabricated number.
function deltaNote(delta: number, unit: string, goodIfUp = true): KpiSub {
  if (delta === 0) return { text: '— vs last month', cls: 'an2-delta-flat' }
  const up = delta > 0
  const good = goodIfUp ? up : !up
  return { text: (up ? '▲' : '▼') + ' ' + Math.abs(delta) + unit + ' vs last month', cls: good ? 'an2-delta-good' : 'an2-delta-bad' }
}

const COMPARE_METRICS: { key: string; label: string; unit: string; get: (d: DbPerf) => number; higherIsBetter: boolean }[] = [
  { key: 'attainment', label: 'Target attainment', unit: '%', get: dbAttainment, higherIsBetter: true },
  { key: 'coverage', label: 'Coverage', unit: '%', get: dbCoverage, higherIsBetter: true },
  { key: 'turnover', label: 'Acme turnover', unit: '₹L', get: (d) => d.acmeTurnover, higherIsBetter: true },
  { key: 'outlets', label: 'Outlets served', unit: '', get: (d) => d.outlets, higherIsBetter: true },
  { key: 'growth', label: 'Growth MoM', unit: '%', get: (d) => d.growthMoM, higherIsBetter: true },
  { key: 'fillRate', label: 'Fill rate', unit: '%', get: (d) => d.fillRate, higherIsBetter: true },
  { key: 'wsContribution', label: 'Acme share of business', unit: '%', get: (d) => d.wsContribution, higherIsBetter: true },
  { key: 'tenure', label: 'Partner tenure', unit: ' yrs', get: (d) => +tenureYears(d.onboardedAt).toFixed(1), higherIsBetter: true },
]

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

const PRIORITY_WEIGHT: Record<Grievance['priority'], number> = { high: 2, medium: 1, low: 0 }
const PRIORITY_TONE: Record<Grievance['priority'], 'crit' | 'warn' | 'good'> = { high: 'crit', medium: 'warn', low: 'good' }

// The recurring gap types across the (filtered) book — "Where distributors are lacking".
function gapFreq(dbs: DbPerf[]): BarDatum[] {
  const n = dbs.length || 1
  return DB_GAP_CATEGORIES.map((c) => {
    const v = dbs.filter(c.test).length
    return { label: c.label, value: v, sub: Math.round((v / n) * 100) + '% of DBs' }
  }).sort((a, b) => b.value - a.value)
}
// Worst-first — the specific DBs a user should look at, for "Which DB is lacking".
function needsAttentionList(dbs: DbPerf[]): DbPerf[] {
  return [...dbs].filter((d) => dbStatus(d) !== 'on_track')
    .sort((a, b) => dbAttainment(a) + dbCoverage(a) - (dbAttainment(b) + dbCoverage(b)))
}

// Turnover vs Target — single-axis combo bar path with rounded top corners.
function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return 'M' + x + ',' + (y + h) + ' L' + x + ',' + (y + rr) + ' Q' + x + ',' + y + ' ' + (x + rr) + ',' + y
    + ' L' + (x + w - rr) + ',' + y + ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + rr)
    + ' L' + (x + w) + ',' + (y + h) + ' Z'
}

type MoverLens = 'attainment' | 'turnover'
const MOVER_LENSES: { key: MoverLens; label: string }[] = [
  { key: 'attainment', label: 'Attainment' },
  { key: 'turnover', label: 'Turnover' },
]
interface MoverRow { d: DbPerf; current: number; change: number; unit: string; barPct: number; max: number }
// Per-DB movement, straight off the 6-month turnover trend so the change is real, not fabricated.
function moverFor(d: DbPerf, lens: MoverLens): { current: number; change: number; unit: string; barPct: number; max: number } {
  const last = d.trend[d.trend.length - 1] ?? 0
  const prev = d.trend[d.trend.length - 2] ?? last
  if (lens === 'attainment') {
    const change = d.acmeTarget ? Math.round(((last - prev) / d.acmeTarget) * 100) : 0
    return { current: dbAttainment(d), change, unit: 'pp', barPct: Math.min(100, dbAttainment(d)), max: 100 }
  }
  return { current: d.acmeTurnover, change: Math.round((last - prev) * 10) / 10, unit: '₹L', barPct: 0, max: 0 }
}

type HeatDim = 'region' | 'state' | 'town' | 'category'
const HEAT_DIMS: { key: HeatDim; label: string; head: string }[] = [
  { key: 'region', label: 'By region', head: 'Region' },
  { key: 'state', label: 'By state', head: 'State' },
  { key: 'town', label: 'By town', head: 'Town' },
  { key: 'category', label: 'By category', head: 'Category' },
]
const STATE_NAME: Record<string, string> = Object.fromEntries(GTM_STATES.map((s) => [s.code, s.name]))
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(GTM_STATES.map((s) => [s.name, s.code]))
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)

interface HeatMetric { key: string; label: string; get: (r: DbPerf[]) => number; fmt: (v: number) => string; goodHigh: boolean; hi: number; lo: number }
const HEAT_METRICS: HeatMetric[] = [
  { key: 'cov', label: 'Coverage', get: (r) => avg(r.map(dbCoverage)), fmt: (v) => Math.round(v) + '%', goodHigh: true, hi: 90, lo: 70 },
  { key: 'fill', label: 'Fill rate', get: (r) => avg(r.map((d) => d.fillRate)), fmt: (v) => Math.round(v) + '%', goodHigh: true, hi: 92, lo: 85 },
  { key: 'attn', label: 'Attainment', get: (r) => avg(r.map(dbAttainment)), fmt: (v) => Math.round(v) + '%', goodHigh: true, hi: 100, lo: 85 },
  { key: 'growth', label: 'Growth MoM', get: (r) => avg(r.map((d) => d.growthMoM)), fmt: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%', goodHigh: true, hi: 3, lo: 0 },
  { key: 'risk', label: 'At risk', get: (r) => (r.filter((d) => dbStatus(d) === 'at_risk').length / (r.length || 1)) * 100, fmt: (v) => Math.round(v) + '%', goodHigh: false, hi: 0, lo: 25 },
]

function heatCell(value: number, m: HeatMetric): { bg: string; fg: string } {
  const tier: 'good' | 'warn' | 'crit' = m.goodHigh
    ? (value >= m.hi ? 'good' : value >= m.lo ? 'warn' : 'crit')
    : (value <= m.hi ? 'good' : value <= m.lo ? 'warn' : 'crit')
  const VARS = { good: ['--good', '--good-text'], warn: ['--warn', '--warn-text'], crit: ['--crit', '--crit-text'] } as const
  const [c, t] = VARS[tier]
  return { bg: 'color-mix(in srgb, var(' + c + ') 18%, transparent)', fg: 'var(' + t + ')' }
}

interface HeatGroup { label: string; rows?: DbPerf[]; vals?: Record<string, number>; count: number; nav: () => void }

const GH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GH_WD = ['', 'Mon', '', 'Wed', '', 'Fri', '']
interface HeatmapDay { date: Date; count: number }

type ChartRange = '3M' | '6M'

interface InsightRow { name: string; sub: string; onClick: () => void }
interface InsightBullet { icon: IconName; tone: 'good' | 'warn' | 'crit' | 'ai'; text: string; rows?: InsightRow[] }
interface Rec { headline: string; action: string; route: string; query?: string; impact: string }

const TENURE_BUCKETS = ['<1yr', '1-3yr', '3-5yr', '5yr+'] as const
type TenureBucketKey = (typeof TENURE_BUCKETS)[number]

interface AlertRow { icon: IconName; tone: 'crit' | 'warn' | 'good'; tag: string; label: string; sub: string; onClick: () => void }
const ALERT_TAG_TONE: Record<string, 'crit' | 'warn' | 'good'> = { High: 'crit', Medium: 'warn', Low: 'good' }

const REGION_TIER = (pct: number) => (pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'crit')
const REGION_COLOR: Record<string, string> = { good: 'var(--good)', warn: '#e0972a', crit: 'var(--crit)' }

const DB_STATUSES: DbStatus[] = ['on_track', 'watch', 'at_risk']
const STATUS_DOT: Record<DbStatus, string> = { on_track: 'var(--good)', watch: 'var(--warn)', at_risk: 'var(--crit)' }
const STATUS_LABEL: Record<DbStatus, string> = { on_track: 'On track', watch: 'Watch', at_risk: 'At risk' }
const STATUS_META: Record<DbStatus, { label: string; tone: 'good' | 'warn' | 'crit' }> = {
  on_track: { label: 'On track', tone: 'good' },
  watch: { label: 'Watch', tone: 'warn' },
  at_risk: { label: 'At risk', tone: 'crit' },
}

interface RankedRegion { name: GtmRegion; pct: number; actual: number; target: number }
interface FunnelRow { stage: string; count: number; pct: number; dropFromPrev: number | null }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [FormsModule, ButtonComponent, CardComponent, ModalComponent, PillComponent, IconComponent, SparklineComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Module-level data/functions the template reads directly.
  protected readonly OVERVIEW_KPI_TITLE = OVERVIEW_KPI_TITLE
  protected readonly COMPARE_METRICS = COMPARE_METRICS
  protected readonly initials = initials
  protected readonly MOVER_LENSES = MOVER_LENSES
  protected readonly HEAT_DIMS = HEAT_DIMS
  protected readonly GH_WD = GH_WD
  protected readonly TENURE_BUCKETS = TENURE_BUCKETS
  protected readonly STATUS_META = STATUS_META
  protected readonly DB_STATUSES = DB_STATUSES
  protected readonly STATUS_DOT = STATUS_DOT
  protected readonly STATUS_LABEL = STATUS_LABEL
  protected readonly FUNNEL_STAGES = FUNNEL_STAGES
  protected readonly LEAD_TO_ONBOARD_CONVERSION_PCT = LEAD_TO_ONBOARD_CONVERSION_PCT
  protected readonly TAT_TREND_HOURS = TAT_TREND_HOURS
  protected readonly AVG_TAT_HOURS = AVG_TAT_HOURS
  protected readonly TAT_TARGET_HOURS = TAT_TARGET_HOURS
  protected readonly APP_DOWNLOAD_TO_REGISTRATION_PCT = APP_DOWNLOAD_TO_REGISTRATION_PCT
  protected readonly FTR_TREND_PCT = FTR_TREND_PCT
  protected readonly FTR_RATE_PCT = FTR_RATE_PCT
  protected readonly KYC_REJECTION_REASONS = KYC_REJECTION_REASONS
  protected readonly KYC_REJECTION_RATE_PCT = KYC_REJECTION_RATE_PCT
  protected readonly CREDIT_ELIGIBILITY_PASS_PCT = CREDIT_ELIGIBILITY_PASS_PCT
  protected readonly FTB_TREND_PCT = FTB_TREND_PCT
  protected readonly FTB_RATE_PCT = FTB_RATE_PCT
  protected readonly FTL_TICKET_TREND_INR_L = FTL_TICKET_TREND_INR_L
  protected readonly AVG_FTL_TICKET_INR_L = AVG_FTL_TICKET_INR_L
  protected readonly STAGNANT_AT_BIRTH_TREND_PCT = STAGNANT_AT_BIRTH_TREND_PCT
  protected readonly STAGNANT_AT_BIRTH_PCT = STAGNANT_AT_BIRTH_PCT
  protected readonly WHITE_SPACE_CONVERSIONS = WHITE_SPACE_CONVERSIONS
  protected readonly WHITE_SPACE_TOTAL = WHITE_SPACE_TOTAL
  protected readonly CATEGORY_REPRESENTATION = CATEGORY_REPRESENTATION
  protected readonly AVG_ONBOARDINGS_PER_FOS_PER_DAY = AVG_ONBOARDINGS_PER_FOS_PER_DAY
  protected readonly AVG_CAC_INR = AVG_CAC_INR
  protected readonly CAC_TREND_INR = CAC_TREND_INR
  protected readonly sortedFieldExecutives = [...FIELD_EXECUTIVES].sort((a, b) => b.onboardingsPerDay - a.onboardingsPerDay)
  protected readonly indiaMap = INDIA_MAP as unknown as { viewBox: string; locations: { id: string; name: string; path: string }[] }
  protected readonly svgIdToCode: Record<string, string> = Object.fromEntries(Object.entries(SVG_ID).map(([code, id]) => [id, code]))
  protected readonly REGION_TIER = REGION_TIER
  protected readonly REGION_COLOR = REGION_COLOR

  /* ---------------- top-level controls ---------------- */
  protected readonly category = signal('all')
  protected readonly status = signal<'all' | DbStatus>('all')
  protected readonly filtersOpen = signal(false)
  protected readonly rangePreset = signal<'this_month' | 'last_30' | 'last_quarter'>('this_month')
  protected readonly rangeOpen = signal(false)
  protected readonly tab = signal<'overview' | 'detail' | 'efficiency'>('overview')

  protected readonly filtersWrapRef = viewChild<ElementRef<HTMLDivElement>>('filtersWrap')
  protected readonly rangeWrapRef = viewChild<ElementRef<HTMLDivElement>>('rangeWrap')

  protected readonly RANGE_PRESETS: ('this_month' | 'last_30' | 'last_quarter')[] = ['this_month', 'last_30', 'last_quarter']
  protected readonly RANGE_LABEL: Record<'this_month' | 'last_30' | 'last_quarter', string> = {
    this_month: 'This month', last_30: 'Last 30 days', last_quarter: 'Last quarter',
  }

  // Time-of-day greeting for the current persona — first name where the demo user record has a
  // full one, otherwise the display name as stored.
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours()
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  })
  protected readonly greetName = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    const fullName = DEMO_USERS[viewingAs]?.name ?? 'there'
    const firstToken = fullName.split(/\s+/)[0]
    return firstToken.replace(/\.$/, '').length > 1 ? firstToken : fullName
  })

  // Which of Analytics' 3 tabs the Super Admin has left visible for this persona.
  protected readonly visibleSections = computed<AnalyticsSection[]>(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return this.store.analyticsSectionsByRole()[viewingAs] ?? ['overview', 'detail', 'efficiency']
  })

  // Data-level RBAC: a scoped persona only sees DB performance rows in their own region/state
  // here, if "Analytics" is checked as one of the screens that scope applies to for this persona.
  private readonly myScope = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return this.store.dataScopeByRole()[viewingAs]
  })
  private readonly myRegion = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return DEMO_USERS[viewingAs]?.region
  })
  private readonly myState = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return DEMO_USERS[viewingAs]?.state
  })
  private readonly scopesAnalytics = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return (this.store.dataEntitiesByRole()[viewingAs] ?? []).includes('analytics')
  })
  protected readonly isRegionScoped = computed(() => this.myScope() !== 'all' && this.scopesAnalytics())
  protected readonly scopedPerformance = computed(() => this.isRegionScoped()
    ? DB_PERFORMANCE.filter((d) => inDataScopeByTown(d.town, this.myScope(), this.myRegion(), this.myState()))
    : DB_PERFORMANCE)

  // Headline "Active Distributors" — the live Partners directory, scoped to the same GTM codes
  // that are actually in scope for this persona.
  protected readonly scopedGtmCodes = computed(() => {
    const withData = GTM_STATES.filter((s) => s.target != null && s.actual != null)
    const scoped = this.isRegionScoped() ? withData.filter((s) => inDataScope(s.code, this.myScope(), this.myRegion(), this.myState())) : withData
    return new Set(scoped.map((s) => s.code))
  })
  protected readonly activeDistributorPartners = computed(() => {
    const codes = this.scopedGtmCodes()
    return this.store.partners().filter((p) => p.partnerType === 'distributor' && p.status !== 'discontinued' && codes.has(p.state))
  })
  // Same distributor set, but every one (including discontinued) that carries a real
  // onboardedAt/discontinuedAt date — lets the KPI tile's trend/delta be reconstructed from
  // actual onboarding history instead of a decorative fabricated curve.
  protected readonly distributorPartnersForTrend = computed(() => {
    const codes = this.scopedGtmCodes()
    return this.store.partners().filter((p) => p.partnerType === 'distributor' && codes.has(p.state) && !!p.onboardedAt)
  })

  protected readonly categories = computed(() => Array.from(new Set(this.scopedPerformance().map((d) => d.category))))
  protected readonly dbs = computed(() => this.scopedPerformance().filter((d) =>
    (this.category() === 'all' || d.category === this.category()) && (this.status() === 'all' || dbStatus(d) === this.status())))
  protected readonly activeFilterCount = computed(() => (this.category() !== 'all' ? 1 : 0) + (this.status() !== 'all' ? 1 : 0))
  protected resetFilters(): void { this.category.set('all'); this.status.set('all') }
  protected setCategory(v: string): void { this.category.set(v) }
  protected setStatus(v: string): void { this.status.set(v as 'all' | DbStatus) }

  constructor() {
    // Hide the rest and fall back off a now-hidden current tab — mirrors the source's
    // `[visibleSections.join(',')]` effect dependency array (tab itself read untracked).
    effect(() => {
      const visible = this.visibleSections()
      untracked(() => {
        if (!visible.includes(this.tab()) && visible.length > 0) this.tab.set(visible[0])
      })
    })

    // Compare Distributors' A/B pickers — reset off a now-invalid selection when the sorted
    // (filtered) list changes, mirrors the source's `[sorted.map(id).join(',')]` effect.
    effect(() => {
      const sorted = this.cmpSorted()
      untracked(() => {
        if (!sorted.some((d) => d.id === this.cmpAId())) this.cmpAId.set(sorted[0]?.id ?? '')
        if (!sorted.some((d) => d.id === this.cmpBId())) this.cmpBId.set(sorted[1]?.id ?? sorted[0]?.id ?? '')
      })
    })
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocumentMouseDown(e: MouseEvent): void {
    const target = e.target as Node
    if (this.filtersOpen() && !this.filtersWrapRef()?.nativeElement.contains(target)) this.filtersOpen.set(false)
    if (this.rangeOpen() && !this.rangeWrapRef()?.nativeElement.contains(target)) this.rangeOpen.set(false)
  }

  protected exportView(): void {
    this.store.addReport({ name: 'Analytics export — distributor performance', format: 'PDF' })
    this.store.logAudit({ actor: 'You', kind: 'human', action: 'Exported analytics view to Reports', entity: 'Analytics' })
    this.router.navigate(['/reports'])
  }

  // Formatted like a date-range picker's display label — start date depends on the chosen preset.
  protected readonly dateRangeLabel = computed(() => {
    const now = new Date()
    const preset = this.rangePreset()
    const start = preset === 'this_month' ? new Date(now.getFullYear(), now.getMonth(), 1)
      : preset === 'last_30' ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    return fmt(start) + ' – ' + fmt(now)
  })

  /* ==================================================================
     Overview — KPI tiles + the six new charts
     ================================================================== */
  protected readonly breakdown = signal<OverviewKpiKey | null>(null)
  protected readonly showActivePartners = signal(false)

  protected readonly dbsN = computed(() => this.dbs().length || 1)
  protected readonly statusCounts = computed(() => this.dbs().reduce((a, d) => { a[dbStatus(d)]++; return a }, { on_track: 0, watch: 0, at_risk: 0 } as Record<DbStatus, number>))
  protected readonly avgCoverage = computed(() => Math.round(this.dbs().reduce((s, d) => s + dbCoverage(d), 0) / this.dbsN()))
  protected readonly lowFillCount = computed(() => this.dbs().filter((d) => d.fillRate < 90).length)
  protected readonly avgTenureYrs = computed(() => this.dbs().reduce((s, d) => s + tenureYears(d.onboardedAt), 0) / this.dbsN())
  protected readonly coverageAboveN = computed(() => this.dbs().filter((d) => dbCoverage(d) >= 85).length)

  protected pctOf(n: number, total: number): number { return Math.round((n / (total || 1)) * 100) }

  // Real 6-month history of "Active Distributors".
  protected readonly activeTrend = computed(() => {
    const now = new Date()
    const forTrend = this.distributorPartnersForTrend()
    const pts = Array.from({ length: 5 }, (_, i) => {
      const monthsBack = 5 - i
      const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59).getTime()
      return partnersActiveAsOf(forTrend, cutoff)
    })
    pts.push(this.activeDistributorPartners().length)
    return pts
  })
  protected readonly activeDelta = computed(() => {
    const t = this.activeTrend()
    return t[3] ? Math.round(((t[4] - t[3]) / t[3]) * 100) : 0
  })
  protected readonly activeSub = computed<KpiSub>(() => deltaNote(this.activeDelta(), '%'))

  // Real "Avg Target Attainment" history — sum(turnover)/sum(target), respects active filters.
  protected readonly targetTotal = computed(() => this.dbs().reduce((s, d) => s + d.acmeTarget, 0))
  protected readonly turnoverTotal = computed(() => this.dbs().reduce((s, d) => s + d.acmeTurnover, 0))
  protected readonly attainTrend = computed(() => {
    const dbs = this.dbs()
    const targetTotal = this.targetTotal()
    if (!targetTotal) return TREND.map(() => 0)
    return TREND.map((_, i) => Math.round((dbs.reduce((s, d) => s + (d.trend[i] ?? 0), 0) / targetTotal) * 100))
  })
  protected readonly avgAttain = computed(() => this.attainTrend()[this.attainTrend().length - 1] ?? 0)
  protected readonly attainDelta = computed(() => {
    const t = this.attainTrend()
    return t.length >= 2 ? t[t.length - 1] - t[t.length - 2] : 0
  })
  protected readonly attainSub = computed<KpiSub>(() => deltaNote(this.attainDelta(), 'pp'))

  // "On Track" history only exists for the full, unfiltered book.
  protected readonly isFullBook = computed(() => this.dbs().length === DB_PERFORMANCE.length)
  protected readonly onTrackTrend = computed<number[] | undefined>(() =>
    this.isFullBook() ? RISK_TREND.map((r) => DB_PERFORMANCE.length - r.atRisk - r.watch) : undefined)
  protected readonly onTrackDelta = computed<number | undefined>(() => {
    const t = this.onTrackTrend()
    return t && t.length >= 2 ? t[t.length - 1] - t[t.length - 2] : undefined
  })
  protected readonly onTrackSub = computed<KpiSub>(() => {
    const d = this.onTrackDelta()
    return d !== undefined ? deltaNote(d, '') : { text: this.pctOf(this.statusCounts().on_track, this.dbsN()) + '% of active' }
  })

  // What each KPI tile actually rolls up.
  protected breakdownRows(key: OverviewKpiKey | null): { d: DbPerf; metric: string }[] {
    const dbs = this.dbs()
    if (key === 'on_track') return dbs.filter((d) => dbStatus(d) === 'on_track').map((d) => ({ d, metric: dbAttainment(d) + '% attainment' }))
    if (key === 'attainment') return [...dbs].sort((a, b) => dbAttainment(b) - dbAttainment(a)).map((d) => ({ d, metric: dbAttainment(d) + '%' }))
    if (key === 'coverage') return [...dbs].sort((a, b) => dbCoverage(b) - dbCoverage(a)).map((d) => ({ d, metric: dbCoverage(d) + '%' }))
    if (key === 'low_fill') return dbs.filter((d) => d.fillRate < 90).sort((a, b) => a.fillRate - b.fillRate).map((d) => ({ d, metric: d.fillRate + '% fill rate' }))
    if (key === 'tenure') return [...dbs].sort((a, b) => tenureYears(b.onboardedAt) - tenureYears(a.onboardedAt)).map((d) => ({ d, metric: tenureYears(d.onboardedAt).toFixed(1) + ' yrs' }))
    return []
  }
  protected navToDbBreakdown(d: DbPerf): void {
    this.router.navigate(['/partners'], { state: { query: d.name } })
    this.breakdown.set(null)
  }
  protected navToActivePartner(p: Partner): void {
    this.router.navigate(['/partners'], { state: { query: p.legalName } })
    this.showActivePartners.set(false)
  }

  protected readonly gapFreqRows = computed(() => gapFreq(this.dbs()))
  protected readonly needsAttentionRows = computed(() => needsAttentionList(this.dbs()).slice(0, 5))
  protected dbGaps(d: DbPerf): string[] { return dbGaps(d) }
  protected dbAttainment(d: DbPerf): number { return dbAttainment(d) }
  protected dbCoverage(d: DbPerf): number { return dbCoverage(d) }
  protected dbStatus(d: DbPerf): DbStatus { return dbStatus(d) }
  protected sparkColor(tone: string): string { return 'var(' + (TONE_VAR[tone] ?? '--ai') + ')' }
  protected navigatePartners(): void { this.router.navigate(['/partners']) }
  protected navigateGrievances(): void { this.router.navigate(['/grievances']) }

  /* ==================================================================
     Distributor Detail tab
     ================================================================== */
  protected readonly detailAvgAttain = computed(() => Math.round(this.dbs().reduce((s, d) => s + dbAttainment(d), 0) / this.dbsN()))
  protected readonly detailLatestTurnover = computed(() => this.dbs().reduce((s, d) => s + (d.trend[d.trend.length - 1] ?? 0), 0))
  protected readonly openGrievancesCount = computed(() => this.store.grievances().filter((g) => g.status !== 'resolved').length)
  protected readonly overdueGrievancesCount = computed(() => this.store.grievances().filter((g) => g.isOverdue).length)

  /* ---------------- Compare Distributors ---------------- */
  protected readonly cmpFilterCategory = signal('all')
  protected readonly cmpFilterStatus = signal<'all' | DbStatus>('all')
  protected readonly cmpAId = signal('')
  protected readonly cmpBId = signal('')

  protected readonly cmpCategories = computed(() => Array.from(new Set(this.dbs().map((d) => d.category))))
  protected readonly cmpSorted = computed(() => [...this.dbs()]
    .filter((d) => this.cmpFilterCategory() === 'all' || d.category === this.cmpFilterCategory())
    .filter((d) => this.cmpFilterStatus() === 'all' || dbStatus(d) === this.cmpFilterStatus())
    .sort((a, b) => a.name.localeCompare(b.name)))
  protected readonly cmpA = computed(() => this.cmpSorted().find((d) => d.id === this.cmpAId()))
  protected readonly cmpB = computed(() => this.cmpSorted().find((d) => d.id === this.cmpBId()))
  protected readonly cmpFiltersActive = computed(() => this.cmpFilterCategory() !== 'all' || this.cmpFilterStatus() !== 'all')

  protected setCmpFilterCategory(v: string): void { this.cmpFilterCategory.set(v) }
  protected setCmpFilterStatus(v: string): void { this.cmpFilterStatus.set(v as 'all' | DbStatus) }
  protected resetCmpFilters(): void { this.cmpFilterCategory.set('all'); this.cmpFilterStatus.set('all') }
  protected navToCmpDb(d: DbPerf): void { this.router.navigate(['/partners'], { state: { query: d.name } }) }

  protected cmpMetric(m: (typeof COMPARE_METRICS)[number], a: DbPerf, b: DbPerf) {
    const va = m.get(a), vb = m.get(b)
    const aWins = m.higherIsBetter ? va > vb : va < vb
    const bWins = m.higherIsBetter ? vb > va : vb < va
    const scale = Math.max(Math.abs(va), Math.abs(vb), 1)
    const pctA = Math.min(100, (Math.abs(va) / scale) * 100)
    const pctB = Math.min(100, (Math.abs(vb) / scale) * 100)
    return { va, vb, aWins, bWins, pctA, pctB }
  }

  /* ==================================================================
     Onboarding Efficiency tab
     ================================================================== */
  protected readonly funnelRows = computed<FunnelRow[]>(() => {
    const stages = FUNNEL_STAGES
    const max = stages[0]?.count || 1
    return stages.map((s, i) => ({
      stage: s.stage, count: s.count, pct: Math.round((s.count / max) * 100),
      dropFromPrev: i > 0 ? Math.round(((stages[i - 1].count - s.count) / stages[i - 1].count) * 100) : null,
    }))
  })

  /* ---------------- Grievances overview ---------------- */
  protected readonly grvTotal = computed(() => this.store.grievances().length)
  protected readonly grvOpen = computed(() => this.store.grievances().filter((g) => g.status !== 'resolved'))
  protected readonly grvOverdue = computed(() => this.store.grievances().filter((g) => g.isOverdue))
  protected readonly grvResolved = computed(() => this.store.grievances().filter((g) => g.status === 'resolved'))
  protected readonly grvRegionData = computed<BarDatum[]>(() => {
    const byRegion = new Map<GtmRegion, number>()
    this.grvOpen().forEach((g) => {
      const code = stateCodeForTown(g.town)
      const region = code ? REGION_OF[code] : undefined
      if (region) byRegion.set(region, (byRegion.get(region) ?? 0) + 1)
    })
    return [...byRegion.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  })
  protected readonly grvCategoryData = computed<BarDatum[]>(() => {
    const byCategory = new Map<string, number>()
    this.grvOpen().forEach((g) => byCategory.set(g.category, (byCategory.get(g.category) ?? 0) + 1))
    return [...byCategory.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  })
  protected readonly grvUrgent = computed(() => [...this.grvOpen()]
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || b.ageDays - a.ageDays)
    .slice(0, 5))
  protected readonly PRIORITY_TONE = PRIORITY_TONE
  protected navToGrievance(id: string): void { this.router.navigate(['/grievances'], { state: { openId: id } }) }

  /* ---------------- Turnover vs Target ---------------- */
  protected readonly turnoverHover = signal<number | null>(null)
  protected readonly trendMonths = TREND.map((t) => t.month)
  protected readonly tvtMonthly = computed(() => this.trendMonths.map((_, i) => this.dbs().reduce((s, d) => s + (d.trend[i] ?? 0), 0)))
  protected readonly tvtAttainment = computed(() => {
    const targetTotal = this.targetTotal()
    return this.tvtMonthly().map((v) => (targetTotal ? Math.round((v / targetTotal) * 100) : 0))
  })
  private readonly tvtW = 460
  private readonly tvtH = 190
  private readonly tvtPadL = 42
  private readonly tvtPadR = 14
  private readonly tvtPadT = 26
  private readonly tvtPadB = 26
  protected readonly tvtDims = { W: this.tvtW, H: this.tvtH }
  private readonly tvtInnerW = this.tvtW - this.tvtPadL - this.tvtPadR
  private readonly tvtInnerH = this.tvtH - this.tvtPadT - this.tvtPadB
  protected readonly tvtMax = computed(() => Math.max(this.targetTotal(), ...this.tvtMonthly(), 1) * 1.15)
  protected tvtYFor(v: number): number { return this.tvtPadT + (1 - v / this.tvtMax()) * this.tvtInnerH }
  private readonly tvtColW = this.tvtInnerW / this.trendMonths.length
  private readonly tvtBarW = this.tvtColW * 0.48
  protected tvtXCenter(i: number): number { return this.tvtPadL + (i + 0.5) * this.tvtColW }
  protected tvtBarX(i: number): number { return this.tvtXCenter(i) - this.tvtBarW / 2 }
  protected readonly tvtBarWidth = this.tvtBarW
  protected readonly tvtHitX = (i: number) => this.tvtBarX(i) - this.tvtColW * 0.26
  protected readonly tvtHitWidth = this.tvtBarW + this.tvtColW * 0.52
  protected tvtBarPath(i: number): string {
    const v = this.tvtMonthly()[i]
    const x = this.tvtBarX(i)
    const y = this.tvtYFor(v)
    const h = this.tvtPadT + this.tvtInnerH - y
    return roundedTopBar(x, y, this.tvtBarW, h, 4)
  }
  protected readonly tvtTicks = computed(() => [0, 0.33, 0.66, 1].map((t) => Math.round(this.tvtMax() * t)))
  protected readonly tvtPadLeft = this.tvtPadL
  protected readonly tvtPadTop = this.tvtPadT
  protected readonly tvtInnerWidth = this.tvtInnerW
  protected readonly tvtInnerHeight = this.tvtInnerH

  /* ---------------- Top Movers ---------------- */
  protected readonly moverLens = signal<MoverLens>('attainment')
  protected readonly moverMaxTurnover = computed(() => Math.max(...this.dbs().map((d) => d.acmeTurnover), 1))
  protected readonly moverRows = computed<MoverRow[]>(() => {
    const lens = this.moverLens()
    const maxTurnover = this.moverMaxTurnover()
    return this.dbs().map((d) => {
      const m = moverFor(d, lens)
      const barPct = lens === 'turnover' ? Math.min(100, (d.acmeTurnover / maxTurnover) * 100) : m.barPct
      return { d, ...m, barPct }
    })
  })
  protected readonly moverGainers = computed(() => [...this.moverRows()].filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, 3))
  protected readonly moverDecliners = computed(() => [...this.moverRows()].filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, 3))
  protected navToMover(r: MoverRow): void { this.router.navigate(['/partners'], { state: { query: r.d.name } }) }

  /* ---------------- Performance Heatmap ---------------- */
  protected readonly heatDim = signal<HeatDim>('region')
  protected readonly heatGroups = computed<HeatGroup[]>(() => {
    const dim = this.heatDim()
    const dbs = this.dbs()
    if (dim === 'region') {
      const aggMap = new Map<GtmRegion, { actual: number; target: number }>()
      GTM_STATES.forEach((s) => {
        if (s.target == null || s.actual == null) return
        const r = REGION_OF[s.code]
        if (!r) return
        const cur = aggMap.get(r) ?? { actual: 0, target: 0 }
        cur.actual += s.actual; cur.target += s.target
        aggMap.set(r, cur)
      })
      return [...aggMap.entries()].map(([label, a]) => {
        const rp = REGION_PERFORMANCE[label]
        const cov = a.target ? Math.round((a.actual / a.target) * 100) : 0
        return {
          label,
          vals: { cov, fill: rp?.fillRate ?? 0, attn: rp?.attainmentPct ?? 0, growth: rp?.growthMoM ?? 0, risk: rp?.atRiskPct ?? 0 },
          count: a.actual,
          nav: () => this.router.navigate(['/gtm-coverage'], { state: { region: label } }),
        }
      }).sort((a, b) => (b.vals?.cov ?? 0) - (a.vals?.cov ?? 0))
    }
    const m = new Map<string, DbPerf[]>()
    for (const d of dbs) {
      const key = dim === 'state' ? (STATE_NAME[stateCodeForTown(d.town) ?? ''] ?? 'Other')
        : dim === 'town' ? d.town : d.category
      const arr = m.get(key) ?? []
      arr.push(d)
      m.set(key, arr)
    }
    const navFor = (label: string): (() => void) => {
      if (dim === 'town') return () => this.router.navigate(['/partners'], { state: { query: label } })
      if (dim === 'state') {
        const region = REGION_OF[NAME_TO_CODE[label] ?? '']
        return region ? () => this.router.navigate(['/gtm-coverage'], { state: { region } }) : () => this.router.navigate(['/partners'], { state: { query: label } })
      }
      return () => this.router.navigate(['/partners'], { state: { query: label } })
    }
    return [...m.entries()].map(([label, rows]) => ({ label, rows, count: rows.length, nav: navFor(label) }))
      .sort((a, b) => avg((b.rows ?? []).map(dbCoverage)) - avg((a.rows ?? []).map(dbCoverage)))
  })
  protected readonly heatHead = computed(() => HEAT_DIMS.find((d) => d.key === this.heatDim())!.head)
  protected readonly HEAT_METRICS = HEAT_METRICS
  protected heatValue(g: HeatGroup, m: HeatMetric): number | null {
    if (g.vals) return g.vals[m.key] ?? null
    return g.rows && g.rows.length ? m.get(g.rows) : null
  }
  protected heatCell(value: number, m: HeatMetric): { bg: string; fg: string } { return heatCell(value, m) }

  /* ---------------- Activity Heatmap ---------------- */
  protected readonly activityHeatmap = computed(() => {
    const partners = this.store.partners()
    const counts = new Map<string, number>()
    for (const p of partners) {
      if (!p.onboardedAt) continue
      const d = new Date(p.onboardedAt)
      if (Number.isNaN(d.getTime())) continue
      const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const today = new Date()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const start = new Date(end)
    start.setDate(end.getDate() - 7 * 52)
    start.setDate(start.getDate() - start.getDay())
    const weeks: HeatmapDay[][] = []
    let total = 0
    let maxCount = 0
    const cur = new Date(start)
    while (cur <= end) {
      const col: HeatmapDay[] = []
      for (let i = 0; i < 7; i++) {
        const within = cur <= end
        const key = cur.getFullYear() + '-' + cur.getMonth() + '-' + cur.getDate()
        const c = within ? (counts.get(key) ?? 0) : -1
        if (c > 0) { total += c; if (c > maxCount) maxCount = c }
        col.push({ date: new Date(cur), count: c })
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(col)
    }
    const monthLabels = weeks.map((w, i) => {
      const m = w[0].date.getMonth()
      return (i === 0 || m !== weeks[i - 1][0].date.getMonth()) ? GH_MONTHS[m] : ''
    })
    return { weeks, monthLabels, total, maxCount }
  })
  protected ghLevel(c: number): number {
    const maxCount = this.activityHeatmap().maxCount
    return c <= 0 ? 0 : maxCount <= 1 ? 2 : c >= 4 ? 4 : c >= 3 ? 3 : c >= 2 ? 2 : 1
  }
  protected ghDate(d: Date): string { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

  /* ---------------- Advanced Chart ---------------- */
  protected readonly CHART_RANGES: ChartRange[] = ['3M', '6M']
  protected readonly advRange = signal<ChartRange>('6M')
  protected readonly advHover = signal<number | null>(null)
  protected readonly advGradId = 'an-adv-grad'
  private readonly advAllMonths = TREND.map((t) => t.month)
  private readonly advAllVolume = TREND.map((t) => t.total)
  protected readonly advAllTurnover = computed(() => this.advAllMonths.map((_, i) => this.dbs().reduce((s, d) => s + (d.trend[i] ?? 0), 0)))
  protected readonly advStart = computed(() => (this.advRange() === '3M' ? Math.max(0, this.advAllMonths.length - 3) : 0))
  protected readonly advMonths = computed(() => this.advAllMonths.slice(this.advStart()))
  protected readonly advTurnover = computed(() => this.advAllTurnover().slice(this.advStart()))
  protected readonly advVolume = computed(() => this.advAllVolume.slice(this.advStart()))
  protected readonly advLen = computed(() => this.advMonths().length || 1)
  protected readonly advLatest = computed(() => this.advTurnover()[this.advTurnover().length - 1] ?? 0)
  protected readonly advPrev = computed(() => this.advTurnover()[this.advTurnover().length - 2] ?? this.advLatest())
  protected readonly advChange = computed(() => Math.round((this.advLatest() - this.advPrev()) * 10) / 10)
  protected readonly advChangePct = computed(() => (this.advPrev() ? Math.round((this.advChange() / this.advPrev()) * 1000) / 10 : 0))
  protected readonly advUp = computed(() => this.advChange() >= 0)

  private readonly advW = 920
  private readonly advH = 300
  private readonly advPadL = 46
  private readonly advPadR = 18
  private readonly advPadT = 18
  protected readonly advDims = { W: this.advW, H: this.advH }
  private readonly advInnerW = this.advW - this.advPadL - this.advPadR
  private readonly advPriceH = 176
  private readonly advVolH = 52
  private readonly advGap = 16
  protected readonly advPriceTop = this.advPadT
  protected readonly advPriceBottom = this.advPadT + this.advPriceH
  protected readonly advVolTop = this.advPriceBottom + this.advGap
  protected readonly advVolBottom = this.advVolTop + this.advVolH
  protected readonly advMaxP = computed(() => Math.max(...this.advTurnover()) * 1.08)
  protected readonly advMinP = computed(() => Math.min(...this.advTurnover()) * 0.92)
  protected advYP(v: number): number {
    const maxP = this.advMaxP(), minP = this.advMinP()
    return this.advPriceBottom - ((v - minP) / (maxP - minP || 1)) * this.advPriceH
  }
  protected readonly advMaxV = computed(() => Math.max(...this.advVolume(), 1))
  protected advYV(v: number): number { return this.advVolBottom - (v / this.advMaxV()) * this.advVolH }
  protected advXFor(i: number): number {
    const len = this.advLen()
    return len === 1 ? this.advPadL + this.advInnerW / 2 : this.advPadL + (i / (len - 1)) * this.advInnerW
  }
  protected readonly advLinePts = computed(() => this.advTurnover().map((v, i) => this.advXFor(i) + ',' + this.advYP(v)).join(' '))
  protected readonly advAreaPath = computed(() => {
    const turnover = this.advTurnover()
    const len = this.advLen()
    return 'M' + this.advXFor(0) + ',' + this.advPriceBottom + ' L' + turnover.map((v, i) => this.advXFor(i) + ',' + this.advYP(v)).join(' L') + ' L' + this.advXFor(len - 1) + ',' + this.advPriceBottom + ' Z'
  })
  protected readonly advTicks = computed(() => {
    const minP = this.advMinP(), maxP = this.advMaxP()
    return Array.from({ length: 5 }, (_, i) => minP + ((maxP - minP) / 4) * i)
  })
  protected advBarWidth(): number { return Math.min(26, Math.max(6, (this.advInnerW / this.advLen()) * 0.42)) }
  protected advBarX(i: number): number {
    const bw = this.advBarWidth()
    return Math.max(this.advPadL, Math.min(this.advXFor(i) - bw / 2, this.advPadL + this.advInnerW - bw))
  }
  protected advVolUp(i: number): boolean {
    const turnover = this.advTurnover()
    return i === 0 || turnover[i] >= turnover[i - 1]
  }
  protected advChangeAt(i: number): number | null {
    const turnover = this.advTurnover()
    return i > 0 ? Math.round((turnover[i] - turnover[i - 1]) * 10) / 10 : null
  }

  /* ---------------- AI Insight ---------------- */
  protected readonly aiDetail = signal<{ title: string; rows: InsightRow[] } | null>(null)
  protected readonly aiAtRisk = computed(() => this.dbs().filter((d) => dbStatus(d) === 'at_risk'))
  protected readonly aiDeclining = computed(() => this.dbs().filter((d) => d.growthMoM < 0))
  protected readonly aiLowFill = computed(() => this.dbs().filter((d) => d.fillRate < 90))
  protected readonly aiImproving = computed(() => this.dbs().filter((d) => d.growthMoM >= 5))
  protected readonly aiOverdue = computed(() => this.store.grievances().filter((g) => g.isOverdue && g.status !== 'resolved'))
  protected readonly aiCurAttain = computed(() => (this.targetTotal() ? Math.round((this.turnoverTotal() / this.targetTotal()) * 100) : 0))

  private readonly aiRegionAgg = computed(() => {
    const regionAgg = new Map<GtmRegion, { actual: number; target: number }>()
    GTM_STATES.forEach((s) => {
      if (s.target == null || s.actual == null) return
      const region = REGION_OF[s.code]
      if (!region) return
      const cur = regionAgg.get(region) ?? { actual: 0, target: 0 }
      cur.actual += s.actual; cur.target += s.target
      regionAgg.set(region, cur)
    })
    return regionAgg
  })
  protected readonly aiWorstRegion = computed(() => [...this.aiRegionAgg().entries()]
    .map(([name, a]) => ({ name, pct: Math.round((a.actual / a.target) * 100) }))
    .sort((a, b) => a.pct - b.pct)[0])

  protected readonly aiMovers = computed(() => this.dbs().map((d) => ({ d, delta: Math.round(((d.trend[d.trend.length - 1] ?? 0) - (d.trend[d.trend.length - 2] ?? 0)) * 10) / 10 })))
  protected readonly aiWorstMover = computed(() => [...this.aiMovers()].sort((a, b) => a.delta - b.delta)[0])

  protected readonly aiRec = computed<Rec>(() => {
    const atRisk = this.aiAtRisk()
    const targetTotal = this.targetTotal()
    const turnoverTotal = this.turnoverTotal()
    const curAttain = this.aiCurAttain()
    if (atRisk.length) {
      const recovered = turnoverTotal + atRisk.reduce((s, d) => s + Math.max(0, d.acmeTarget - d.acmeTurnover), 0)
      const impactPp = (targetTotal ? Math.round((recovered / targetTotal) * 100) : 0) - curAttain
      const worst = [...atRisk].sort((a, b) => dbAttainment(a) - dbAttainment(b))[0]
      return {
        headline: atRisk.length + ' distributor' + (atRisk.length === 1 ? ' is' : 's are') + ' at risk — ' + worst.name + ' is running ' + dbAttainment(worst) + '% of turnover plan and ' + dbCoverage(worst) + '% of coverage.',
        action: 'Review at-risk distributors', route: '/partners', query: worst.name,
        impact: impactPp > 0 ? 'Recovering them to plan lifts book attainment by ~' + impactPp + 'pp' : 'Priority: stop further slippage',
      }
    }
    const worstRegion = this.aiWorstRegion()
    if (worstRegion && worstRegion.pct < 70) {
      return {
        headline: 'Coverage in the ' + worstRegion.name + ' region is ' + worstRegion.pct + '% of plan — the weakest of all macro-regions this period.',
        action: 'Open ' + worstRegion.name + ' coverage', route: '/gtm-coverage', query: undefined,
        impact: 'Closing to 70% would add coverage across ' + worstRegion.name + "'s beats",
      }
    }
    const lowFill = this.aiLowFill()
    if (lowFill.length) {
      const worst = [...lowFill].sort((a, b) => a.fillRate - b.fillRate)[0]
      return {
        headline: 'Fill rate is below 90% for ' + lowFill.length + ' distributor' + (lowFill.length === 1 ? '' : 's') + ' — ' + worst.name + ' is lowest at ' + worst.fillRate + '%.',
        action: 'Review supply & stock', route: '/partners', query: worst.name,
        impact: 'Service-level risk — check DC allocation before it hits orders',
      }
    }
    return {
      headline: 'The book is healthy — ' + curAttain + '% attainment, ' + this.avgCoverage() + '% coverage, no distributors at risk in view.',
      action: 'View distributors', route: '/partners', query: undefined,
      impact: 'Keep pressing the top movers to widen the lead',
    }
  })

  protected readonly aiChurnRows = computed<InsightRow[]>(() => [...this.aiDeclining()].sort((a, b) => a.growthMoM - b.growthMoM).map((d) => ({
    name: d.name, sub: d.growthMoM + '% MoM · ' + dbAttainment(d) + '% of plan · ' + d.town,
    onClick: () => this.router.navigate(['/partners'], { state: { query: d.name } }),
  })))
  protected readonly aiOverdueRows = computed<InsightRow[]>(() => this.aiOverdue().map((g) => ({
    name: g.distributor, sub: g.subject + ' · ' + g.ageDays + 'd old · ' + g.town,
    onClick: () => this.router.navigate(['/grievances'], { state: { openId: g.id } }),
  })))
  protected readonly aiImprovingRows = computed<InsightRow[]>(() => [...this.aiImproving()].sort((a, b) => b.growthMoM - a.growthMoM).map((d) => ({
    name: d.name, sub: '+' + d.growthMoM + '% MoM · ' + dbAttainment(d) + '% of plan · ' + d.town,
    onClick: () => this.router.navigate(['/partners'], { state: { query: d.name } }),
  })))

  protected readonly aiBullets = computed<InsightBullet[]>(() => {
    const declining = this.aiDeclining()
    const overdue = this.aiOverdue()
    const worstMover = this.aiWorstMover()
    const improving = this.aiImproving()
    const bullets: (InsightBullet | false)[] = [
      declining.length > 0 && { icon: 'clock', tone: 'warn', text: declining.length + ' distributor' + (declining.length === 1 ? '' : 's') + ' likely to churn — declining month-on-month', rows: this.aiChurnRows() },
      overdue.length > 0 && { icon: 'flag', tone: 'crit', text: overdue.length + ' grievance' + (overdue.length === 1 ? '' : 's') + ' past SLA' + (overdue[0] ? ' — oldest is ' + overdue[0].distributor : ''), rows: this.aiOverdueRows() },
      !!worstMover && worstMover.delta < 0 && { icon: 'analytics', tone: 'warn', text: worstMover.d.name + ' turnover down ₹' + Math.abs(worstMover.delta) + 'L vs last month', rows: [{ name: worstMover.d.name, sub: 'Now ₹' + worstMover.d.acmeTurnover + 'L · down ₹' + Math.abs(worstMover.delta) + 'L · ' + worstMover.d.town, onClick: () => this.router.navigate(['/partners'], { state: { query: worstMover.d.name } }) }] },
      improving.length > 0 && { icon: 'check', tone: 'good', text: improving.length + ' distributor' + (improving.length === 1 ? '' : 's') + ' growing 5%+ MoM — momentum to build on', rows: this.aiImprovingRows() },
    ]
    return bullets.filter((b): b is InsightBullet => !!b)
  })

  protected readonly aiStats = computed(() => {
    const curAttain = this.aiCurAttain()
    const avgCoverage = this.avgCoverage()
    const avgFill = Math.round(this.dbs().reduce((s, d) => s + d.fillRate, 0) / this.dbsN())
    const atRiskLen = this.aiAtRisk().length
    return [
      { label: 'Book Attainment', value: curAttain + '%', tone: curAttain >= 100 ? 'good' : curAttain >= 85 ? 'warn' : 'crit' },
      { label: 'Avg Coverage', value: avgCoverage + '%', tone: avgCoverage >= 85 ? 'good' : avgCoverage >= 70 ? 'warn' : 'crit' },
      { label: 'Avg Fill Rate', value: avgFill + '%', tone: avgFill >= 90 ? 'good' : 'warn' },
      { label: 'At Risk', value: String(atRiskLen), delta: this.pctOf(atRiskLen, this.dbsN()) + '% of book', tone: atRiskLen === 0 ? 'good' : atRiskLen <= 2 ? 'warn' : 'crit' },
    ] as { label: string; value: string; delta?: string; tone: 'good' | 'warn' | 'crit' | 'neu' }[]
  })

  protected navAiRec(): void {
    const rec = this.aiRec()
    this.router.navigate([rec.route], rec.query ? { state: { query: rec.query } } : undefined)
  }

  /* ---------------- Partner Aging ---------------- */
  protected readonly agingHover = signal<number | null>(null)
  protected readonly agingPinned = signal<number | null>(null)
  protected readonly agingTenure = signal<'all' | TenureBucketKey>('all')

  private readonly agingScope = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return this.store.dataScopeByRole()[viewingAs]
  })
  private readonly agingRegion = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return DEMO_USERS[viewingAs]?.region
  })
  private readonly agingState = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return DEMO_USERS[viewingAs]?.state
  })
  private readonly agingScopesPartners = computed(() => {
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    return (this.store.dataEntitiesByRole()[viewingAs] ?? []).includes('partners')
  })
  private readonly agingIsRegionScoped = computed(() => this.agingScope() !== 'all' && this.agingScopesPartners())
  private readonly agingScopedPartners = computed(() => {
    const all = this.store.partners()
    const scoped = this.agingIsRegionScoped() ? all.filter((p) => inDataScope(p.state, this.agingScope(), this.agingRegion(), this.agingState())) : all
    return scoped.filter((p): p is Partner & { onboardedAt: string } => !!p.onboardedAt)
  })
  protected readonly agingPartners = computed(() => {
    const tenure = this.agingTenure()
    const scoped = this.agingScopedPartners()
    return tenure === 'all' ? scoped : scoped.filter((p) => tenureBucket(p.onboardedAt, p.discontinuedAt) === tenure)
  })

  // Fixed 6-month window relative to load time — mirrors the source's useMemo([]) (computed once).
  private readonly agingMonths = Array.from({ length: 6 }, (_, i) => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), monthIdx: d.getMonth() }
  })
  protected readonly agingSeries = computed(() => this.agingMonths.map((m) => ({
    ...m,
    onboarded: this.agingPartners().filter((p) => {
      const od = new Date(p.onboardedAt)
      return od.getFullYear() === m.year && od.getMonth() === m.monthIdx
    }),
    deboarded: this.agingPartners().filter((p) => {
      if (!p.discontinuedAt) return false
      const dd = new Date(p.discontinuedAt)
      return dd.getFullYear() === m.year && dd.getMonth() === m.monthIdx
    }),
  })))

  private readonly agingW = 760
  private readonly agingH = 420
  private readonly agingPadL = 40
  private readonly agingPadR = 22
  private readonly agingPadT = 30
  private readonly agingPadB = 34
  protected readonly agingDims = { W: this.agingW, H: this.agingH }
  private readonly agingInnerW = this.agingW - this.agingPadL - this.agingPadR
  private readonly agingInnerH = this.agingH - this.agingPadT - this.agingPadB
  protected readonly agingPadTop = this.agingPadT
  protected readonly agingInnerWidth = this.agingInnerW
  protected readonly agingInnerHeight = this.agingInnerH
  protected readonly agingMaxV = computed(() => {
    const series = this.agingSeries()
    return Math.max(...series.map((s) => s.onboarded.length), ...series.map((s) => s.deboarded.length), 1) * 1.25
  })
  protected agingXFor(i: number): number { return this.agingPadL + (i * this.agingInnerW) / (this.agingSeries().length - 1) }
  protected agingYFor(v: number): number { return this.agingPadT + (1 - v / this.agingMaxV()) * this.agingInnerH }
  protected agingLine(key: 'onboarded' | 'deboarded'): string {
    return this.agingSeries().map((s, i) => this.agingXFor(i) + ',' + this.agingYFor(s[key].length)).join(' ')
  }
  protected readonly agingBottom = this.agingPadT + this.agingInnerH
  protected agingAreaPath(key: 'onboarded' | 'deboarded'): string {
    const pts = this.agingSeries().map((s, i) => this.agingXFor(i) + ',' + this.agingYFor(s[key].length))
    return 'M' + this.agingPadL + ',' + this.agingBottom + ' L' + pts.join(' L') + ' L' + (this.agingPadL + this.agingInnerW) + ',' + this.agingBottom + ' Z'
  }
  protected readonly agingActive = computed(() => this.agingPinned() ?? this.agingHover())
  protected readonly agingHoveredSeries = computed(() => {
    const active = this.agingActive()
    return active !== null ? this.agingSeries()[active] : null
  })
  protected readonly agingTicks = computed(() => [0, 0.5, 1].map((t) => Math.round(this.agingMaxV() * t)))
  protected agingTogglePin(i: number): void { this.agingPinned.update((p) => (p === i ? null : i)) }
  protected navToAgingPartner(id: string): void { this.router.navigate(['/partners'], { state: { openId: id } }) }
  protected setAgingTenure(v: string): void { this.agingTenure.set(v as 'all' | TenureBucketKey) }

  /* ---------------- Key Alerts ---------------- */
  protected readonly alertsExpanded = signal(false)
  protected readonly ALERT_TAG_TONE = ALERT_TAG_TONE
  protected readonly keyAlerts = computed<AlertRow[]>(() => {
    const dbs = this.dbs()
    const grievances = this.store.grievances()
    const lowCoverage = dbs.filter((d) => dbCoverage(d) < 40)
    const offTrack = dbs.filter((d) => dbStatus(d) !== 'on_track')
    const overdueGrievances = grievances.filter((g) => g.status !== 'resolved' && g.ageDays > 7)
    const declining = dbs.filter((d) => d.growthMoM < 0)
    const severeLowFill = dbs.filter((d) => d.fillRate < 80)
    const alerts: (AlertRow | false)[] = [
      lowCoverage.length > 0 && {
        icon: 'alert', tone: 'crit', tag: 'High',
        label: lowCoverage.length + ' distributor' + (lowCoverage.length === 1 ? '' : 's') + ' have coverage below 40%',
        sub: 'Immediate attention required', onClick: () => this.router.navigate(['/partners']),
      },
      offTrack.length > 0 && {
        icon: 'flag', tone: 'warn', tag: 'Medium',
        label: offTrack.length + ' distributor' + (offTrack.length === 1 ? '' : 's') + ' are off track on target attainment',
        sub: 'Review and take action', onClick: () => this.router.navigate(['/partners']),
      },
      overdueGrievances.length > 0 && {
        icon: 'documents', tone: 'warn', tag: 'Low',
        label: overdueGrievances.length + ' grievance' + (overdueGrievances.length === 1 ? '' : 's') + ' pending for more than 7 days',
        sub: 'Follow up to avoid escalation', onClick: () => this.router.navigate(['/grievances']),
      },
      declining.length > 0 && {
        icon: 'clock', tone: 'warn', tag: 'Medium',
        label: declining.length + ' distributor' + (declining.length === 1 ? '' : 's') + ' declining month-on-month',
        sub: 'Investigate the drop before next quarter', onClick: () => this.router.navigate(['/partners']),
      },
      severeLowFill.length > 0 && {
        icon: 'alert', tone: 'crit', tag: 'High',
        label: severeLowFill.length + ' distributor' + (severeLowFill.length === 1 ? '' : 's') + ' have fill rate below 80%',
        sub: 'Service-level risk — review supply/stock', onClick: () => this.router.navigate(['/partners']),
      },
    ]
    return alerts.filter((a): a is AlertRow => !!a)
  })
  protected readonly keyAlertsVisible = computed(() => this.alertsExpanded() ? this.keyAlerts() : this.keyAlerts().slice(0, 3))

  /* ---------------- Coverage by Region ---------------- */
  protected readonly coverageHoverRegion = signal<GtmRegion | null>(null)
  private readonly coverageRegionAgg = computed(() => {
    const regionAgg = new Map<GtmRegion, { actual: number; target: number }>()
    GTM_STATES.forEach((s) => {
      if (s.target == null || s.actual == null) return
      const region = REGION_OF[s.code]
      if (!region) return
      const cur = regionAgg.get(region) ?? { actual: 0, target: 0 }
      cur.actual += s.actual; cur.target += s.target
      regionAgg.set(region, cur)
    })
    return regionAgg
  })
  protected readonly coverageRegions = computed<RankedRegion[]>(() => [...this.coverageRegionAgg().entries()]
    .map(([name, a]) => ({ name, pct: Math.round((a.actual / a.target) * 100), actual: a.actual, target: a.target }))
    .sort((a, b) => b.pct - a.pct))
  protected coveragePctByCode(code: string): number | null {
    const region = REGION_OF[code]
    const r = region && this.coverageRegionAgg().get(region)
    return r ? Math.round((r.actual / r.target) * 100) : null
  }
  protected navToGtmRegion(region: GtmRegion): void { this.router.navigate(['/gtm-coverage'], { state: { region } }) }
  protected navToGtm(): void { this.router.navigate(['/gtm-coverage']) }
  protected regionForCode(code: string): GtmRegion | undefined { return REGION_OF[code] }

  /* ---------------- Fill Rate vs Coverage ---------------- */
  protected readonly fillHover = signal<string | null>(null)
  private readonly fillW = 460
  private readonly fillH = 260
  private readonly fillPadL = 40
  private readonly fillPadR = 16
  private readonly fillPadT = 16
  private readonly fillPadB = 34
  protected readonly fillDims = { W: this.fillW, H: this.fillH }
  private readonly fillInnerW = this.fillW - this.fillPadL - this.fillPadR
  private readonly fillInnerH = this.fillH - this.fillPadT - this.fillPadB
  protected readonly fillPadTop = this.fillPadT
  protected readonly fillInnerWidth = this.fillInnerW
  protected readonly fillInnerHeight = this.fillInnerH
  private readonly fillXMin = 75
  private readonly fillXMax = 100
  protected readonly fillYMax = computed(() => {
    const covs = this.dbs().map(dbCoverage)
    return Math.max(100, Math.ceil((Math.max(...covs, 100) + 5) / 10) * 10)
  })
  protected readonly fillMaxOutlets = computed(() => Math.max(...this.dbs().map((d) => d.outlets), 1))
  protected fillXFor(v: number): number { return this.fillPadL + ((v - this.fillXMin) / (this.fillXMax - this.fillXMin)) * this.fillInnerW }
  protected fillYFor(v: number): number { return this.fillPadT + (1 - v / this.fillYMax()) * this.fillInnerH }
  protected fillRFor(outlets: number): number { return 5 + Math.sqrt(outlets / this.fillMaxOutlets()) * 13 }
  protected readonly fillXTicks = [75, 85, 95, 100]
  protected readonly fillYTicks = computed(() => [0, this.fillYMax() / 2, this.fillYMax()])
}
