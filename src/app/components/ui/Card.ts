import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './Card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly title = input<string>()
  readonly padLg = input(false)
  readonly extraClass = input('')
}
