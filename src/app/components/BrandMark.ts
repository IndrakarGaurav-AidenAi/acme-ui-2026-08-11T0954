import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core'

// Renders the Acme Distribution Partner Platform mark from public/brand-mark.svg (icon) or
// public/brand-full.svg (icon + wordmark). Falls back to the styled "A" letter
// mark if that file is ever missing, so the app never shows a broken image.
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  templateUrl: './BrandMark.html',
  styleUrl: './BrandMark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMarkComponent {
  readonly variant = input<'mark' | 'full'>('mark')

  protected readonly failed = signal(false)

  protected onError(): void {
    this.failed.set(true)
  }
}
