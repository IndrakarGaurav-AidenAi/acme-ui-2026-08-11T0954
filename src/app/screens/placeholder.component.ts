import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { CardComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'

/** Temporary module scaffold — real module screens land in later build steps. */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CardComponent, IconComponent],
  templateUrl: './placeholder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderComponent {
  title = input.required<string>()
  blurb = input.required<string>()
  bullets = input.required<string[]>()
}
