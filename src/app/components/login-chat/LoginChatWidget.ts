import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiError, apiPost } from '../../lib/api'
import { CHAT_FLOW, ChatContext, ChoiceOption, FAQ_MENU_ID, FAQ_QUESTIONS, ROOT_ID, TICKET_NODE_ID } from '../../lib/loginChatFlow'
import type { SupportTicketRequest, SupportTicketResponse, TranscriptMessage } from '../../lib/supportTicket'
import { AppStore } from '../../store'
import { IconComponent } from '../ui/icons'
import { AiTextComponent } from '../ui/AiText'
import { StreamingTextComponent } from '../ui/StreamingText'

interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  text: string
}

let messageSeq = 0
function nextMessageId(): string {
  messageSeq += 1
  return 'm' + messageSeq
}

// No LLM behind this bot — matches by keyword overlap against a set of candidate labels rather
// than true language understanding. Generic function words are excluded so a shared "what"/"is"
// can't out-rank an actual content-word match; picks the label with the MOST overlapping
// significant words (not just the first one sharing any word), so near-duplicate questions like
// "What is the status of onboarding?" vs. "What is this platform about?" resolve correctly.
const STOP_WORDS = new Set([
  'the', 'not', 'are', 'has', 'did', 'what', 'this', 'that', 'you', 'your', 'how', 'about', 'for', 'and', 'off', 'out', 'get', 'can',
])
function significantWords(label: string): string[] {
  return label
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}
function keywordMatch(choices: ChoiceOption[] | undefined, inputLower: string): ChoiceOption | undefined {
  let best: ChoiceOption | undefined
  let bestScore = 0
  for (const c of choices ?? []) {
    const score = significantWords(c.label).filter((w) => inputLower.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

@Component({
  selector: 'app-login-chat-widget',
  standalone: true,
  imports: [FormsModule, IconComponent, AiTextComponent, StreamingTextComponent, NgTemplateOutlet],
  templateUrl: './LoginChatWidget.html',
  styleUrl: './LoginChatWidget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginChatWidgetComponent {
  // 'floating' (default) is the pre-login widget on the login page: its own FAB + panel, full
  // menu including the login-issue reasons. 'sidebar' is how it's embedded post-login (Shell) —
  // it shares Copilot's in-flow rail column (open state lives in the store, not locally, so the
  // two stay mutually exclusive) and only ever shows the general-question FAQ menu, since a
  // signed-in user by definition isn't stuck on a login problem.
  readonly variant = input<'floating' | 'sidebar'>('floating')

  private readonly store = inject(AppStore)

  protected readonly open = signal(false)
  protected readonly fullscreen = signal(false)
  protected readonly minimized = signal(false)
  protected readonly messages = signal<ChatMessage[]>([])
  protected readonly nodeId = signal(ROOT_ID)
  protected readonly typing = signal(false)
  protected readonly submitting = signal(false)
  protected readonly inputValue = signal('')
  protected readonly inputError = signal<string | null>(null)
  protected readonly done = signal(false)
  // Suggestion/choice buttons default to collapsed on every new bot turn — the user can expand
  // to view and pick from them, but the free-text input is always visible either way.
  protected readonly optionsExpanded = signal(false)

  protected readonly currentNode = computed(() => CHAT_FLOW[this.nodeId()])
  // In sidebar mode there's no "main menu" to go back to (that menu is the login-issue list,
  // which is skipped entirely) — so any choice that would lead back to it is hidden.
  protected readonly visibleChoices = computed(() => {
    const choices = this.currentNode().choices ?? []
    return this.variant() === 'sidebar' ? choices.filter((c) => c.next !== ROOT_ID) : choices
  })
  protected readonly panelOpen = computed(() => this.variant() === 'sidebar' ? this.store.supportOpen() : this.open())

  private ctx: ChatContext = {}
  private started = false

  private get startNodeId(): string {
    return this.variant() === 'sidebar' ? FAQ_MENU_ID : ROOT_ID
  }

  // The sidebar lands straight on the FAQ menu (see startNodeId), but that node's own line
  // ("Sure — here are some common questions...") reads oddly as a cold-open greeting — it only
  // makes sense as a reply to picking "General questions" from the full login-page menu. So the
  // very first sidebar message gets its own greeting instead of that node's line.
  private startGreeting(): string {
    return this.variant() === 'sidebar'
      ? 'Hi, how can I help you today? Pick a question below, or type your own.'
      : CHAT_FLOW[this.startNodeId].bot(this.ctx)
  }

  protected toggle(): void {
    if (this.variant() === 'sidebar') {
      this.store.setSupportOpen(!this.store.supportOpen())
    } else {
      this.open.update((v) => !v)
    }
    if (this.panelOpen() && !this.started) {
      this.started = true
      this.nodeId.set(this.startNodeId)
      this.pushBot(this.startGreeting())
    }
  }

  protected selectChoice(next: string): void {
    const node = this.currentNode()
    const label = node.choices?.find((c) => c.next === next)?.label ?? next
    this.pushUser(label)
    this.advance(next)
  }

  protected toggleFullscreen(): void {
    this.fullscreen.update((v) => !v)
  }

  // Collapses the panel to just its header bar — the conversation, suggestion buttons, and
  // input all stay exactly as they were underneath; reopening restores them unchanged.
  protected toggleMinimize(): void {
    this.minimized.update((v) => !v)
  }

  protected toggleOptions(): void {
    this.optionsExpanded.update((v) => !v)
  }

  // A menu step typed as free text is matched by keyword overlap — first against whatever
  // choices are visible right now, then against the full FAQ list regardless of where you are
  // in the conversation, so typing an FAQ-shaped question works the same as clicking into the
  // FAQ submenu first. If nothing matches either pool, it's routed straight into the ticket
  // flow rather than a dead end — unless we're in FAQ territory (the sidebar is FAQ-only, and
  // the floating widget's FAQ answers carry silentTicket too), where a visible "ticket created"
  // message would be wrong: FAQ tickets are always logged silently, never shown to the user.
  protected submitFreeTextAtChoice(): void {
    const raw = this.inputValue().trim()
    if (!raw) return
    this.pushUser(raw)
    this.inputValue.set('')

    // FAQ questions are checked first — they're specific ("how do you create a new distributor")
    // and should win over a broad current-menu label they happen to share a word with (e.g. root's
    // "General questions about the platform" also contains "platform").
    const inputLower = raw.toLowerCase()
    const match = keywordMatch(FAQ_QUESTIONS, inputLower) ?? keywordMatch(this.visibleChoices(), inputLower)
    if (match) {
      this.advance(match.next)
      return
    }

    if (this.variant() === 'sidebar' || this.currentNode().silentTicket) {
      this.ctx.scenario = `General question: ${raw}`
      void this.submitSilentTicket()
      this.optionsExpanded.set(false)
      this.pushBot("I don't have a preset answer for that one yet, but I've passed it to our support team. In the meantime, here's what I can help with:")
      this.nodeId.set(FAQ_MENU_ID)
      return
    }

    if (!this.ctx.scenario) this.ctx.scenario = 'Other'
    this.advance(TICKET_NODE_ID)
  }

  protected submitText(): void {
    const node = this.currentNode()
    const raw = this.inputValue().trim()
    if (!raw || !node.onText) return
    const result = node.onText(raw, this.ctx)
    if (result.error) {
      this.inputError.set(result.error)
      return
    }
    this.pushUser(raw)
    this.inputValue.set('')
    this.inputError.set(null)
    this.advance(result.next)
  }

  protected restart(): void {
    this.ctx = {}
    this.nodeId.set(this.startNodeId)
    this.messages.set([])
    this.done.set(false)
    this.inputValue.set('')
    this.inputError.set(null)
    this.optionsExpanded.set(false)
    this.started = true
    this.pushBot(this.startGreeting())
  }

  private advance(next: string): void {
    if (next === TICKET_NODE_ID) {
      void this.submitTicket()
      return
    }
    this.nodeId.set(next)
    this.optionsExpanded.set(false)
    const node = CHAT_FLOW[next]
    node.onEnter?.(this.ctx)
    this.pushBot(node.bot(this.ctx))
    if (node.silentTicket) {
      void this.submitSilentTicket()
    }
  }

  private pushBot(text: string): void {
    this.typing.set(true)
    setTimeout(() => {
      this.typing.set(false)
      this.messages.update((m) => [...m, { id: nextMessageId(), role: 'bot', text }])
    }, 550)
  }

  private pushUser(text: string): void {
    this.messages.update((m) => [...m, { id: nextMessageId(), role: 'user', text }])
  }

  // FAQ answers still log a ticket for support-team visibility, but entirely in the background —
  // no email/name collected, no "ticket created" message, and a failure here must never surface
  // in the chat (the user already has their answer).
  private async submitSilentTicket(): Promise<void> {
    const transcript: TranscriptMessage[] = this.messages().map((m) => ({ role: m.role, text: m.text }))
    const req: SupportTicketRequest = {
      name: '',
      email: '',
      phone: '',
      issueSummary: this.ctx.scenario ?? 'General question',
      scenario: this.ctx.scenario ?? 'General question',
      transcript,
    }
    try {
      await apiPost<SupportTicketResponse>('/support/tickets', null, req)
    } catch {
      // Deliberately swallowed — see doc comment above.
    }
  }

  private async submitTicket(): Promise<void> {
    this.submitting.set(true)
    const transcript: TranscriptMessage[] = this.messages().map((m) => ({ role: m.role, text: m.text }))
    const req: SupportTicketRequest = {
      name: this.ctx.account?.name ?? '',
      email: this.ctx.email ?? '',
      phone: '',
      issueSummary: this.ctx.scenario ?? 'Login issue',
      scenario: this.ctx.scenario ?? 'Login issue',
      transcript,
    }
    try {
      const res = await apiPost<SupportTicketResponse>('/support/tickets', null, req)
      this.pushBot(
        `Your support ticket has been created.\n\nTicket: ${res.ticketNumber}\nPriority: ${res.priority}\nIssue: ${req.issueSummary}\nTarget response: ${res.targetResponse}\nAssigned team: ${res.assignedTeam}\n\nA confirmation has been sent to your registered email.`,
      )
    } catch (e) {
      const message = e instanceof ApiError
        ? e.message
        : "I couldn't reach our ticketing system just now — please try again shortly, or contact support directly."
      this.pushBot(message)
    } finally {
      this.submitting.set(false)
      this.done.set(true)
    }
  }
}
