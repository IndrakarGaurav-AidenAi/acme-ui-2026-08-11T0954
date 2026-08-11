import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, Renderer2, effect, inject, input, output } from '@angular/core'
import { DOCUMENT } from '@angular/common'

// Relocates this component's own host element to document.body while open — the direct
// equivalent of React's createPortal(..., document.body), so the modal escapes whatever
// stacking-context/overflow clipping its call site happens to sit inside. Restores it to its
// original position when closed rather than leaving a trail of detached hosts around the body.
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './Modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent implements OnDestroy {
  readonly open = input.required<boolean>()
  readonly title = input<string>('')
  readonly size = input<'md' | 'lg'>('md')
  readonly closed = output<void>()

  private readonly elementRef = inject(ElementRef<HTMLElement>)
  private readonly renderer = inject(Renderer2)
  private readonly document = inject(DOCUMENT)
  private originalParent: Node | null = null
  private nextSibling: Node | null = null

  constructor() {
    effect(() => {
      const host = this.elementRef.nativeElement
      if (this.open()) {
        if (!this.originalParent) {
          this.originalParent = host.parentNode
          this.nextSibling = host.nextSibling
        }
        this.renderer.appendChild(this.document.body, host)
      } else if (this.originalParent) {
        this.renderer.insertBefore(this.originalParent, host, this.nextSibling)
      }
    })
  }

  protected onClose(): void {
    this.closed.emit()
  }

  // If this component gets destroyed (e.g. the caller navigates away) while its host is still
  // reparented under document.body, Angular's own view-removal targets the host's ORIGINAL parent
  // — not document.body, its actual current parent — and can silently fail to detach it, leaving a
  // stuck overlay behind. Removing it directly from wherever it actually lives guarantees cleanup
  // regardless of that race.
  ngOnDestroy(): void {
    const host = this.elementRef.nativeElement
    if (host.parentNode) this.renderer.removeChild(host.parentNode, host)
  }
}
