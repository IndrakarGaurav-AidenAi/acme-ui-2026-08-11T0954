import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent, ToggleComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore } from '../store'
import { ANALYTICS_SECTIONS, DATA_ENTITIES, DEFAULT_ACCESS_BY_ROLE, ROLES, ROLE_BY_CODE } from '../mock/roles'
import { NAV } from '../components/shell/nav'
import type { DataScope, RoleCode, ScreenPermission, User } from '../types'

type AccessMap = Record<string, ScreenPermission>
type FormState = { name: string; email: string; roleCode: RoleCode; region: string; access: AccessMap }
const EMPTY_FORM: FormState = { name: '', email: '', roleCode: 'ase_asm', region: '', access: { ...DEFAULT_ACCESS_BY_ROLE.ase_asm } }

const ADMIN_TABS = [
  { key: 'team', label: 'Team', ic: 'partners' },
  { key: 'access', label: 'Screen access', ic: 'monitor' },
  { key: 'data', label: 'Data access', ic: 'lock' },
  { key: 'settings', label: 'Platform settings', ic: 'settings' },
] as const

// Icon shown in each persona's colored avatar box on the Data access panel.
const ROLE_ICON: Record<RoleCode, IconName> = {
  ase_asm: 'partners',
  finance: 'dollar',
  channel_dev: 'wrench',
  mdm: 'shield',
  leadership: 'analytics',
  admin: 'settings',
}

const DATA_SCOPE_LABEL: Record<DataScope, string> = { all: 'All data', own_region: 'Own region only', own_state: 'Own state only' }
const DATA_SCOPE_HINT: Record<DataScope, string> = {
  all: 'Sees every record, regardless of state.',
  own_region: 'Only records whose state falls in the same macro-region as this persona\'s users.',
  own_state: 'Only records in the exact same state as this persona\'s users — the tightest setting.',
}
type AdminTab = (typeof ADMIN_TABS)[number]['key']

const DATA_SCOPES: DataScope[] = ['all', 'own_region', 'own_state']

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, ButtonComponent, CardComponent, ModalComponent, PillComponent, ToggleComponent, IconComponent],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  protected readonly ADMIN_TABS = ADMIN_TABS
  protected readonly ROLES = ROLES
  protected readonly ROLE_BY_CODE = ROLE_BY_CODE
  protected readonly ROLE_ICON = ROLE_ICON
  protected readonly DATA_ENTITIES = DATA_ENTITIES
  protected readonly ANALYTICS_SECTIONS = ANALYTICS_SECTIONS
  protected readonly DATA_SCOPE_LABEL = DATA_SCOPE_LABEL
  protected readonly DATA_SCOPE_HINT = DATA_SCOPE_HINT
  protected readonly DATA_SCOPES = DATA_SCOPES
  protected readonly navItems = NAV.flatMap((g) => g.items)

  protected readonly tab = signal<AdminTab>('team')
  protected readonly requireDoc = signal(false)
  protected readonly autoNotify = signal(true)

  protected readonly modalOpen = signal(false)
  protected readonly editingId = signal<string | null>(null)
  protected readonly form = signal<FormState>(EMPTY_FORM)

  protected openCreate(): void {
    this.editingId.set(null)
    this.form.set(EMPTY_FORM)
    this.modalOpen.set(true)
  }

  protected openEdit(u: User): void {
    this.editingId.set(u.id)
    this.form.set({
      name: u.name,
      email: u.email,
      roleCode: u.roleCode,
      region: u.region ?? '',
      access: u.access ?? { ...DEFAULT_ACCESS_BY_ROLE[u.roleCode] },
    })
    this.modalOpen.set(true)
  }

  protected patchForm(patch: Partial<FormState>): void {
    this.form.update((f) => ({ ...f, ...patch }))
  }

  protected changeRole(roleCode: RoleCode): void {
    // Resetting to that persona's default permissions keeps the grid honest — an admin who
    // reassigns someone's role sees the permissions that go with it, and can still
    // fine-tune from there before saving.
    this.form.update((f) => ({ ...f, roleCode, access: { ...DEFAULT_ACCESS_BY_ROLE[roleCode] } }))
  }

  protected permFor(path: string): ScreenPermission {
    return this.form().access[path] ?? { view: false, manage: false }
  }

  protected setPermission(path: string, patch: Partial<ScreenPermission>): void {
    const current = this.form().access[path] ?? { view: false, manage: false }
    const next = { ...current, ...patch }
    // Manage implies View — can't act on a screen you can't open.
    if (next.manage) next.view = true
    this.form.update((f) => ({ ...f, access: { ...f.access, [path]: next } }))
  }

  protected save(): void {
    const f = this.form()
    if (!f.name.trim() || !f.email.trim()) return
    const editingId = this.editingId()
    if (editingId) {
      this.store.updateUser(editingId, { ...f })
    } else {
      this.store.addUser({ ...f, isActive: true })
    }
    // The sidebar is driven by persona (moduleAccess), not by an individual login — so a
    // screen unticked here has to flow into that persona's visible-screens list too, or the
    // toggle looks like it "saved" but nothing changes when you switch to that persona.
    const visiblePaths = Object.entries(f.access).filter(([, p]) => p.view).map(([path]) => path)
    this.store.setModuleAccessForRole(f.roleCode, visiblePaths)
    this.modalOpen.set(false)
  }

  // AccessSummary — screen-local React subcomponent in the source, inlined here as a method.
  protected accessSummary(access?: AccessMap): { viewCount: number; manageCount: number } {
    const perms = Object.values(access ?? {})
    return {
      viewCount: perms.filter((p) => p.view).length,
      manageCount: perms.filter((p) => p.manage).length,
    }
  }

  protected isDashboardScreen(path: string): boolean {
    return path === '/dashboard'
  }

  protected screenChecked(roleCode: RoleCode, path: string): boolean {
    return this.isDashboardScreen(path) || (this.store.moduleAccess()[roleCode] ?? []).includes(path)
  }

  protected regionsFor(roleCode: RoleCode): string[] {
    return Array.from(new Set(
      this.store.users().filter((u) => u.roleCode === roleCode).map((u) => u.region).filter((x): x is string => !!x),
    ))
  }

  protected statesFor(roleCode: RoleCode): string[] {
    return Array.from(new Set(
      this.store.users().filter((u) => u.roleCode === roleCode).map((u) => u.state).filter((x): x is string => !!x),
    ))
  }

  protected regionStateLabel(roleCode: RoleCode): string {
    const regions = this.regionsFor(roleCode)
    const states = this.statesFor(roleCode)
    let label = regions.length ? 'Region: ' + regions.join(', ') : 'No region set'
    if (states.length) label += ' · State: ' + states.join(', ')
    return label
  }

  protected goAuditLog(): void {
    this.router.navigate(['/audit-log'])
  }
}
