import type { IconName } from '../components/ui/icons'
import type { CopilotAgent } from '../lib/copilot'

export interface AgentDef {
  id: string
  label: string
  icon: IconName
  colorVar: string
  tagline: string
  detail: string
  status: 'active' | 'standby'
  homeRoute: string
  homeLabel: string
  /** if set, "Ask this agent" opens the Copilot dock pre-scoped to it */
  copilotAgent?: CopilotAgent
  recentActivity: string[]
}

// Single source of truth for every named agent referenced across the app
// (Dashboard's live feed, Leads, Intake Inbox, New Application, Approvals,
// Communication, Documents, Audit Log). Surfaced as its own navigable screen
// so the "multi-agent system" story isn't buried inside the Copilot dropdown.
export const AGENTS: AgentDef[] = [
  {
    id: 'lead_gen',
    label: 'Lead Generation Agent',
    icon: 'leads',
    colorVar: '--p-finance',
    tagline: 'Finds coverage & turnover gaps and matches them to nearby distributors.',
    detail: 'Scans GTM plan vs. actuals by territory, ranks whitespace by opportunity size, and proposes distributor matches with a confidence score — before any human goes looking.',
    status: 'active',
    homeRoute: '/leads',
    homeLabel: 'Open Leads',
    recentActivity: ['Surfaced 3 coverage & turnover gaps this week', 'Nashik City — 48% below its 1,200-outlet plan'],
  },
  {
    id: 'intake',
    label: 'Intake Agent',
    icon: 'comms',
    colorVar: '--p-leadership',
    tagline: 'Reads incoming candidates and drafts the profile — you confirm, not retype.',
    detail: 'Extracts structured fields from email, uploaded documents, or self-signup forms, flags duplicates, and hands off a draft application to New Application.',
    status: 'active',
    homeRoute: '/intake-inbox',
    homeLabel: 'Open Intake Inbox',
    recentActivity: ['6 items processed today across all 3 channels', 'Extracted 8/9 fields at 91% confidence'],
  },
  {
    id: 'recommendation',
    label: 'Recommendation Agent',
    icon: 'target',
    colorVar: '--p-ase',
    tagline: 'Ranks candidate distributors and recommends the strongest fit.',
    detail: 'Compares candidates on infra, coverage and expected turnover, and picks a top recommendation with a confidence score and retention-risk read.',
    status: 'active',
    homeRoute: '/new-application',
    homeLabel: 'Open New Application',
    copilotAgent: 'recommendation',
    recentActivity: ['Ranked 3 candidates for Nashik territory · picked DB 1', 'DB 1 at 92% confidence, ~41% higher expected turnover'],
  },
  {
    id: 'evaluation',
    label: 'Evaluation Agent',
    icon: 'approvals',
    colorVar: '--ai',
    tagline: 'Runs the automated approval matrix — auto-clears or flags with a reason.',
    detail: 'Checks financial eligibility (own funds + CC limit vs. required investment) and an 8-factor infra/coverage score. Passing both auto-clears a case; failing either flags it with the exact reason.',
    status: 'active',
    homeRoute: '/approvals',
    homeLabel: 'Open Approvals',
    copilotAgent: 'evaluation',
    recentActivity: ['Auto-cleared CMP-2265 · Surat · 95% confidence', 'Flagged CMP-2291 · CC limit below required threshold'],
  },
  {
    id: 'routing',
    label: 'Routing & Compliance Agent',
    icon: 'list',
    colorVar: '--p-mdm',
    tagline: 'Sends flagged cases to the right queue and starts the SLA clock.',
    detail: 'Reads the Evaluation Agent\'s finding and routes to Finance, Channel Development, or MDM accordingly, starting an SLA timer and notifying the owner.',
    status: 'active',
    homeRoute: '/approvals',
    homeLabel: 'Open Approvals',
    recentActivity: ['Routed CMP-2291 to Finance · SLA started', 'Routed CMP-2291 to Finance queue'],
  },
  {
    id: 'communication',
    label: 'Communication Agent',
    icon: 'comms',
    colorVar: '--p-channel',
    tagline: 'Keeps every case thread moving — no email chains.',
    detail: 'Runs threaded, per-case discussion and automatically notifies whoever needs to reply next, so nothing stalls waiting on a missed email.',
    status: 'active',
    homeRoute: '/communication',
    homeLabel: 'Open Communication',
    copilotAgent: 'communication',
    recentActivity: ['Notified Finance · CMP-2288 awaiting reply', 'Drafted outreach for a Nashik coverage gap'],
  },
  {
    id: 'document',
    label: 'Document Intelligence',
    icon: 'documents',
    colorVar: '--ink-mute',
    tagline: 'Matches claimed vs. extracted document values — opt-in per case.',
    detail: 'Extracts GST, PAN and warehouse details from submitted documents and checks them against claimed values. Off by default; Acme Distribution doesn\'t verify subjective capacity claims.',
    status: 'standby',
    homeRoute: '/documents',
    homeLabel: 'Open Documents',
    copilotAgent: 'document',
    recentActivity: ['Verified ISO 9001 Certificate · Adarsh Packaging', 'Standing by — enable per case'],
  },
]
