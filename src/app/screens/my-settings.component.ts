import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonComponent, PillComponent, ToggleComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore, slaLabelFromHours } from '../store'
import { ROLE_BY_CODE, DEMO_USERS } from '../mock/roles'

const PROVIDERS: { id: 'gmail' | 'outlook'; label: string; color: string; domain: string; blurb: string }[] = [
  { id: 'gmail', label: 'Gmail', color: '#EA4335', domain: 'gmail.com',
    blurb: 'Connect your Gmail account to let the Intake Agent monitor and draft candidate profiles.' },
  { id: 'outlook', label: 'Outlook', color: '#0A63C2', domain: 'outlook.com',
    blurb: 'Connect your Outlook mailbox so the Intake Agent can watch and draft from it.' },
]

const SECTIONS: { id: string; label: string; ic: IconName }[] = [
  { id: 'inbox', label: 'Inbox Integration', ic: 'mail' },
  { id: 'agent', label: 'AI Agent Settings', ic: 'robot' },
  { id: 'sla', label: 'SLA Timer', ic: 'clock' },
  { id: 'automation', label: 'Automation', ic: 'bolt' },
  { id: 'notifications', label: 'Notifications', ic: 'bell' },
  { id: 'security', label: 'Security', ic: 'shield' },
  { id: 'account', label: 'Account', ic: 'user' },
  { id: 'activity', label: 'Activity Log', ic: 'list' },
]
// SLA windows an ASE/ASM can pick between — this drives how long a newly flagged/routed
// case gets before Dashboard/Approvals count it overdue.
const SLA_PRESETS = [4, 8, 24, 48, 72]

const initials = (name: string) => name.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

@Component({
  selector: 'app-my-settings',
  standalone: true,
  imports: [FormsModule, ButtonComponent, PillComponent, ToggleComponent, IconComponent],
  templateUrl: './my-settings.component.html',
  styleUrl: './my-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySettingsComponent {
  protected readonly store = inject(AppStore)

  protected readonly PROVIDERS = PROVIDERS
  protected readonly SLA_PRESETS = SLA_PRESETS

  protected readonly viewingAs = computed(() => this.store.viewingAs() ?? 'ase_asm')
  protected readonly role = computed(() => ROLE_BY_CODE[this.viewingAs()])
  protected readonly user = computed(() => DEMO_USERS[this.viewingAs()])
  protected readonly isAseAsm = computed(() => this.viewingAs() === 'ase_asm')
  protected readonly sections = computed(() => SECTIONS.filter((s) => s.id !== 'sla' || this.isAseAsm()))

  // AI-agent behaviour is presentation-only for the prototype — kept in local state.
  protected readonly active = signal('inbox')
  protected readonly confidence = signal(85)
  protected readonly draftReplies = signal(true)
  protected readonly escalate = signal(true)

  // "Remaining sections" simple toggles — each mirrors an independent local useState in the
  // source (screen-local SimpleToggle subcomponent, inlined here as one signal per instance).
  protected readonly autoClearOn = signal(true)
  protected readonly nudgeStalledOn = signal(true)
  protected readonly weeklyDigestOn = signal(false)
  protected readonly newIntakeOn = signal(true)
  protected readonly approvalsWaitingOn = signal(true)
  protected readonly flaggedFinanceOn = signal(true)
  protected readonly twoFactorOn = signal(true)
  protected readonly signInAlertsOn = signal(true)

  protected readonly connectedLabel = computed(() => {
    const provider = this.store.inboxProvider()
    return provider ? PROVIDERS.find((p) => p.id === provider)?.label ?? null : null
  })

  protected initials(name: string): string {
    return initials(name)
  }

  protected displayName(name: string): string {
    return name === 'R. Malhotra' ? 'Rahul Malhotra' : name
  }

  protected go(id: string): void {
    this.active.set(id)
    document.getElementById('ms-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  protected connectProvider(p: { id: 'gmail' | 'outlook'; domain: string }): void {
    this.store.connectInbox(p.id, 'r.malhotra@' + p.domain)
  }

  protected slaPresetLabel(h: number): string {
    return slaLabelFromHours(h).replace(' left', '')
  }

  protected slaLabel(hours: number): string {
    return slaLabelFromHours(hours)
  }

  protected onSlaHoursChange(value: number): void {
    this.store.setSlaHours(Math.max(1, Math.min(168, value || 1)))
  }
}
