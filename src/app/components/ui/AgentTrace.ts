import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core'

export interface TraceLine {
  text: string
  tone?: 'ok' | 'bad' | 'muted' | 'accent'
}

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Reveals reasoning-trace lines one at a time (terminal style) to convey an
// agent "thinking". Deterministic; honors prefers-reduced-motion.
@Component({
  selector: 'app-agent-trace',
  standalone: true,
  templateUrl: './AgentTrace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentTraceComponent {
  readonly lines = input.required<TraceLine[]>()
  readonly lineDelay = input(620)
  readonly done = output<void>()

  private readonly count = signal(0)
  protected readonly streaming = computed(() => this.count() < this.lines().length)
  protected readonly visibleLines = computed(() => this.lines().slice(0, this.count()))

  constructor() {
    effect((onCleanup) => {
      const total = this.lines().length
      const delay = this.lineDelay()
      this.count.set(0)
      let notified = false

      if (reduced()) {
        this.count.set(total)
        notified = true
        this.done.emit()
        return
      }

      const timer = setInterval(() => {
        this.count.update((c) => {
          const next = c + 1
          if (next >= total) {
            clearInterval(timer)
            if (!notified) {
              notified = true
              this.done.emit()
            }
          }
          return Math.min(next, total)
        })
      }, delay)

      onCleanup(() => clearInterval(timer))
    })
  }
}
