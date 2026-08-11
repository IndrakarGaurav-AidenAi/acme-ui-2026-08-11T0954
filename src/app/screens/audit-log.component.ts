import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore } from '../store'
import type { AuditEntry } from '../mock/audit'

const KIND_META: Record<AuditEntry['kind'], { label: string; icon: IconName; tone: 'ai' | 'good' | 'warn' }> = {
  ai: { label: 'AI Agent', icon: 'spark', tone: 'ai' },
  human: { label: 'User', icon: 'user', tone: 'good' },
  admin: { label: 'Admin', icon: 'shield', tone: 'warn' },
}
// Older/persisted sessions can carry an entry logged under a kind that predates the current
// type — fall back instead of crashing the whole page on an unrecognized value.
const FALLBACK_KIND_META = { label: 'User', icon: 'user' as IconName, tone: 'good' as const }
const PAGE_SIZE = 8

// Case-code entities (from Approvals/Documents) are worth a click-through; everything else
// (partner names, template names, email addresses) is display-only.
const CASE_ENTITY = /^(CMP|VND)-\d+/

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [ButtonComponent, IconComponent, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  protected readonly kind = signal<'all' | AuditEntry['kind']>('all')
  protected readonly query = signal('')
  protected readonly actorFilter = signal('all')
  protected readonly filtersOpen = signal(false)
  protected readonly page = signal(1)

  protected readonly actors = computed(() => Array.from(new Set(this.store.auditLog().map((e) => e.actor))).sort())

  protected readonly counts = computed(() => this.store.auditLog().reduce(
    (a, e) => { a[e.kind]++; return a },
    { ai: 0, human: 0, admin: 0 } as Record<AuditEntry['kind'], number>,
  ))

  protected readonly todayCount = computed(() => this.store.auditLog().filter((e) => this.splitWhen(e.when).date === this.todayDateKey()).length)

  protected readonly rows = computed(() => {
    const kind = this.kind()
    const actorFilter = this.actorFilter()
    const q = this.query().trim().toLowerCase()
    return this.store.auditLog().filter((e) =>
      (kind === 'all' || e.kind === kind) &&
      (actorFilter === 'all' || e.actor === actorFilter) &&
      (q === '' || [e.actor, e.action, e.entity].some((v) => v.toLowerCase().includes(q))))
  })

  protected readonly activeFilterCount = computed(() => (this.actorFilter() !== 'all' ? 1 : 0))

  protected readonly showingFrom = computed(() => (this.rows().length === 0 ? 0 : (this.curPage() - 1) * PAGE_SIZE + 1))
  protected readonly showingTo = computed(() => Math.min(this.curPage() * PAGE_SIZE, this.rows().length))

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)))
  protected readonly curPage = computed(() => Math.min(this.page(), this.totalPages()))
  protected readonly pageRows = computed(() => {
    const curPage = this.curPage()
    return this.rows().slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)
  })

  // Group the current page's (already newest-first) rows into day sections.
  protected readonly groups = computed(() => {
    const out: { date: string; entries: AuditEntry[] }[] = []
    for (const e of this.pageRows()) {
      const { date } = this.splitWhen(e.when)
      const last = out[out.length - 1]
      if (last && last.date === date) last.entries.push(e)
      else out.push({ date, entries: [e] })
    }
    return out
  })

  protected readonly STATS = computed<{ label: string; value: number; sub: string; icon: IconName; tone: string }[]>(() => {
    const counts = this.counts()
    const todayCount = this.todayCount()
    return [
      { label: 'Total events', value: this.store.auditLog().length, sub: 'All time', icon: 'list', tone: 'ai' },
      { label: 'AI agent actions', value: counts.ai, sub: 'All time', icon: 'spark', tone: 'ai' },
      { label: 'Human actions', value: counts.human, sub: 'All time', icon: 'user', tone: 'good' },
      { label: 'Today', value: todayCount, sub: todayCount > 0 ? todayCount + ' event' + (todayCount > 1 ? 's' : '') + ' today' : 'No events today', icon: 'clock', tone: 'warn' },
    ]
  })

  constructor() {
    // Mirrors the React screen's `useEffect(() => setPage(1), [kind, query, actorFilter])` —
    // reset to page 1 whenever a filter changes.
    effect(() => {
      this.kind()
      this.query()
      this.actorFilter()
      this.page.set(1)
    })
  }

  protected kindMeta(kind: AuditEntry['kind']): { label: string; icon: IconName; tone: 'ai' | 'good' | 'warn' } {
    return KIND_META[kind] ?? FALLBACK_KIND_META
  }

  protected isCaseEntity(entity: string): boolean {
    return CASE_ENTITY.test(entity)
  }

  protected goToApprovals(): void {
    this.router.navigate(['/approvals'])
  }

  // `when` is always "D Mon, HH:MM" (24h, see store.ts auditStamp) — split into a date key
  // for day-grouping and a 12-hour time for the row itself.
  protected splitWhen(when: string): { date: string; time: string } {
    const i = when.lastIndexOf(',')
    if (i === -1) return { date: when, time: '' }
    const date = when.slice(0, i).trim()
    const [hStr, m] = when.slice(i + 1).trim().split(':')
    let h = parseInt(hStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return { date, time: String(h).padStart(2, '0') + ':' + (m ?? '00') + ' ' + ampm }
  }

  private todayDateKey(): string {
    const d = new Date()
    return d.getDate() + ' ' + MONTHS[d.getMonth()]
  }

  // Displayed group header: "2 JUL 2026" — the mock's `when` carries no year, so the current
  // year is assumed (fine for a single-session demo log).
  protected dayHeader(dateKey: string): string {
    return (dateKey + ' ' + new Date().getFullYear()).toUpperCase()
  }

  protected downloadCsv(): void {
    const entries = this.rows()
    const header = ['When', 'Actor', 'Kind', 'Action', 'Entity']
    const rowsOut = entries.map((e) => [e.when, e.actor, this.kindMeta(e.kind).label, e.action, e.entity])
    const csv = [header, ...rowsOut].map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit_log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Compact page-number list with ellipsis (1 2 3 … 9), same shape as Documents' pager.
  protected pageList(total: number, cur: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const out: (number | '…')[] = [1]
    const start = Math.max(2, cur - 1)
    const end = Math.min(total - 1, cur + 1)
    if (start > 2) out.push('…')
    for (let i = start; i <= end; i++) out.push(i)
    if (end < total - 1) out.push('…')
    out.push(total)
    return out
  }

  protected resetFilters(): void {
    this.actorFilter.set('all')
  }

  protected resetAllFilters(): void {
    this.kind.set('all')
    this.query.set('')
    this.resetFilters()
  }

  protected setKind(k: 'all' | AuditEntry['kind']): void {
    this.kind.set(k)
  }

  protected setActorFilter(a: string): void {
    this.actorFilter.set(a)
  }

  protected toggleFiltersOpen(): void {
    this.filtersOpen.set(!this.filtersOpen())
  }

  protected setPage(p: number): void {
    this.page.set(p)
  }
}
