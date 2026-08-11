import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type IconName =
  | 'dashboard' | 'new' | 'approvals' | 'documents' | 'comms'
  | 'analytics' | 'partners' | 'templates' | 'settings' | 'spark' | 'send' | 'close'
  | 'target' | 'list' | 'leads' | 'search' | 'bell' | 'logout' | 'back'
  | 'mail' | 'robot' | 'bolt' | 'shield' | 'user' | 'help' | 'external' | 'flag'
  | 'check' | 'clock' | 'alert' | 'upload' | 'filter' | 'download' | 'more'
  | 'plus' | 'chevronDown' | 'chevronRight' | 'calendar'
  | 'lock' | 'dollar' | 'wrench' | 'monitor' | 'bulb' | 'info'

// Duotone icons: a soft, translucent accent-tinted body (`ic-fill`) sits behind a
// crisp outline. Both derive from `currentColor`, so an icon follows its context —
// muted grey when idle, violet when the nav item is active — with the fill giving
// each glyph real body instead of a flat single-weight line. Solid accents (dots)
// go in `ic-solid` so they stay opaque. Active-state fill boost lives in Shell.css.
@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icons.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>()
  readonly size = input<number>()
}
