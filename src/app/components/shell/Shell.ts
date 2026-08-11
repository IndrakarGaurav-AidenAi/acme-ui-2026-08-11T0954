import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { DOCUMENT, Location } from '@angular/common'
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { filter } from 'rxjs'
import { NAV, LABEL_BY_PATH } from './nav'
import { LoginChatWidgetComponent } from '../login-chat/LoginChatWidget'
import { BrandMarkComponent } from '../BrandMark'
import { IconComponent } from '../ui/icons'
import { AppStore } from '../../store'
import { ROLES, ROLE_BY_CODE, DEMO_USERS } from '../../mock/roles'
import { EXTRACTIONS, unprocessedIntakeCount } from '../../mock/intake'
import type { Extraction } from '../../mock/intake'
import type { RoleCode, Scenario } from '../../types'
import { apiGet } from '../../lib/api'

// Path only, no query string/fragment — the equivalent of React Router's `useLocation().pathname`
// against Angular Router's `url` / `NavigationEnd.urlAfterRedirects`, either of which can carry a
// `?query` or `#fragment` suffix that `.pathname` never had.
const pathOnly = (url: string): string => url.split(/[?#]/)[0]

function sectionLabel(path: string): string {
  if (path.startsWith('/new-application')) return 'New Application'
  return 'Dashboard'
}

const SCENARIOS: Scenario[] = ['clean', 'flagged']
// Detail routes reachable from within modules (not in the sidebar) bypass the access guard below.
// '/forbidden' is exempt too — it isn't part of any persona's moduleAccess (it's not a real
// module), and unlike the original React version — where RequireRole rendered Forbidden in place
// without changing the URL — it's now a real routed destination (see components/auth/RequireRole.ts),
// so it must be reachable on its own instead of immediately bouncing back to /dashboard.
const EXEMPT_ROUTES = ['/distributor', '/intake/', '/forbidden']

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, BrandMarkComponent, LoginChatWidgetComponent],
  templateUrl: './Shell.html',
  styleUrl: './Shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)
  private readonly location = inject(Location)
  private readonly document = inject(DOCUMENT)

  protected readonly ROLES = ROLES
  protected readonly SCENARIOS = SCENARIOS

  private readonly notifRef = viewChild<ElementRef<HTMLElement>>('notifRef')
  protected readonly notifOpen = signal(false)

  // Keeps EXTRACTIONS (and so the Intake Inbox badge below) live regardless of which screen is
  // open — IntakeInbox's own poll only runs while that screen is mounted, but the sidebar is
  // mounted the whole session, so the badge needs its own independent refresh. EXTRACTIONS is a
  // plain mutable module object, not a signal, so this tick exists purely to force
  // liveCountByPath to recompute once a poll actually changes it — the same role the original's
  // unused `[, setIntakeTick]` state slot played.
  private readonly intakeTick = signal(0)

  // Router.url is synchronous but not itself reactive; NavigationEnd is the event that fires once
  // a navigation actually completes. Turning that stream into a signal (falling back to the
  // synchronous router.url before the first event ever fires) is what makes `currentPath` below
  // re-derive on every route change — the reactive equivalent of React Router's
  // `useLocation().pathname`.
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null },
  )
  protected readonly currentPath = computed(() => pathOnly(this.navigationEnd()?.urlAfterRedirects ?? this.router.url))

  protected readonly viewingAs = computed<RoleCode>(() => this.store.viewingAs() ?? 'ase_asm')

  private readonly createdLeadNames = computed(() => new Set(
    this.store.candidates().filter((c) => c.userCreated).map((c) => c.name.toLowerCase()),
  ))
  private readonly myLeadsCount = computed(() => {
    const viewingAs = this.viewingAs()
    return this.store.candidates().filter((c) =>
      c.userCreated && c.stage !== 'active' && (viewingAs !== 'ase_asm' || c.createdBy === viewingAs)).length
  })
  private readonly myApprovalsCount = computed(() => {
    const viewingAs = this.viewingAs()
    return this.store.flaggedCases().filter((c) => c.status === 'flagged' && (c.ownerRole === viewingAs || viewingAs === 'admin')).length
  })
  private readonly myCommsCount = computed(() =>
    this.store.commThreads().filter((t) => t.participants.some((m) => m.isNextReplier)).length)
  private readonly myGrievancesCount = computed(() =>
    this.store.grievances().filter((g) => g.status !== 'resolved').length)

  // Overrides NAV's static placeholder counts with the real, live numbers — computed once here
  // instead of scattered per-item, so every badge stays provably tied to what its own screen lists.
  protected readonly liveCountByPath = computed<Partial<Record<string, number>>>(() => {
    this.intakeTick()
    return {
      '/intake-inbox': unprocessedIntakeCount(this.store.processedIntakeIds(), this.createdLeadNames()),
      '/leads': this.myLeadsCount(),
      '/approvals': this.myApprovalsCount(),
      '/communication': this.myCommsCount(),
      '/grievances': this.myGrievancesCount(),
    }
  })

  // Role-targeted notifications (e.g. shortlist hand-offs addressed to Trade Marketing /
  // Channel Development) only show to that persona; untargeted ones show to everyone.
  protected readonly notifications = computed(() => {
    const viewingAs = this.viewingAs()
    return this.store.notifications().filter((n) => !n.forRole || n.forRole === viewingAs)
  })
  protected readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length)

  protected readonly role = computed(() => ROLE_BY_CODE[this.viewingAs()])
  protected readonly user = computed(() => DEMO_USERS[this.viewingAs()])
  protected readonly current = computed(() => LABEL_BY_PATH[this.currentPath()] ?? sectionLabel(this.currentPath()))

  private readonly allowed = computed(() => this.store.moduleAccess()[this.viewingAs()] ?? [])
  protected readonly groups = computed(() => {
    const allowed = this.allowed()
    return NAV
      .map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.to)) }))
      .filter((g) => g.items.length > 0)
  })

  constructor() {
    // Live intake-count poll — matches the backend's own IMAP poll cadence (INTAKE_POLL_SECONDS,
    // default 10s) so a freshly-captured email shows up here without an extra ~20s on top of that
    // wait. No signal is read in this effect body, so — like the original's `[]` dependency array
    // — it runs exactly once and never re-fires. Same setInterval + onCleanup pattern as
    // lib/useStreamingText.ts.
    effect((onCleanup) => {
      let alive = true
      const pull = async () => {
        try {
          const items = await apiGet<Extraction[]>('/api/intake', this.store.authToken())
          let changed = false
          for (const it of items) {
            const existing = EXTRACTIONS[it.id]
            if (!existing || JSON.stringify(existing) !== JSON.stringify(it)) { EXTRACTIONS[it.id] = it; changed = true }
          }
          if (changed && alive) this.intakeTick.update((n) => n + 1)
        } catch { /* server not running — badge falls back to whatever EXTRACTIONS already has */ }
      }
      void pull()
      const t = setInterval(pull, 8000)
      onCleanup(() => { alive = false; clearInterval(t) })
    })

    // Closes the notifications dropdown on an outside click — real `document` listener add/remove
    // via onCleanup, same pattern as Modal.ts. Reading notifOpen() first (before the early return)
    // is what keeps the effect subscribed to it even though the body exits immediately while closed.
    effect((onCleanup) => {
      if (!this.notifOpen()) return
      const onClick = (e: MouseEvent) => {
        const el = this.notifRef()?.nativeElement
        if (el && !el.contains(e.target as Node)) this.notifOpen.set(false)
      }
      this.document.addEventListener('mousedown', onClick)
      onCleanup(() => this.document.removeEventListener('mousedown', onClick))
    })

    // If the active persona can't see the current module, send them to their dashboard.
    effect(() => {
      const path = this.currentPath()
      const allowed = this.allowed()
      const exempt = path === '/dashboard' || EXEMPT_ROUTES.some((r) => path.startsWith(r))
      if (!exempt && !allowed.includes(path)) {
        void this.router.navigate(['/dashboard'], { replaceUrl: true })
      }
    })
  }

  protected initials(name: string): string {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  }

  protected goBack(): void {
    this.location.back()
  }

  protected onLogout(): void {
    this.store.logout()
    void this.router.navigate(['/login'])
  }

  protected onViewingAsChange(e: Event): void {
    this.store.setViewingAs((e.target as HTMLSelectElement).value as RoleCode)
  }

  protected openNotification(id: string, href: string): void {
    this.store.markNotificationRead(id)
    this.notifOpen.set(false)
    void this.router.navigate([href])
  }
}
