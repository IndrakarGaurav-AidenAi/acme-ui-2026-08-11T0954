import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { useStreamingText } from '../../lib/useStreamingText'
import { AiBlocksComponent, formatAiText } from './AiText'

@Component({
  selector: 'app-streaming-text',
  standalone: true,
  imports: [AiBlocksComponent],
  templateUrl: './StreamingText.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingTextComponent {
  readonly text = input.required<string>()
  readonly speed = input<number>()
  readonly chunk = input<number>()
  readonly start = input(true)

  private readonly streaming = useStreamingText(
    () => this.text(),
    () => ({ speed: this.speed(), chunk: this.chunk(), start: this.start() }),
  )
  protected readonly shown = this.streaming.text
  protected readonly done = this.streaming.done
  protected readonly blocks = computed(() => formatAiText(this.shown()))
}
