import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AgentBadgeComponent, ButtonComponent, CardComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { AGENTS } from '../mock/agents'
import { AppStore } from '../store'

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [RouterLink, CardComponent, PillComponent, ButtonComponent, AgentBadgeComponent, IconComponent],
  templateUrl: './agents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsComponent {
  protected readonly store = inject(AppStore)
  protected readonly agents = AGENTS
}
