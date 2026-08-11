import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent } from './ui'
import type { PillTone } from './ui'
import { IconComponent } from './ui/icons'
import type { IconName } from './ui/icons'
import { SparklineComponent } from './ui/Sparkline'
import type { GrievancePriority, GrievanceStatus } from '../mock/grievances'

export interface Profile360Grievance {
  id: string
  subject: string
  status: GrievanceStatus
  priority: GrievancePriority
  raisedOn: string
}

export interface Profile360KpiBreakdownRow { label: string; value: string; sub?: string }
export interface Profile360KPI {
  label: string; value: string; sub?: string; icon?: IconName; tone?: KpiTone
  /** when present, the tile becomes clickable and opens a "what makes up this number" popover */
  breakdown?: Profile360KpiBreakdownRow[]
}
export interface Profile360Section { title: string; rows: { label: string; value: string; icon?: IconName }[] }
export interface Profile360TimelineItem { title: string; note?: string; date?: string; by?: string; tone?: KpiTone }
type KpiTone = 'ai' | 'good' | 'warn' | 'crit' | 'neutral'

export interface Profile360Data {
  name: string
  color: string
  /** status pill shown next to the name (e.g. Active / Discontinued) */
  statusBadge?: { tone: PillTone; dot?: boolean; label: string }
  /** small chips under the name: type, location, partner id */
  metaChips?: { icon?: IconName; text: string }[]
  kpis: Profile360KPI[]
  overview: string
  /** grouped detail sections — a "Business Background" one and a "Contact & Registration" one are recognised */
  details?: Profile360Section[]
  contactVerified?: boolean
  timeline?: Profile360TimelineItem[]
  trend: number[]
  docs: { name: string; status: 'verified' | 'pending' | 'not_checked' }[]
  history: string[]
  agentLog: string[]
  grievances?: Profile360Grievance[]
  onOpenGrievance?: (id: string) => void
}

function computeInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('')
}

const findSection = (data: Profile360Data, needle: string) =>
  data.details?.find((s) => s.title.toLowerCase().includes(needle))

type Tab = 'overview' | 'business' | 'contact' | 'performance' | 'history' | 'documents'
const TABS: { id: Tab; label: string; ic: IconName }[] = [
  { id: 'overview', label: 'Overview', ic: 'dashboard' },
  { id: 'business', label: 'Business Details', ic: 'templates' },
  { id: 'contact', label: 'Contact & Registration', ic: 'partners' },
  { id: 'performance', label: 'Performance', ic: 'analytics' },
  { id: 'history', label: 'History & Notes', ic: 'list' },
  { id: 'documents', label: 'Documents', ic: 'documents' },
]

// A KPI tile that becomes clickable when a `breakdown` is supplied — clicking opens a modal
// showing what actually makes up the number, instead of it just sitting there unexplained.
@Component({
  selector: 'app-kpi-tile',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './KpiTile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiTileComponent {
  readonly k = input.required<Profile360KPI>()
  readonly showIcon = input(false)
  readonly opened = output<Profile360KPI>()

  protected readonly clickable = computed(() => !!this.k().breakdown?.length)
}

@Component({
  selector: 'app-detail-grid',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './DetailGrid.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailGridComponent {
  readonly rows = input.required<{ label: string; value: string; icon?: IconName }[]>()
}

@Component({
  selector: 'app-contact-card',
  standalone: true,
  imports: [CardComponent, PillComponent, DetailGridComponent],
  templateUrl: './ContactCard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactCardComponent {
  readonly data = input.required<Profile360Data>()
  protected readonly contact = computed(() => findSection(this.data(), 'contact'))
}

@Component({
  selector: 'app-timeline-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  templateUrl: './TimelineCard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineCardComponent {
  readonly data = input.required<Profile360Data>()
  readonly viewAll = output<void>()

  protected readonly timeline = computed(() => this.data().timeline ?? [])
}

@Component({
  selector: 'app-performance-card',
  standalone: true,
  imports: [CardComponent, SparklineComponent],
  templateUrl: './PerformanceCard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceCardComponent {
  readonly trend = input.required<number[]>()
}

@Component({
  selector: 'app-grievances-card',
  standalone: true,
  imports: [CardComponent, PillComponent],
  templateUrl: './GrievancesCard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrievancesCardComponent {
  readonly data = input.required<Profile360Data>()

  protected grvStatusPill(status: GrievanceStatus): { tone: 'good' | 'ai' | 'warn'; label: string } {
    return status === 'resolved' ? { tone: 'good', label: 'Resolved' }
      : status === 'in_progress' ? { tone: 'ai', label: 'In progress' }
      : { tone: 'warn', label: 'Open' }
  }

  protected grvPriorityPill(priority: GrievancePriority): { tone: 'crit' | 'warn' | 'neutral'; label: string } {
    return priority === 'high' ? { tone: 'crit', label: 'High' }
      : priority === 'medium' ? { tone: 'warn', label: 'Medium' }
      : { tone: 'neutral', label: 'Low' }
  }
}

/** Shared 360° profile — tabbed, used by Partners and the Leads distributor screen.
 *
 *  Profile360.css is attached with `encapsulation: None`: in the original React app it was just
 *  a plain global stylesheet import shared by several inline sub-components in this one file, and
 *  several of those sub-components are now their own child components (KpiTile, ContactCard,
 *  TimelineCard, PerformanceCard, GrievancesCard, DetailGrid) — Angular's default emulated
 *  encapsulation only scopes a stylesheet to elements in its OWN component's template, so it would
 *  silently fail to style anything rendered by those children. Turning encapsulation off restores
 *  the original's actually-global behavior instead of only styling half the view. */
@Component({
  selector: 'app-profile-360',
  standalone: true,
  imports: [
    ButtonComponent,
    CardComponent,
    ModalComponent,
    PillComponent,
    IconComponent,
    KpiTileComponent,
    DetailGridComponent,
    ContactCardComponent,
    TimelineCardComponent,
    PerformanceCardComponent,
    GrievancesCardComponent,
  ],
  templateUrl: './Profile360.html',
  styleUrl: './Profile360.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile360Component {
  readonly data = input.required<Profile360Data>()
  /** shows the "Ask copilot" header button — Angular has no way to introspect whether a caller
   *  bound the `askCopilot` output, so (unlike the original's `onAskCopilot &&`) visibility is an
   *  explicit flag rather than implied by the callback's presence. */
  readonly showAskCopilot = input(false)
  readonly askCopilot = output<void>()

  protected readonly tabs = TABS
  protected readonly tab = signal<Tab>('overview')
  protected readonly openKpi = signal<Profile360KPI | null>(null)
  protected readonly initials = computeInitials

  protected readonly business = computed(() => findSection(this.data(), 'background'))
  protected readonly contact = computed(() => findSection(this.data(), 'contact'))

  protected setTab(t: Tab): void {
    this.tab.set(t)
  }

  protected noop(): void {}

  protected docPill(status: 'verified' | 'pending' | 'not_checked'): { tone: 'good' | 'warn' | 'neutral'; dot: boolean; label: string } {
    return status === 'verified' ? { tone: 'good', dot: true, label: 'Verified' }
      : status === 'pending' ? { tone: 'warn', dot: true, label: 'Awaiting QC' }
      : { tone: 'neutral', dot: false, label: 'Not checked' }
  }

  protected pctShare(sub?: string): number | undefined {
    return sub && /^\d+%$/.test(sub) ? parseInt(sub, 10) : undefined
  }
}
