import { ChangeDetectionStrategy, Component, input } from '@angular/core'

@Component({
  selector: 'app-agent-badge',
  standalone: true,
  templateUrl: './AgentBadge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentBadgeComponent {
  readonly solid = input(false)
}
