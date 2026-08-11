import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent, CardComponent, PillComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { GTM_STATES, GTM_FACTORS, GTM_DATA, actualDistributorsIn, distributorRowsIn, SVG_ID, stateCodeForTown, REGION_OF } from '../mock/gtm'
import type { GtmRegion, GtmStateInfo, StateDb } from '../mock/gtm'
import { DB_TYPES } from '../mock/onboarding'
import { DEMO_USERS } from '../mock/roles'
import { AppStore } from '../store'
import INDIA_MAP from '@svg-maps/india'

// India has 28 states + 8 union territories — the fixed denominator for "States Covered".
const INDIA_STATE_COUNT = 36

const CHANNEL_COLOR: Record<string, string> = {
  'GT DB (with CSO/DSM)': 'var(--chart-1)', 'GM Excl DB': 'var(--chart-3)', Traders: 'var(--chart-5)',
}
const hashOf = (s: string) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
// Deterministic "last activity" per distributor — same name+town always shows the same age.
const lastActivityOf = (d: StateDb) => {
  const days = 1 + (hashOf(d.name + d.town) % 12)
  return days === 1 ? '1 day ago' : days + ' days ago'
}

const STATE_BY_SVG_ID: Record<string, GtmStateInfo | undefined> =
  Object.fromEntries(GTM_STATES.map((s) => [SVG_ID[s.code], s]))

/* ---- coverage tiers (per the India-overview legend) ---- */
type Tier = 'met' | 'high' | 'mid' | 'low' | 'none'
const tierOf = (s: GtmStateInfo): Tier => {
  if (s.target == null || s.actual == null) return 'none'
  const pct = (s.actual / s.target) * 100
  return pct >= 100 ? 'met' : pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low'
}
const TIER_COLOR: Record<Tier, string> = {
  met: '#22b98a', high: '#e0c23c', mid: '#f09a4c', low: '#f16d6d', none: 'var(--surface-3)',
}
const TIER_LABEL: Record<Tier, string> = {
  met: '≥ 100%', high: '70% – 99%', mid: '40% – 69%', low: '< 40%', none: 'No data',
}
const pctOf = (s: GtmStateInfo) => (s.target && s.actual != null ? Math.round((s.actual / s.target) * 100) : null)

/* ---- factor rows for a state (deterministic — calibrated off the plan sheet ratios) ---- */
function factorRows(target: number, actual: number) {
  const r = actual / target
  return GTM_FACTORS.map((f) => {
    const t = f.money ? +(target * f.perTarget).toFixed(1) : Math.round(target * f.perTarget)
    const cov = Math.min(1.1, r + f.delta)
    const a = f.money ? +(t * cov).toFixed(1) : Math.round(t * cov)
    const variance = +(a - t).toFixed(1)
    const variancePct = t ? Math.abs(Math.round((variance / t) * 1000) / 10) : 0
    const coverage = t ? Math.round((a / t) * 100) : 0
    return { ...f, target: t, actual: a, variance, variancePct, coverage }
  })
}
const fmtVal = (v: number, money?: boolean) => (money ? '₹' + v.toFixed(1) + 'L' : String(v))

type FactorRow = ReturnType<typeof factorRows>[number]

// Stat-tile actions — the source's tiles[].onClick closures, keyed so the template can loop
// over one array and dispatch through a single handler instead of storing closures per row.
type TileAction = 'factors' | 'allDbs' | 'active' | 'inReview' | 'notActive' | 'statesCovered'
interface Tile { icon: IconName; tone: string; label: string; big: string; sub: string; note: string; action: TileAction }

interface CityRow { city: string; target: number; actual: number; pct: number; tier: Tier; dbs: StateDb[] }
interface DonutSegment { type: string; count: number; pct: number; len: number; offset: number }

const DONUT_R = 46
const DONUT_C = 2 * Math.PI * DONUT_R

