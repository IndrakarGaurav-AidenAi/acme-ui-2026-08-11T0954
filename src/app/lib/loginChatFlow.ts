import { lookupSupportAccount, SupportAccount } from '../mock/supportAccounts'

export interface ChatContext {
  scenario?: string
  email?: string
  account?: SupportAccount | null
}

export interface ChoiceOption {
  label: string
  next: string
}

export interface TextResult {
  next: string
  error?: string
}

export interface ChatNode {
  id: string
  onEnter?: (ctx: ChatContext) => void
  // Plain text, formatted the same way Copilot's replies are (formatAiText in AiText.ts): blank
  // lines separate paragraphs, and consecutive "• " lines group into a bullet list. Never HTML —
  // this is what lets the bot message stream character-by-character safely (via
  // StreamingTextComponent) without ever truncating mid-tag.
  bot: (ctx: ChatContext) => string
  kind: 'choice' | 'text'
  choices?: ChoiceOption[]
  placeholder?: string
  onText?: (input: string, ctx: ChatContext) => TextResult
  // FAQ/L0 answers log a ticket in the background the moment they're shown — no OTP/email/name,
  // no "ticket created" message in the chat, nothing the user needs to act on.
  silentTicket?: boolean
}

export const ROOT_ID = 'root'
export const TICKET_NODE_ID = 'submit_ticket'
// Entry point used when the widget is embedded post-login (app sidebar) — skips straight past
// the login-issue menu since those choices only make sense to someone who can't sign in.
export const FAQ_MENU_ID = 'faq_menu'

// Every menu choice tags the scenario, then asks for a registered email and creates the ticket
// immediately on the next reply — no OTP, no name/phone/summary collection, no follow-up menus.
function emailStep(id: string, scenario: string): ChatNode {
  return {
    id,
    onEnter: (ctx) => { ctx.scenario = scenario },
    bot: () => 'Please enter your registered email address.',
    kind: 'text',
    placeholder: 'you@company.com',
    onText: (input, ctx) => {
      ctx.email = input.trim()
      ctx.account = lookupSupportAccount(ctx.email)
      return { next: TICKET_NODE_ID }
    },
  }
}

// The 5 L0 questions, shared between the FAQ submenu's buttons and the free-text keyword
// matcher — so typing "how do I check GTM coverage" works identically whether you're already
// inside the FAQ submenu or just landed on the root menu.
export const FAQ_QUESTIONS: ChoiceOption[] = [
  { label: 'How do you create a new distributor?', next: 'faq_new_distributor' },
  { label: 'What is the status of onboarding?', next: 'faq_onboarding_status' },
  { label: 'What is this platform about?', next: 'faq_about_platform' },
  { label: 'How do I check partner/GTM coverage?', next: 'faq_gtm_coverage' },
  { label: 'How do I raise or track a grievance?', next: 'faq_grievances' },
]

// L0 — informational Q&A. Answered directly, no email/ticket shown to the user; a ticket is
// still raised in the background purely for support-team visibility into what's being asked.
function faqAnswer(id: string, lede: string, bullets: string[], note: string | undefined, question: string): ChatNode {
  const bulletLines = bullets.map((b) => `• ${b}`).join('\n')
  const noteLine = note ? `\n\n${note}` : ''
  return {
    id,
    onEnter: (ctx) => { ctx.scenario = `FAQ: ${question}` },
    bot: () => `${lede}\n${bulletLines}${noteLine}`,
    kind: 'choice',
    silentTicket: true,
    choices: [
      { label: 'Ask another question', next: 'faq_menu' },
      { label: 'Back to main menu', next: ROOT_ID },
    ],
  }
}

