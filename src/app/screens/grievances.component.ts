import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { ButtonComponent, PillComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { CATEGORY_TONE } from '../mock/grievances'
import type { Grievance, GrievancePriority, GrievanceStatus } from '../mock/grievances'
import { ROLE_BY_CODE } from '../mock/roles'
import { AppStore } from '../store'

type Filter = 'all' | GrievanceStatus

const STATUS_LABEL: Record<GrievanceStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

@Component({
  selector: 'app-grievances',
  standalone: true,
  imports: [ButtonComponent, PillComponent, IconComponent],
  templateUrl: './grievances.component.html',
  styleUrl: './grievances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrievancesComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  protected readonly STATUS_LABEL = STATUS_LABEL
  protected readonly CATEGORY_TONE = CATEGORY_TONE

  protected readonly filters: Filter[] = ['all', 'open', 'in_progress', 'resolved']
  protected readonly statuses: GrievanceStatus[] = ['open', 'in_progress', 'resolved']

  protected readonly filter = signal<Filter>('all')

  // deep-link support — other screens (e.g. GTM Coverage) can navigate here with a specific
  // grievance id in router state to open it directly instead of landing on the list. Captured
  // via getCurrentNavigation()?.extras.state in the field initializer (runs during the
  // constructor while the activating navigation is still in flight) — mirrors the React
  // screen's useLocation().state read.
  protected readonly openId = signal<string | null>(
    ((this.router.getCurrentNavigation()?.extras.state ?? null) as { openId?: string } | null)?.openId ?? null,
  )

  protected readonly counts = computed(() => {
    const grievances = this.store.grievances()
    return {
      open: grievances.filter((g) => g.status === 'open').length,
      in_progress: grievances.filter((g) => g.status === 'in_progress').length,
      resolved: grievances.filter((g) => g.status === 'resolved').length,
      overdue: grievances.filter((g) => g.isOverdue).length,
    }
  })

  protected readonly rows = computed(() => {
    const filter = this.filter()
    return this.store.grievances().filter((g) => filter === 'all' || g.status === filter)
  })

  protected readonly open = computed<Grievance | null>(() => {
    const openId = this.openId()
    return this.store.grievances().find((g) => g.id === openId) ?? null
  })

  protected readonly owner = computed(() => {
    const g = this.open()
    if (!g) return ''
    return ROLE_BY_CODE[g.ownerRole]?.label ?? g.ownerRole
  })

  protected readonly alreadyEmailed = computed(() => {
    const g = this.open()
    if (!g) return false
    return g.updates.some((u) => u.note.startsWith('Emailed distributor:'))
  })

  protected tabLabel(f: Filter): string {
    return f === 'all' ? 'All' : STATUS_LABEL[f]
  }

  protected statusTone(s: GrievanceStatus): Tone {
    return s === 'resolved' ? 'good' : s === 'in_progress' ? 'ai' : 'warn'
  }

  protected priorityTone(p: GrievancePriority): Tone {
    return p === 'high' ? 'crit' : p === 'medium' ? 'warn' : 'neutral'
  }

  protected priorityLabel(p: GrievancePriority): string {
    return p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low'
  }

  protected setFilter(f: Filter): void {
    this.filter.set(f)
  }

  protected openGrievance(id: string): void {
    this.openId.set(id)
  }

  protected back(): void {
    this.openId.set(null)
  }

  protected setStatus(id: string, status: GrievanceStatus): void {
    this.store.setGrievanceStatus(id, status)
  }

  protected emailDistributor(id: string): void {
    this.store.sendGrievanceUpdate(id)
  }

  protected askCopilot(): void {
    this.store.setCopilotOpen(true)
  }
}
