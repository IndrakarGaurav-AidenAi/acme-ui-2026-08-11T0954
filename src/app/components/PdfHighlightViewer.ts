// Renders a real PDF page (via pdf.js) with a highlight rectangle over wherever an extracted
// field's value actually appears on the page — the genuine replacement for the synthetic
// "highlighted row" that used to stand in for this in IntakeReview's Source modal (see
// docSource.ts's FOCUS_ROW_BY_FIELD, which only ever highlighted a mock table).
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, signal, viewChild } from '@angular/core'
import * as pdfjs from 'pdfjs-dist'
import type { PdfMatch } from '../lib/pdfLocate'

// Vite's `?url` suffix import (the original React app's way of getting the worker's URL) has no
// esbuild/Angular-CLI equivalent, so the worker file is copied verbatim into public/ instead
// (served at the site root, same as favicon.ico) and referenced here as a plain string path.
pdfjs.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.mjs'

const DEFAULT_MAX_WIDTH = 640

@Component({
  selector: 'app-pdf-highlight-viewer',
  standalone: true,
  templateUrl: './PdfHighlightViewer.html',
  styleUrl: './PdfHighlightViewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfHighlightViewerComponent {
  readonly url = input.required<string>()
  readonly matches = input.required<PdfMatch[]>()
  readonly maxWidth = input(DEFAULT_MAX_WIDTH)

  private readonly outerEl = viewChild<ElementRef<HTMLDivElement>>('outer')
  private readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvas')

  protected readonly pageIndex = signal(0)
  protected readonly pageCount = signal(1)
  // CSS pixel size the canvas is DISPLAYED at — the overlay boxes are positioned against this,
  // never against the canvas's raw backing-store pixel size, so a HiDPI render (buffer scaled
  // by devicePixelRatio for sharpness) can never drift out of sync with the highlight boxes.
  protected readonly rendered = signal<{ width: number; height: number } | null>(null)
  protected readonly error = signal(false)
  // Measured from the actual containing element rather than assumed, so the canvas always
  // renders at its true displayed size — no CSS max-width/height:auto rescale that the overlay
  // math wouldn't know about.
  private readonly cssWidth = signal(DEFAULT_MAX_WIDTH)

  protected readonly pageMatches = computed(() => this.matches().filter((m) => m.page === this.pageIndex()))

  constructor() {
    effect((onCleanup) => {
      const el = this.outerEl()?.nativeElement
      const maxWidth = this.maxWidth()
      if (!el) return
      const measure = () => this.cssWidth.set(Math.max(200, Math.min(maxWidth, el.clientWidth || maxWidth)))
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      onCleanup(() => ro.disconnect())
    })

    // Land on whichever page actually has a match rather than always page 1 — a highlight the
    // user has to go hunting for pages to find isn't much better than no highlight at all.
    effect(() => {
      const matches = this.matches()
      this.pageIndex.set(matches[0]?.page ?? 0)
    })

    effect((onCleanup) => {
      const url = this.url()
      const pageIndex = this.pageIndex()
      const cssWidth = this.cssWidth()
      let cancelled = false
      this.error.set(false)

      pdfjs.getDocument(url).promise
        .then(async (pdf) => {
          if (cancelled) return
          this.pageCount.set(pdf.numPages)
          const page = await pdf.getPage(pageIndex + 1)
          const base = page.getViewport({ scale: 1 })
          const scale = cssWidth / base.width
          const dpr = window.devicePixelRatio || 1
          const cssHeight = base.height * scale
          const viewport = page.getViewport({ scale: scale * dpr })
          const canvas = this.canvasEl()?.nativeElement
          if (!canvas || cancelled) return
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${cssWidth}px`
          canvas.style.height = `${cssHeight}px`
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          await page.render({ canvasContext: ctx, viewport }).promise
          if (!cancelled) this.rendered.set({ width: cssWidth, height: cssHeight })
        })
        .catch(() => { if (!cancelled) this.error.set(true) })

      onCleanup(() => { cancelled = true })
    })
  }

  protected prevPage(): void {
    this.pageIndex.update((p) => p - 1)
  }

  protected nextPage(): void {
    this.pageIndex.update((p) => p + 1)
  }
}