export const CHAT_FLOW: Record<string, ChatNode> = {
  [ROOT_ID]: {
    id: ROOT_ID,
    bot: () => 'I can help. Which issue are you experiencing?',
    kind: 'choice',
    choices: [
      { label: 'I forgot my password', next: 'forgot_password' },
      { label: 'My account is locked', next: 'locked' },
      { label: 'I did not receive an activation email', next: 'activation' },
      { label: 'My MFA code is not working', next: 'mfa' },
      { label: 'I receive an error after signing in', next: 'error_signin' },
      { label: 'I am not able to login. Please help', next: 'login_help' },
      { label: 'General questions about the platform', next: 'faq_menu' },
    ],
  },

  forgot_password: emailStep('forgot_password', 'Forgot password'),
  locked: emailStep('locked', 'Account locked'),
  activation: emailStep('activation', 'Did not receive activation email'),
  mfa: emailStep('mfa', 'MFA device replacement'),
  error_signin: emailStep('error_signin', 'Error after signing in'),
  login_help: emailStep('login_help', 'Not able to login'),

  faq_menu: {
    id: 'faq_menu',
    bot: () => 'Sure — here are some common questions. Pick one, or type your own below.',
    kind: 'choice',
    choices: [...FAQ_QUESTIONS, { label: 'Back to main menu', next: ROOT_ID }],
  },

  faq_new_distributor: faqAnswer(
    'faq_new_distributor',
    'There are two entry points, both leading to the same wizard:',
    [
      'Go to Prospecting → Leads, find or add the candidate, and click "Review & create lead."',
      'Or go to Manage → Partners and click "Add Partner" (top right).',
      'Either way, it opens New Application, a step wizard: Type → Leads → Evaluate → Review → Agreement.',
      'Type: select the Distributor card, then "Continue →."',
      'Choose the DB subtype: New DB (new town opening), Replacement DB, or Additional DB (in same town). Replacement DBs need the OLD DB Code and a Distributor Disengagement Recommendation Form.',
      'Leads: select candidates via checkboxes, set sliders for Own Funds, CC Limit, and infrastructure factors.',
      'Evaluate: system computes Financial Evaluation % and Channel Management score.',
      'Review: if scores fail thresholds, the case auto-routes to Finance or Channel Development for sign-off via Approvals; otherwise it moves straight to Agreement.',
      'Agreement → Success completes the application.',
    ],
    'Applications can also originate from Intake Inbox (emailed/uploaded documents) → Intake Review → same "Review & create lead" flow.',
    'How do you create a new distributor?',
  ),

  faq_onboarding_status: faqAnswer(
    'faq_onboarding_status',
    'Go to Dashboard — the "Recent cases" table gives you a live snapshot of every case, no need to dig into other screens. Each row shows:',
    [
      'Case ID (e.g. LD-AGS for leads, CMP-2292 for compliance/onboarding cases)',
      'Partner / Case: name, town, and DB type (e.g. "GT DB (with CSO/DSM)")',
      'Status pill: values seen: Open, Active, Approval 1, Approval 2, Approved, Flagged',
      'Progress: a 5-dot tracker showing which stage the case is at',
      'AI Confidence: Green (≥70%) = score meets the Financial/Channel threshold, so it auto-clears; orange (50–69%) = it falls short, so it gets flagged and routed to Finance/Channel Development for review.',
      'SLA: countdown timer showing time left (e.g. "44h 57m 53s left")',
      'Last Updated: "just now" or a timestamp',
      'An action button: "View lead" for prospecting-stage cases, "View case" for onboarding/compliance-stage cases — click to open the full detail.',
    ],
    undefined,
    'What is the status of onboarding?',
  ),

  faq_about_platform: faqAnswer(
    'faq_about_platform',
    "This is Acme's partner/distributor lifecycle management platform. It covers the full journey from prospecting a new partner to onboarding, ongoing collaboration, and monitoring — organized into five areas:",
    [
      'Prospecting — Intake Inbox, Leads, New Application',
      'Onboarding — Approvals, Documents',
      'Collaborate — Communication, Grievances',
      'Insights — Analytics, GTM Coverage, Reports',
      'Manage — Partners, Team & Assignment, Templates, Admin',
    ],
    'What you see depends on your role (ASE, ASM, RBL, Finance, Channel Development, MDM, Leadership, or Admin).',
    'What is this platform about?',
  ),

  faq_gtm_coverage: faqAnswer(
    'faq_gtm_coverage',
    'Two connected screens, both pulling from the same partner data:',
    [
      'Manage → Partners: directory view with tabs for All Types / Distributor / Vendor / Logistics / Copacker, a Filters popover (Status: Active/In review/Discontinued, State), and search by partner or location.',
      'Insights → GTM Coverage: an India map color-coded by coverage % (≥100% = met, 70–99% = high, 40–69% = mid, <40% = low, no data = none). You can drill into a state or view "All India," filter by DB category/type and status, see a factors breakdown table (target vs actual vs variance), and view the distributor list per state/city.',
    ],
    undefined,
    'How do I check partner/GTM coverage?',
  ),

  faq_grievances: faqAnswer(
    'faq_grievances',
    'Grievances live under Collaborate → Grievances. Note: grievances are logged automatically from distributor communication (via the Intake Agent) rather than through a manual "raise new" form on this screen — your job here is to track and resolve them.',
    [
      'Use the toolbar to filter by Priority (High/Medium/Low), Status (Open/In Review/Overdue/Closed), Raised By, or Time (Last 7/30/90 days); export the list via Export.',
      'Click a row to open Grievance Detail — shows category (Payments & credit, Supply & stock, Scheme & claims, Logistics, System access, Onboarding delay, Other), the activity timeline, SLA/owner team info.',
      'Update progress with the Open / In progress / Resolved buttons, or send a holding reply to the distributor via "Email distributor" (this auto-flips status to In progress).',
    ],
    undefined,
    'How do I raise or track a grievance?',
  ),
}
