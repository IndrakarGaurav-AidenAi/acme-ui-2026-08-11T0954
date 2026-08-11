import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core'

// The chat dock's text entry — its own component (as in the original) because it owns genuinely
// local draft state that must clear right after every send without re-rendering the whole dock.
@Component({
  selector: 'app-copilot-input',
  standalone: true,
  templateUrl: './CopilotInput.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopilotInputComponent {
  readonly sent = output<string>()

  protected readonly v = signal('')

  protected onInput(e: Event): void {
    this.v.set((e.target as HTMLInputElement).value)
  }

  protected onSubmit(e: Event): void {
    e.preventDefault()
    this.sent.emit(this.v())
    this.v.set('')
  }
}
