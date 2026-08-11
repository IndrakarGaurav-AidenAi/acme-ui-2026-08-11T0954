import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core'
import { AgentBadgeComponent, AiTextComponent, StreamingTextComponent } from '../ui'
import { IconComponent } from '../ui/icons'
import { answerFor, suggestedPrompts } from '../../lib/copilot'
import { AppStore } from '../../store'
import { CopilotInputComponent } from './CopilotInput'

interface Turn { role: 'user' | 'ai'; text: string }
const COPILOT_LABEL = 'Copilot'

@Component({
  selector: 'app-copilot',
  standalone: true,
  imports: [AgentBadgeComponent, AiTextComponent, StreamingTextComponent, IconComponent, CopilotInputComponent],
  templateUrl: './Copilot.html',
  styleUrl: './Copilot.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopilotComponent {
  protected readonly store = inject(AppStore)
  protected readonly COPILOT_LABEL = COPILOT_LABEL

  protected readonly turns = signal<Turn[]>([
    { role: 'ai', text: 'Hi — I\'m your Copilot. Ask me about any case (try CMP-2291), distributor, territory, document, approval or metric — or just say "catch me up on today".' },
  ])

  // copilotAgent still exists on the store so other screens can deep-link into a topic,
  // but the copilot itself is one generalist — it answers anything in scope, no picker.
  protected readonly suggestions = computed(() => suggestedPrompts(this.store.copilotAgent(), this.store.viewingAs() ?? 'ase_asm'))

  constructor() {
    // Questions queued from other screens (e.g. the dashboard's "View full insight"). There's no
    // dependency array with signals — effect() just re-runs whenever a signal it reads changes,
    // so this reads copilotAsk() first and early-returns on null. clearCopilotAsk() below sets it
    // back to null, which re-triggers the effect once more but hits the same early return —
    // same net behavior as the original useEffect([pendingAsk]).
    effect(() => {
      const pending = this.store.copilotAsk()
      if (!pending) return
      this.ask(pending)
      this.store.clearCopilotAsk()
    })
  }

  protected ask(q: string): void {
    if (!q.trim()) return
    const agent = this.store.copilotAgent()
    this.turns.update((t) => [...t, { role: 'user', text: q }, { role: 'ai', text: answerFor(agent, q) }])
  }
}
