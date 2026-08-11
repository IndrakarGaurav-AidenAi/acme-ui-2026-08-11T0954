import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CardComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { ROLE_BY_CODE, DEMO_USERS } from '../mock/roles'
import { AppStore } from '../store'
import type { CaseMessage } from '../types'

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [FormsModule, CardComponent, PillComponent, IconComponent],
  templateUrl: './communication.component.html',
  styleUrl: './communication.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationComponent {
  protected readonly store = inject(AppStore)
  protected readonly draft = signal('')

  protected readonly thread = computed(() => {
    const threads = this.store.commThreads()
    return threads.find((t) => t.code === this.store.selectedThreadCode()) ?? threads[0]
  })

  protected readonly nextReplier = computed(() => this.thread().participants.find((m) => m.isNextReplier))

  protected avatarInitials(name: string): string {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  }

  protected avatarColor(roleCode: CaseMessage['authorRole']): string {
    return `var(${ROLE_BY_CODE[roleCode].colorVar})`
  }

  protected roleLabel(roleCode: CaseMessage['authorRole']): string {
    return ROLE_BY_CODE[roleCode].label
  }

  protected send(): void {
    const body = this.draft().trim()
    if (!body) return
    const viewingAs = this.store.viewingAs() ?? 'ase_asm'
    const me = DEMO_USERS[viewingAs]
    this.store.sendCommMessage(this.thread().code, { id: `n${Date.now()}`, authorRole: viewingAs, authorName: me.name, body })
    this.draft.set('')
  }
}
