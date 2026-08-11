import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { CardComponent, ButtonComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, CardComponent, ButtonComponent, IconComponent],
  templateUrl: './forbidden.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {}
