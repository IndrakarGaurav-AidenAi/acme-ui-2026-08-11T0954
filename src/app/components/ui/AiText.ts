import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

export type AiTextBlock =
  | { type: 'para'; text: string }
  | { type: 'bullets'; items: string[] }

// Turns "• " bullet lines and \n breaks into real hanging-indent list rows instead of
// leaving them as a flat string that CSS white-space:pre-line can't align properly.
// Each non-bullet line becomes its own paragraph (real margin between them, not a bare <br>),
// and consecutive bullet lines group into one list block — so a reply with a headline, a
// bulleted list and a closing line reads as three visually distinct sections, not one run-on wall.
export function formatAiText(text: string): AiTextBlock[] {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  const blocks: AiTextBlock[] = []
  let i = 0
  while (i < lines.length) {
    const bullet = lines[i].match(/^• (.*)$/)
    if (bullet) {
      const group: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^• (.*)$/)
        if (!m) break
        group.push(m[1])
        i++
      }
      blocks.push({ type: 'bullets', items: group })
    } else {
      blocks.push({ type: 'para', text: lines[i] })
      i++
    }
  }
  return blocks
}

@Component({
  selector: 'app-ai-blocks',
  standalone: true,
  templateUrl: './AiBlocks.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiBlocksComponent {
  readonly blocks = input.required<AiTextBlock[]>()
}

@Component({
  selector: 'app-ai-text',
  standalone: true,
  imports: [AiBlocksComponent],
  templateUrl: './AiText.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiTextComponent {
  readonly text = input.required<string>()
  protected readonly blocks = computed(() => formatAiText(this.text()))
}
