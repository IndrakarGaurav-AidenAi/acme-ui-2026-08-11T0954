import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type PillTone = 'good' | 'warn' | 'crit' | 'ai' | 'neutral'

@Component({
  selector: 'app-pill',
  standalone: true,
  templateUrl: './Pill.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillComponent {
  readonly tone = input<PillTone>('neutral')
  readonly dot = input(false)
}
