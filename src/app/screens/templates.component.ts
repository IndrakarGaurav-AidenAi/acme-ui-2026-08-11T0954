import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core'
import { PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { PARTNER_TYPE_COLOR, PARTNER_TYPES } from '../mock/templates'
import { AppStore } from '../store'
import { listPartnerTypes } from '../services/partner-types.service'
import type { BackendPartnerType } from '../services/partner-types.service'
import type { PartnerType, PartnerTypeCode } from '../types'

function partnerTypeFromBackend(b: BackendPartnerType): PartnerType {
  return { code: b.code as PartnerTypeCode, label: b.label, isActive: b.isActive, documents: b.documents, workflow: b.workflow }
}

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [PillComponent, IconComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesComponent implements OnInit {
  private readonly store = inject(AppStore)
  readonly partnerTypeColor = PARTNER_TYPE_COLOR

  // Seeded with the mock list for an instant first render, then overlaid with live server data —
  // same resilient pattern as the Intake Inbox's pull(). This screen has no edit UI wired to
  // PARTNER_TYPES today, so this is a read-only overlay (no mutation sync needed).
  readonly partnerTypes = signal<PartnerType[]>(PARTNER_TYPES)

  ngOnInit(): void {
    listPartnerTypes(this.store.authToken())
      .then((server) => {
        const mapped = server.map(partnerTypeFromBackend)
        const serverCodes = new Set(mapped.map((t) => t.code))
        this.partnerTypes.set([...mapped, ...PARTNER_TYPES.filter((t) => !serverCodes.has(t.code))])
      })
      .catch(() => { /* backend not running/reachable — keep mock data */ })
  }
}
