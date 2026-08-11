import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

// Tiny inline SVG sparkline with an area fill and an emphasized endpoint.
// `responsive` makes it fill its container's width (viewBox scales) instead of a fixed px width.
@Component({
  selector: 'app-sparkline',
  standalone: true,
  templateUrl: './Sparkline.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparklineComponent {
  readonly data = input.required<number[]>()
  readonly color = input('var(--ai)')
  readonly width = input(68)
  readonly height = input(26)
  readonly responsive = input(false)

  protected readonly geometry = computed(() => {
    const data = this.data()
    const width = this.width()
    const height = this.height()
    const max = Math.max(...data)
    const min = Math.min(...data)
    const span = max - min || 1
    const pad = 2
    const x = (i: number) => pad + (i * (width - pad * 2)) / (data.length - 1)
    const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
    const line = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
    const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
    const gid = `sg-${Math.round(x(1) * 100)}-${data.length}-${Math.round(max)}`
    return { line, area, gid, lastX: x(data.length - 1), lastY: y(data[data.length - 1]) }
  })
}