@Component({
  selector: 'app-gtm-coverage',
  standalone: true,
  imports: [FormsModule, ButtonComponent, CardComponent, PillComponent, IconComponent],
  templateUrl: './gtm-coverage.component.html',
  styleUrl: './gtm-coverage.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GtmCoverageComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Module-level data/functions the template reads directly.
  protected readonly DB_TYPES = DB_TYPES
  protected readonly TIER_COLOR = TIER_COLOR
  protected readonly TIER_LABEL = TIER_LABEL
  protected readonly TIERS: Tier[] = ['met', 'high', 'mid', 'low', 'none']
  protected readonly pctOf = pctOf
  protected readonly fmtVal = fmtVal
  protected readonly lastActivityOf = lastActivityOf
  protected readonly indiaMap = INDIA_MAP as unknown as { viewBox: string; locations: { id: string; name: string; path: string }[] }

  // "Coverage by Region" on Analytics links here with a region — narrows the state picker to
  // just that region's states so clicking e.g. "North" actually shows who's appointed there,
  // instead of landing on the same all-India view every other entry point lands on. Captured
  // via getCurrentNavigation()?.extras.state in the field initializer (runs during the
  // constructor while the activating navigation is still in flight) — mirrors the React
  // screen's useLocation().state read.
  protected readonly regionFilter = signal<GtmRegion | null>(
    ((this.router.getCurrentNavigation()?.extras.state ?? null) as { region?: GtmRegion } | null)?.region ?? null,
  )
  // null = no single state chosen — the default, aggregate "all India" (or all-of-region, if a
  // region link narrowed visibleStates) view rather than defaulting to any one state.
  protected readonly selected = signal<string | null>(null)
  protected readonly zoom = signal(1)
  protected readonly moreFactors = signal(false)
  protected readonly allStates = signal(false)
  protected readonly category = signal<string>('All')
  protected readonly statusFilter = signal<'all' | 'Active' | 'In review'>('all')
  protected readonly townFilter = signal<string | null>(null)
  protected readonly showAllDbs = signal(false)

  protected readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('stage')
  protected readonly distributorsRef = viewChild<ElementRef<HTMLDivElement>>('distributors')
  protected readonly factorsRef = viewChild<ElementRef<HTMLDivElement>>('factors')

  // Data-level RBAC: a scoped persona (set by the Super Admin in Admin > Data access) only
  // sees — and can only select — states in their own region/state, but only if the Super
  // Admin has "GTM Coverage" checked as one of the screens that scope applies to.
  private readonly myScope = computed(() => {
    const viewingAs = this.store.viewingAs()
    return viewingAs ? this.store.dataScopeByRole()[viewingAs] : 'all'
  })
  private readonly myRegion = computed(() => {
    const viewingAs = this.store.viewingAs()
    return viewingAs ? DEMO_USERS[viewingAs]?.region : undefined
  })
  private readonly myState = computed(() => {
    const viewingAs = this.store.viewingAs()
    return viewingAs ? DEMO_USERS[viewingAs]?.state : undefined
  })
  private readonly scopesGtm = computed(() => {
    const viewingAs = this.store.viewingAs()
    return viewingAs ? (this.store.dataEntitiesByRole()[viewingAs] ?? []).includes('gtm_coverage') : false
  })
  protected readonly isRegionScoped = computed(() => this.myScope() !== 'all' && this.scopesGtm())

  // "actual" is computed live from the same Partners directory the Partners screen itself
  // shows, instead of the ingested sheet's static count — so the two screens' numbers can
  // never drift apart (target stays the static plan figure; only actual is live).
  private readonly allWithData = computed(() => {
    const partners = this.store.partners()
    return GTM_STATES.filter((s) => s.target != null && s.actual != null)
      .map((s) => ({ ...s, actual: actualDistributorsIn(partners, s.code) }))
  })
  private readonly withData = computed(() => {
    const all = this.allWithData()
    if (!this.isRegionScoped()) return all
    const myScope = this.myScope()
    const myState = this.myState()
    const myRegion = this.myRegion()
    return all.filter((s) => (myScope === 'own_state' ? s.name === myState : REGION_OF[s.code] === myRegion))
  })
  protected readonly visibleStates = computed(() => {
    const withData = this.withData()
    const regionFilter = this.regionFilter()
    return regionFilter ? withData.filter((s) => REGION_OF[s.code] === regionFilter) : withData
  })
  private readonly inScopeCodes = computed(() => new Set(this.visibleStates().map((s) => s.code)))
  protected readonly visibleActualTotal = computed(() => this.visibleStates().reduce((n, s) => n + (s.actual ?? 0), 0))

  protected readonly aggregateSel = computed<GtmStateInfo>(() => {
    const regionFilter = this.regionFilter()
    const visibleStates = this.visibleStates()
    return {
      code: 'ALL', name: regionFilter ? 'All ' + regionFilter : 'All India', col: 0, row: 0,
      target: visibleStates.reduce((s, x) => s + (x.target ?? 0), 0),
      actual: visibleStates.reduce((s, x) => s + (x.actual ?? 0), 0),
    }
  })
  // Constrained to `visibleStates` (RBAC-scoped, then optionally narrowed to one region), not
  // the raw GTM_STATES list, so a region-scoped persona — or a region link from Analytics —
  // can never land on, or stay on, a state outside what's actually visible right now.
  protected readonly sel = computed<GtmStateInfo>(() => {
    const selected = this.selected()
    const visibleStates = this.visibleStates()
    return selected ? (visibleStates.find((s) => s.code === selected) ?? this.aggregateSel()) : this.aggregateSel()
  })
  protected readonly selTier = computed(() => tierOf(this.sel()))

  constructor() {
    // Only reacts to regionFilter changing (mirrors the source's `[regionFilter]` effect
    // dependency array) — visibleStates/selected are read untracked so re-selecting a state,
    // or visibleStates changing for some other reason, doesn't retrigger this reset.
    effect(() => {
      const regionFilter = this.regionFilter()
      if (!regionFilter) return
      untracked(() => {
        const visibleStates = this.visibleStates()
        if (!visibleStates.some((s) => s.code === this.selected())) {
          this.selected.set(visibleStates[0]?.code ?? this.selected())
        }
      })
    })
  }

  protected readonly ranked = computed(() => [...this.visibleStates()].sort((a, b) => (pctOf(b) ?? 0) - (pctOf(a) ?? 0)))
  protected readonly topStates = computed(() => (this.allStates() ? this.ranked() : this.ranked().slice(0, 8)))
  protected readonly rows = computed<FactorRow[]>(() => {
    const sel = this.sel()
    const moreFactors = this.moreFactors()
    return sel.target && sel.actual != null ? factorRows(sel.target, sel.actual).filter((f) => moreFactors || !f.extra) : []
  })
  // City drill exists for states the state-level mock covers (MH, GJ, MP, RJ, UP) — never for
  // the aggregate "all India" pseudo-state, so this naturally hides that section there.
  protected readonly drill = computed(() => GTM_DATA[this.sel().code])

  // Every state's appointed distributors — the real live Partners in it, not a synthetic
  // namedDbs+filler list, so this table/donut/city-drill always agrees with the actual count
  // above (and with the Partners screen itself).
  private distributorsForState(s: GtmStateInfo): StateDb[] {
    return distributorRowsIn(this.store.partners(), s.code)
  }
  // Aggregate mode flattens every visible state's own distributor list — not one call keyed by
  // the pseudo 'ALL' code, which stateDistributors/GTM_DATA don't know about.
  protected readonly stateDbs = computed<StateDb[]>(() => {
    const selected = this.selected()
    return selected ? this.distributorsForState(this.sel()) : this.visibleStates().flatMap((s) => this.distributorsForState(s))
  })
  // Category + status filters apply to the distributor table below and to the city drill-down
  // counts, so both stay in sync with whatever's actually listed rather than a separately-tracked
  // number. Town filter (from clicking a city) narrows the table only — city groupings are built
  // off category+status so every city still shows its own count.
  protected readonly catStatusDbs = computed(() => {
    const category = this.category()
    const statusFilter = this.statusFilter()
    return this.stateDbs().filter((d) => (category === 'All' || d.type === category) && (statusFilter === 'all' || d.status === statusFilter))
  })
  protected readonly filteredDbs = computed(() => {
    const townFilter = this.townFilter()
    const catStatusDbs = this.catStatusDbs()
    return townFilter ? catStatusDbs.filter((d) => d.town === townFilter) : catStatusDbs
  })
  protected readonly displayedDbs = computed(() => (this.showAllDbs() ? this.filteredDbs() : this.filteredDbs().slice(0, 5)))
  private readonly dbsByTown = computed(() => {
    const map = new Map<string, StateDb[]>()
    this.catStatusDbs().forEach((d) => map.set(d.town, [...(map.get(d.town) ?? []), d]))
    return map
  })

  protected readonly cityRows = computed<CityRow[]>(() => {
    const drill = this.drill()
    if (!drill) return []
    const dbsByTown = this.dbsByTown()
    return Object.entries(drill.cities).map(([city, c]) => {
      const dbs = dbsByTown.get(city) ?? []
      const actual = dbs.length
      const pct = c.target ? Math.round((actual / c.target) * 100) : 0
      return { city, target: c.target, actual, pct, tier: this.tierForPct(pct), dbs }
    })
  })

  // Aggregate mode: any grievance whose town falls in a currently-visible state, not just a
  // single sel.code (the pseudo 'ALL' code matches nothing in the real per-town lookup).
  protected readonly stateGrievances = computed(() => {
    const selected = this.selected()
    const grievances = this.store.grievances()
    if (selected) return grievances.filter((g) => stateCodeForTown(g.town) === this.sel().code)
    const inScopeCodes = this.inScopeCodes()
    return grievances.filter((g) => { const c = stateCodeForTown(g.town); return !!c && inScopeCodes.has(c) })
  })
  protected readonly grievanceTone = computed<Tone>(() => {
    const g = this.stateGrievances()
    return g.some((x) => x.isOverdue) ? 'crit' : g.length ? 'warn' : 'good'
  })
  protected readonly grievanceOpenCount = computed(() => this.stateGrievances().filter((g) => g.status !== 'resolved').length)

  protected fullscreen(): void {
    this.stageRef()?.nativeElement.requestFullscreen?.()
  }
  protected scrollToDistributors(): void {
    this.distributorsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  protected exportView(): void {
    const sel = this.sel()
    this.store.addReport({ name: 'GTM Coverage export — ' + sel.name, format: 'PDF' })
    this.store.logAudit({ actor: 'You', kind: 'human', action: 'Exported GTM Coverage view (' + sel.name + ') to Reports', entity: 'GTM Coverage' })
    this.router.navigate(['/reports'])
  }
  protected goToDistributors(patch?: { category?: string; status?: 'all' | 'Active' | 'In review'; town?: string | null }): void {
    if (patch?.category !== undefined) this.category.set(patch.category)
    if (patch?.status !== undefined) this.statusFilter.set(patch.status)
    if (patch?.town !== undefined) {
      const cur = this.townFilter()
      this.townFilter.set(cur === patch.town ? null : patch.town ?? null)
    }
    this.scrollToDistributors()
  }

  // Channel-type split for the selected state's appointed distributors — feeds the donut.
  protected readonly channelCounts = computed(() => {
    const stateDbs = this.stateDbs()
    return DB_TYPES.map((t) => ({ type: t, count: stateDbs.filter((d) => d.type === t).length })).filter((c) => c.count > 0)
  })

  protected readonly selActive = computed(() => this.stateDbs().filter((d) => d.status === 'Active').length)
  protected readonly selInReview = computed(() => this.stateDbs().filter((d) => d.status === 'In review').length)
  protected readonly selNotActive = computed(() => Math.max(0, (this.sel().target ?? 0) - this.stateDbs().length))
  protected readonly selPct = computed(() => pctOf(this.sel()) ?? 0)

  protected readonly tiles = computed<Tile[]>(() => {
    const selPct = this.selPct()
    const sel = this.sel()
    const stateDbs = this.stateDbs()
    const selActive = this.selActive()
    const selInReview = this.selInReview()
    const selNotActive = this.selNotActive()
    const withData = this.withData()
    return [
      { icon: 'analytics', tone: 'ai', label: 'Coverage Achieved', big: selPct + '%', sub: '', note: 'vs target 100%', action: 'factors' },
      { icon: 'partners', tone: 'ai', label: 'Total Distributors', big: String(stateDbs.length), sub: '', note: 'across ' + sel.name, action: 'allDbs' },
      { icon: 'check', tone: 'good', label: 'Active Distributors', big: String(selActive), sub: '', note: (stateDbs.length ? Math.round((selActive / stateDbs.length) * 100) : 0) + '% of total', action: 'active' },
      { icon: 'clock', tone: 'warn', label: 'In Review', big: String(selInReview), sub: '', note: (stateDbs.length ? Math.round((selInReview / stateDbs.length) * 100) : 0) + '% of total', action: 'inReview' },
      { icon: 'alert', tone: 'crit', label: 'Not Active', big: String(selNotActive), sub: '', note: 'short of plan', action: 'notActive' },
      { icon: 'target', tone: 'ai', label: 'States Covered', big: withData.length + ' / ' + INDIA_STATE_COUNT, sub: '', note: 'in India', action: 'statesCovered' },
    ]
  })

  protected onTileClick(action: TileAction): void {
    switch (action) {
      case 'factors':
        this.factorsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      case 'allDbs':
        this.goToDistributors({ category: 'All', status: 'all', town: null })
        break
      case 'active':
        this.goToDistributors({ status: 'Active' })
        break
      case 'inReview':
        this.goToDistributors({ status: 'In review' })
        break
      case 'notActive':
        this.distributorsRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      case 'statesCovered':
        this.stageRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
    }
  }

  // ---- choropleth map helpers ----
  // Out-of-region states render as "no data" and aren't clickable for a region-scoped
  // persona — the data-level RBAC applies on the map too.
  private stateForLocation(id: string): GtmStateInfo | undefined {
    const raw = STATE_BY_SVG_ID[id]
    return raw && this.inScopeCodes().has(raw.code) ? raw : undefined
  }
  protected tierForLocation(id: string): Tier {
    const st = this.stateForLocation(id)
    return st ? tierOf(st) : 'none'
  }
  protected pathClass(id: string): string {
    const tier = this.tierForLocation(id)
    const st = this.stateForLocation(id)
    const active = !!st && st.code === this.selected()
    return 'gtm4-path ' + (tier !== 'none' ? 'has' : '') + ' ' + (active ? 'active' : '')
  }
  protected pathTitle(loc: { id: string; name: string }): string {
    const st = this.stateForLocation(loc.id)
    const rawSt = STATE_BY_SVG_ID[loc.id]
    const pct = st ? pctOf(st) : null
    if (st && pct != null) return loc.name + ' — ' + st.actual + '/' + st.target + ' appointed (' + pct + '%)'
    if (rawSt && this.isRegionScoped()) return loc.name + ' — outside your region'
    return loc.name + ' — no data yet'
  }
  protected onMapClick(id: string): void {
    const st = this.stateForLocation(id)
    const tier = this.tierForLocation(id)
    if (st && tier !== 'none') this.selected.set(st.code)
  }

  protected zoomIn(): void {
    this.zoom.update((z) => Math.min(1.8, +(z + 0.2).toFixed(1)))
  }
  protected zoomOut(): void {
    this.zoom.update((z) => Math.max(1, +(z - 0.2).toFixed(1)))
  }

  protected setSelected(v: string): void {
    this.selected.set(v || null)
  }
  protected toggleAllStates(): void {
    this.allStates.update((v) => !v)
  }
  protected clearRegionFilter(): void {
    this.regionFilter.set(null)
  }
  protected clearDistributorFilters(): void {
    this.statusFilter.set('all')
    this.townFilter.set(null)
  }
  protected onCategoryChange(v: string): void {
    this.category.set(v)
  }
  protected toggleShowAllDbs(): void {
    this.showAllDbs.update((v) => !v)
  }
  protected toggleMoreFactors(): void {
    this.moreFactors.update((v) => !v)
  }
  protected navigateToPartner(name: string): void {
    this.router.navigate(['/partners'], { state: { query: name } })
  }
  protected navigateToPartners(): void {
    this.router.navigate(['/partners'])
  }
  protected navigateToGrievance(id: string): void {
    this.router.navigate(['/grievances'], { state: { openId: id } })
  }
  protected navigateToGrievances(): void {
    this.router.navigate(['/grievances'])
  }

  protected priorityTone(p: string): Tone {
    return p === 'high' ? 'crit' : p === 'medium' ? 'warn' : 'good'
  }
  protected tierForPct(pct: number): Tier {
    return pct >= 100 ? 'met' : pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low'
  }
  protected min100(v: number): number {
    return Math.min(100, v)
  }
  protected absNum(v: number): number {
    return Math.abs(v)
  }
  protected asIconName(name: string): IconName {
    return name as IconName
  }

  // ---- channel-type donut (screen-local React subcomponent, inlined as computed + methods) ----
  protected readonly donutCircumference = DONUT_C
  protected readonly donutSegments = computed<DonutSegment[]>(() => {
    const counts = this.channelCounts()
    const total = this.stateDbs().length
    let cursor = 0
    return counts.map((c) => {
      const frac = total ? c.count / total : 0
      const len = Math.max(0, frac * DONUT_C - (frac > 0 ? 2.5 : 0))
      const seg = { ...c, pct: Math.round(frac * 100), len, offset: -cursor * DONUT_C }
      cursor += frac
      return seg
    })
  })
  protected channelColor(type: string): string {
    return CHANNEL_COLOR[type] ?? 'var(--ink-mute)'
  }
  protected onChannelSelect(type: string): void {
    this.goToDistributors({ category: type, status: 'all', town: null })
  }
}
