import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './Button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<'primary' | 'ghost' | 'text'>('primary')
  readonly size = input<'md' | 'sm'>('md')
  readonly disabled = input(false)
  readonly type = input<'button' | 'submit'>('button')
}
