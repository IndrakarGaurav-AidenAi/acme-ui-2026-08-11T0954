import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'app-confidence-pill',
  standalone: true,
  templateUrl: './ConfidencePill.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfidencePillComponent {
  readonly pct = input.required<number>()
}
