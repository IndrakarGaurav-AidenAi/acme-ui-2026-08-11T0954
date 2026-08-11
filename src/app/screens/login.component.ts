import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent } from '../components/ui'
import { BrandMarkComponent } from '../components/BrandMark'
import { LoginChatWidgetComponent } from '../components/login-chat/LoginChatWidget'
import { ROLES, DEMO_USERS } from '../mock/roles'
import { AppStore } from '../store'
import type { RoleCode } from '../types'
import { environment } from '../../environments/environment'

// The agent pipeline shown in the hero — each stage lights up in sequence.
const PIPELINE: { name: string; sub: string; rt: string }[] = [
  { name: 'Intake Agent', sub: 'parses & de-dupes applications', rt: '77ms' },
  { name: 'Recommendation Engine', sub: 'ranks candidates by fit', rt: '92ms' },
  { name: 'Evaluation Agent', sub: 'scores against policy matrix', rt: '61ms' },
  { name: 'Routing & Compliance', sub: 'flags & routes edge cases', rt: '48ms' },
  { name: 'Communication Agent', sub: 'drafts partner comms', rt: '55ms' },
]

const HERO_STATS: [string, string][] = [
  ['6', 'live agents'],
  ['9.1×', 'faster intake'],
  ['100%', 'audit trail'],
]

// Matches the seed password in backend/users.py — rotate both together.
const DEMO_PASSWORD = 'Rcpl@2026'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ButtonComponent, BrandMarkComponent, LoginChatWidgetComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // module-level constants, exposed for the template
  protected readonly PIPELINE = PIPELINE
  protected readonly HERO_STATS = HERO_STATS
  protected readonly ROLES = ROLES

  protected readonly role = signal<RoleCode>('ase_asm')
  protected readonly email = signal(DEMO_USERS.ase_asm.email)
  protected readonly password = signal(DEMO_PASSWORD)
  protected readonly showPw = signal(false)
  protected readonly remember = signal(true)
  protected readonly error = signal<string | null>(null)
  protected readonly loading = signal(false)

  protected pickRole(r: RoleCode): void {
    this.role.set(r)
    this.email.set(DEMO_USERS[r].email)
    this.password.set(DEMO_PASSWORD)
    this.error.set(null)
  }

  protected onEmailChange(value: string): void {
    this.email.set(value)
    this.error.set(null)
  }

  protected onPasswordChange(value: string): void {
    this.password.set(value)
    this.error.set(null)
  }

  protected togglePw(): void {
    this.showPw.set(!this.showPw())
  }

  protected selectedRoleLabel(): string {
    return this.ROLES.find((r) => r.code === this.role())?.label ?? ''
  }

  protected async submit(): Promise<void> {
    const email = this.email()
    const password = this.password()
    if (!email.trim() || !password.trim()) { this.error.set('Enter your email and password to continue.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { this.error.set('That doesn\'t look like a valid email address.'); return }
    this.error.set(null)
    this.loading.set(true)
    try {
      const res = await fetch(environment.apiBaseUrl + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        this.error.set(body?.message ?? 'Sign-in failed — check your email and password.')
        this.loading.set(false)
        return
      }
      const data = await res.json()
      this.store.login({ token: data.accessToken, user: data.user })
      this.router.navigate(['/dashboard'])
    } catch {
      const target = environment.apiBaseUrl || 'the backend'
      this.error.set(`Can't reach the authentication service at ${target} — make sure it's running and reachable.`)
      this.loading.set(false)
    }
  }
}
