// Full-page "View full document" destination — opened in a new tab from IntakeReview's Source
// modal so the same genuine highlight (see PdfHighlightViewer, backend/email_service/pdf_locate.py)
// carries over instead of dropping back to a blind, unannotated copy of the real file.
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { PdfHighlightViewerComponent } from '../components/PdfHighlightViewer'
import { locateAllInDoc } from '../lib/pdfLocate'
import type { PdfMatch } from '../lib/pdfLocate'
import { AppStore } from '../store'
import { apiFetch } from '../lib/api'

type ViewerState = { url: string; matches: PdfMatch[] } | 'loading' | 'error'

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [PdfHighlightViewerComponent],
  templateUrl: './document-viewer.component.html',
  styleUrl: './document-viewer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerComponent {
  protected readonly store = inject(AppStore)
  private readonly route = inject(ActivatedRoute)

  private readonly qp = this.route.snapshot.queryParamMap
  protected readonly itemId = this.qp.get('itemId') ?? ''
  protected readonly filename = this.qp.get('filename') ?? ''
  protected readonly title = this.qp.get('title') ?? this.filename
  private readonly queries = this.qp.getAll('q')

  protected readonly state = signal<ViewerState>('loading')
  protected readonly isLoading = computed(() => this.state() === 'loading')
  protected readonly isError = computed(() => this.state() === 'error')
  protected readonly doc = computed(() => {
    const s = this.state()
    return typeof s === 'object' ? s : null
  })

  constructor() {
    // A document actually uploaded/replaced from Intake Review never reached the backend's
    // attachment store (see store.ts's intakeDocOverrides) — check for its persisted bytes here
    // by filename before assuming the backend fetch below is the only source.
    effect((onCleanup) => {
      const localOverride = this.store.intakeDocOverrides()[this.itemId]
      const localDataUrl = localOverride && Object.values(localOverride).find((d) => d.file === this.filename)?.dataUrl

      this.state.set('loading')
      if (!this.itemId || !this.filename) { this.state.set('error'); return }
      if (localDataUrl) { this.state.set({ url: localDataUrl, matches: [] }); return }

      let cancelled = false
      let objectUrl: string | null = null
      ;(async () => {
        try {
          const res = await apiFetch(`/api/intake/${encodeURIComponent(this.itemId)}/attachment?filename=${encodeURIComponent(this.filename)}`, this.store.authToken())
          if (!res.ok) throw new Error('not found')
          const blob = await res.blob()
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          const matches = await locateAllInDoc(this.itemId, this.filename, this.queries, this.store.authToken())
          if (!cancelled) this.state.set({ url: objectUrl, matches })
        } catch {
          if (!cancelled) this.state.set('error')
        }
      })()

      onCleanup(() => {
        cancelled = true
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      })
    })
  }

  close(): void {
    window.close()
  }
}
