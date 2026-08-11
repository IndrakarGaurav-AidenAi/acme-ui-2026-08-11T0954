import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ButtonComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { AppStore } from '../store'
import type { ReportItem } from '../store'

// Prototype export — produces a real downloadable file so "share or export" actually works.
function downloadReport(r: ReportItem) {
  const body = [
    'Acme Distribution Partner Platform',
    `Report: ${r.name}`,
    `Generated: ${r.date}`,
    `Format: ${r.format}`,
    '',
    '(Prototype export — in the live platform this is the full formatted document.)',
  ].join('\n')
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${r.name.replace(/[^a-z0-9]+/gi, '_')}.${r.format === 'Excel' ? 'csv' : 'txt'}`
  a.click()
  URL.revokeObjectURL(url)
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ButtonComponent, PillComponent, IconComponent],
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  protected readonly store = inject(AppStore)

  generate(): void {
    this.store.addReport({ name: 'Coverage & AI-performance snapshot', format: 'PDF' })
  }

  downloadReport(r: ReportItem): void {
    downloadReport(r)
  }
}
