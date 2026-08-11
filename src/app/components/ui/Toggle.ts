import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'

@Component({
  selector: 'app-toggle',
  standalone: true,
  templateUrl: './Toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleComponent {
  readonly on = input.required<boolean>()
  readonly toggled = output<boolean>()

  protected handleClick(): void {
    this.toggled.emit(!this.on())
  }
}
