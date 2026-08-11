import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent } from '../components/ui'
import { AgentTraceComponent } from '../components/ui/AgentTrace'
import type { TraceLine } from '../components/ui/AgentTrace'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { PARTNER_TYPE_COLOR, partnerTypeLabel } from '../mock/templates'
import { AppStore } from '../store'
import { ROLE_BY_CODE, DEMO_USERS } from '../mock/roles'
import { EXTRACTIONS, mergedFields } from '../mock/intake'
import type { RequiredDoc } from '../mock/intake'
import { BACKGROUND_INFORMATION } from '../mock/recommendationForm'
import { buildPdf, openPdfInNewTab } from '../lib/pdf'
import { apiPost } from '../lib/api'
import { REQUIRED_INVESTMENT, INFRA_THRESHOLD, round1 } from '../mock/onboarding'
import { getCaseAuditTrail } from '../lib/caseHistory'
import { DisengagementFormModalComponent } from '../components/DisengagementForm'
import type { CandidateCard, CaseFinanceSnapshot, CaseChannelSnapshot, CaseRecord, PartnerTypeCode, RoleCode } from '../types'

const TEAM_LABEL: Record<RoleCode, string> = {
  finance: 'Finance', channel_dev: 'Trade Marketing', mdm: 'MDM', leadership: 'Leadership', ase_asm: 'ASE/ASM', admin: 'Admin',
}

// Finance checks exactly two numbers from the recommendation form — Total Own Funds/Borrowed and
// CC Limit — backed by one real document (the distributor's bank statement), not a stack of
// generic paperwork unrelated to what's actually being evaluated.
const BANK_STATEMENT_KEY = 'bank_statement'

// Banded, not precise — a flagged case always carries some risk, so this reads off the real
// gap-to-threshold ratio when one exists, and a fixed "Medium" default otherwise (no snapshot
// numbers to back a more specific claim).
function riskLevel(gapRatio: number): { label: string; tone: 'good' | 'warn' | 'crit' } {
  if (gapRatio <= 0) return { label: 'Low', tone: 'good' }
  if (gapRatio < 0.15) return { label: 'Medium', tone: 'warn' }
  return { label: 'High', tone: 'crit' }
}
function gapRatioFor(c: CaseRecord): number {
  if (c.financeSnapshot) return c.financeSnapshot.fundingGap / c.financeSnapshot.requiredInvestment
  if (c.channelSnapshot) return c.channelSnapshot.gap / c.channelSnapshot.threshold
  return 0.1
}

// Older/seeded cases can carry a flag as free text only (no structured snapshot) — but the
// percentage or score in that text is real, so derive a numeric snapshot from it rather than
// hiding the numbers entirely. Returns undefined (never a made-up number) if nothing parses.
function deriveFinanceSnapshot(c: CaseRecord): CaseFinanceSnapshot | undefined {
  if (c.financeSnapshot) return c.financeSnapshot
  if (c.ownerRole !== 'finance') return undefined
  const pct = parseFloat((c.flagDetail ?? '').match(/(\d+(?:\.\d+)?)%/)?.[1] ?? '')
  if (!Number.isFinite(pct)) return undefined
  const capitalAvailable = Math.round((pct / 100) * REQUIRED_INVESTMENT)
  // Seeded/legacy cases only ever carried the combined figure — split it own-funds-led (65/35),
  // same approximation the batch-evaluate flow uses, so older cases still show both numbers.
  const ownFunds = Math.round(capitalAvailable * 0.65)
  return { ownFunds, ccLimit: capitalAvailable - ownFunds, capitalAvailable, requiredInvestment: REQUIRED_INVESTMENT, fundingGap: round1(Math.max(0, REQUIRED_INVESTMENT - capitalAvailable)), readinessPct: Math.round(pct) }
}
function deriveChannelSnapshot(c: CaseRecord): CaseChannelSnapshot | undefined {
  if (c.channelSnapshot) return c.channelSnapshot
  if (c.ownerRole !== 'channel_dev') return undefined
  const score = parseFloat((c.flagDetail ?? '').match(/(\d+(?:\.\d+)?)\s*\/\s*10/)?.[1] ?? '')
  if (!Number.isFinite(score)) return undefined
  return { score, threshold: INFRA_THRESHOLD, gap: Math.max(0, INFRA_THRESHOLD - score), readinessPct: Math.round((score / INFRA_THRESHOLD) * 100) }
}

// The single source of truth for "can this case be approved yet" — checked before both the
// single-case Approve button AND bulk-approve, so selecting a case in the list and bulk-approving
// it can't skip the document gate that the case-review screen enforces. Gate state lives on the
// case record itself (financeDocsUploaded / channelDocUploaded / hasDiscontinuationForm), not in
// component state, so it's visible here in the list view too.
function caseDocGateBlocked(c: CaseRecord): boolean {
  // Neither team's supporting document (Finance's bank statement, Channel Development's
  // coverage plan) is a hard gate anymore — a reviewer can approve without it, after confirming
  // they're ready to continue and optionally leaving a note explaining why. Only the
  // Discontinuation Form for a replacement DB still hard-blocks (a distinct compliance
  // requirement, not the document-upload restriction this was relaxed for).
  if (c.subtype === 'replacement' && !c.hasDiscontinuationForm) return true
  return false
}

// AI Insights — built only from real, derivable data; nothing here is a fixed/fabricated count.
function aiInsights(c: CaseRecord, flagSummary: string): { label: string; tone: 'good' | 'warn' | 'crit' }[] {
  const out: { label: string; tone: 'good' | 'warn' | 'crit' }[] = []
  if (c.financeSnapshot) {
    const { capitalAvailable, requiredInvestment } = c.financeSnapshot
    out.push(capitalAvailable >= requiredInvestment
      ? { label: 'Capital available (₹' + capitalAvailable + 'L) meets the required investment (₹' + requiredInvestment + 'L).', tone: 'good' }
      : { label: 'Capital available (₹' + capitalAvailable + 'L) is below the required investment (₹' + requiredInvestment + 'L).', tone: 'crit' })
  } else if (c.channelSnapshot) {
    const { score, threshold } = c.channelSnapshot
    out.push(score >= threshold
      ? { label: 'Infrastructure & coverage (' + score.toFixed(1) + '/10) meets the Acme Distribution benchmark.', tone: 'good' }
      : { label: 'Infrastructure & coverage (' + score.toFixed(1) + '/10) is below the ' + threshold + '/10 benchmark.', tone: 'crit' })
  } else {
    // Seeded demo cases carry no structured snapshot — fall back to the same flag text shown
    // in the hero, so "what's missing" is never silently absent from AI Insights.
    out.push({ label: flagSummary, tone: 'crit' })
  }
  // Shared "Background Information" workbook defaults this app already reuses for every lead
  // (see mock/recommendationForm.ts) — real demo data, not invented for this screen.
  const agencySince = BACKGROUND_INFORMATION.find((f) => f.key === 'agency_since')?.value
  const companiesHandled = BACKGROUND_INFORMATION.find((f) => f.key === 'companies_handled')?.value
  if (agencySince && companiesHandled) {
    out.push({ label: 'Strong business history of ' + agencySince + ' years with reputed brands (' + companiesHandled + ').', tone: 'good' })
  }
  if (c.channelSnapshot && c.channelSnapshot.readinessPct >= 70 && c.channelSnapshot.readinessPct < 100) {
    out.push({ label: 'Geographic coverage is moderate and can be improved.', tone: 'warn' })
  }
  return out
}

type JourneyState = 'done' | 'current' | 'pending'
function journeySteps(c: CaseRecord, teamLabel: string): { label: string; state: JourneyState }[] {
  const teamState: JourneyState = c.status === 'flagged' ? 'current' : 'done'
  const leadershipState: JourneyState = c.ownerRole === 'leadership'
    ? (c.status === 'flagged' ? 'current' : c.status === 'approved' ? 'done' : 'pending')
    : (c.status === 'approved' ? 'done' : 'pending')
  return [
    { label: 'Application Submitted', state: 'done' },
    { label: 'AI Evaluation Completed', state: 'done' },
    { label: 'ASM Review Completed', state: 'done' },
    { label: teamLabel + ' Review', state: teamState },
    { label: 'Leadership Review', state: leadershipState },
  ]
}
const JOURNEY_CAPTION: Record<JourneyState, string> = { done: 'Completed', current: 'In Progress', pending: 'Pending' }

// Real email address when the flagged candidate came in over email intake; a plausible
// placeholder otherwise (seeded cases and directory leads carry no email on the record itself).
function emailForCase(c: CaseRecord, candidates: CandidateCard[]): string {
  const cand = candidates.find((x) => x.id === c.candidateId)
  const ext = cand?.sourceIntakeId ? EXTRACTIONS[cand.sourceIntakeId] : undefined
  if (ext?.channel === 'email') return ext.source
  const emailField = ext ? mergedFields(ext).find((f) => /email/i.test(f.label) && f.ok)?.value : undefined
  if (emailField) return emailField
  return c.partnerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '') + '@example.com'
}

// Roles that own an approval queue — a case only shows up for these personas once it's
// actually theirs to act on (see mock/cases.ts ownerRole); reused by Dashboard's Recent Cases
// so MDM/Finance/Channel Development don't see each other's still-open flagged cases.
export const OWNER_ROLES: RoleCode[] = ['finance', 'channel_dev', 'mdm', 'leadership']

// confidencePct = likelihood to auto-clear — low is expected for a case that's sitting in Approvals at all.
const confidenceTone = (pct: number): 'good' | 'warn' | 'crit' => (pct >= 70 ? 'good' : pct >= 50 ? 'warn' : 'crit')

// "All cases" also surfaces already-resolved cases (see rows' filter comment above) — this is
// the only place their outcome shows, since every other column (SLA, Owner) only makes sense
// for a still-open case.
const STATUS_LABEL: Record<CaseRecord['status'], string> = {
  draft: 'Draft', auto_cleared: 'Auto-cleared', flagged: 'In review', approved: 'Approved', rejected: 'Rejected',
}
const STATUS_TONE: Record<CaseRecord['status'], 'good' | 'warn' | 'crit' | 'neutral'> = {
  draft: 'neutral', auto_cleared: 'good', flagged: 'warn', approved: 'good', rejected: 'crit',
}

const FILTERS: { key: PartnerTypeCode | 'all'; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'distributor', label: 'Distributor' },
  { key: 'vendor', label: 'Vendor' },
]

// Human-readable flag reason per owning team (the Evaluation Agent's finding). Cases the New
// Application wizard raises carry their own computed flagDetail — use that when present instead
// of the generic seeded-case text, so the number shown here matches what actually failed.
function flagReason(c: CaseRecord): { summary: string; lines: TraceLine[] } {
  if (c.ownerRole === 'leadership') {
    const authority = c.signoffAuthority ?? 'SM'
    return {
      summary: c.flagDetail ?? ('Financial & infra checks clear — routed to ' + authority + ' for final sign-off.'),
      lines: [
        { text: '> Evaluation Agent — approval matrix', tone: 'accent' },
        { text: 'Checking financial criteria… meets threshold → CLEAR', tone: 'ok' },
        { text: 'Checking infrastructure & coverage… meets threshold → CLEAR', tone: 'ok' },
        { text: 'Decision: route to ' + authority + ' for final sign-off. Confidence: ' + c.confidencePct + '%.', tone: 'accent' },
      ],
    }
  }
  if (c.ownerRole === 'channel_dev') {
    return {
      summary: c.flagDetail ?? 'Infrastructure & coverage score is below the territory threshold.',
      lines: [
        { text: '> Evaluation Agent — approval matrix', tone: 'accent' },
        { text: 'Checking financial criteria… CC limit meets threshold → CLEAR', tone: 'ok' },
        { text: 'Checking infra & coverage… ' + (c.flagDetail ?? '6.4 vs required 7.0 → OUT OF RANGE'), tone: 'bad' },
        { text: 'Decision: route to Channel Development. Confidence: ' + c.confidencePct + '%.', tone: 'accent' },
      ],
    }
  }
  if (c.ownerRole === 'mdm') {
    return {
      summary: c.flagDetail ?? 'Document set incomplete — pending MDM verification.',
      lines: [
        { text: '> Evaluation Agent — approval matrix', tone: 'accent' },
        { text: 'Checking documents… 2 of 6 required documents missing → INCOMPLETE', tone: 'bad' },
        { text: 'Decision: route to MDM document check. Confidence: ' + c.confidencePct + '%.', tone: 'accent' },
      ],
    }
  }
  return {
    summary: c.flagDetail ?? 'CC limit ₹80L is below the required ₹100L threshold.',
    lines: [
      { text: '> Evaluation Agent — approval matrix', tone: 'accent' },
      { text: 'Checking financial criteria… ' + (c.flagDetail ?? 'CC limit ₹80L vs required ₹100L → OUT OF RANGE'), tone: 'bad' },
      { text: 'Checking infrastructure & coverage… meets threshold → CLEAR', tone: 'ok' },
      { text: 'Decision: route to Finance. Confidence: ' + c.confidencePct + '%.', tone: 'accent' },
    ],
  }
}

type EmailTarget = 'distributor' | 'asm'

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [FormsModule, ButtonComponent, CardComponent, ModalComponent, PillComponent, AgentTraceComponent, IconComponent, DisengagementFormModalComponent],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Module-level data/functions the template reads directly.
  protected readonly FILTERS = FILTERS
  protected readonly STATUS_LABEL = STATUS_LABEL
  protected readonly STATUS_TONE = STATUS_TONE
  protected readonly PARTNER_TYPE_COLOR = PARTNER_TYPE_COLOR
  protected readonly partnerTypeLabel = partnerTypeLabel
  protected readonly confidenceTone = confidenceTone
  protected readonly JOURNEY_CAPTION = JOURNEY_CAPTION

  /* ---------------- List view state ---------------- */
  protected readonly filter = signal<PartnerTypeCode | 'all'>('all')
  protected readonly scope = signal<'mine' | 'all'>('mine')
  protected readonly openCode = signal<string | null>(null)
  protected readonly notice = signal<string | null>(null)
  protected readonly selected = signal<string[]>([])

  protected readonly viewingAs = computed<RoleCode>(() => this.store.viewingAs() ?? 'ase_asm')
  protected readonly isOwner = computed(() => OWNER_ROLES.includes(this.viewingAs()))
  protected readonly effectiveScope = computed<'mine' | 'all'>(() => (this.isOwner() ? this.scope() : 'all'))
  // Only the owning reviewer teams (and admin) can actually approve/reject. An ASE/ASM or
  // Leadership can open a case and respond, but the approval decision is not theirs to make —
  // matching the scope doc's persona journeys and the workbook's SM/RBL/Finance sign-off model.
  protected readonly canApprove = computed(() => this.isOwner() || this.viewingAs() === 'admin')

  protected readonly titleForHelp = computed(() => (this.isOwner() && this.effectiveScope() === 'mine'
    ? 'Cases the Routing Agent sent to ' + ROLE_BY_CODE[this.viewingAs()].label + ' — only cases that couldn\'t auto-clear land here.'
    : 'Every case the agents couldn\'t auto-clear, across all partner types and owners.'))

  protected decide(code: string, decision: 'approved' | 'rejected' | 'info_requested'): void {
    const cases = this.store.flaggedCases()
    const c = cases.find((x) => x.code === code)
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    if (decision === 'info_requested') {
      if (c) this.store.requestInfoFromAsm({
        code, town: c.town, partnerName: c.partnerName, reviewerRole: viewingAs, reviewerName: me.name,
        note: 'More information needed on ' + code + ' before we can proceed — ' + flagReason(c).summary,
      })
      this.notice.set('Info requested on ' + code + ' — the ASM has been notified and a case thread opened.')
      this.openCode.set(null)
      return
    }
    this.store.decideCase(code, decision)
    if (c) {
      // Leadership approving a wizard-raised case is the final sign-off — it's what actually
      // activates the candidate into a real Partner (see decideCase's becomesActive in
      // store.ts), so it gets its own distinct "Onboarding Complete" audit line and a
      // notification back to the ASE/ASM who originated it, instead of reading like just
      // another routine approval in the trail. Gated to an actual Leadership actor (not admin
      // acting on their behalf) and to firing exactly once per case (onboardingNotified).
      const onboardingComplete = decision === 'approved' && viewingAs === 'leadership'
        && c.ownerRole === 'leadership' && !!c.candidateId && !c.onboardingNotified
      this.store.logAudit({
        actor: me.name, kind: 'human',
        action: onboardingComplete ? 'Onboarding Complete' : (decision === 'approved' ? 'Approved' : 'Rejected') + ' case (' + ROLE_BY_CODE[viewingAs].label + ')',
        entity: code,
      })
      if (onboardingComplete) {
        this.store.markOnboardingNotified(code)
        this.store.pushNotification({ title: code + ' — Onboarding Complete', body: c.partnerName + ' has cleared final sign-off and is now an active partner.', href: '/partners', forRole: 'ase_asm' })
      } else {
        this.store.pushNotification({ title: code + ' ' + decision, body: c.partnerName + ' — ' + decision + ' by ' + ROLE_BY_CODE[viewingAs].label + '.', href: '/approvals' })
      }
    }
    this.notice.set(code + ' ' + (decision === 'approved' ? 'approved' : 'rejected') + '.')
    this.openCode.set(null)
  }

  protected toggleSelect(code: string): void {
    this.selected.update((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]))
  }

  protected bulkApprove(): void {
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    const cases = this.store.flaggedCases()
    const selectedCases = this.selected().map((code) => cases.find((c) => c.code === code)).filter((c): c is CaseRecord => !!c)
    const codes = selectedCases.filter((c) => this.canDecideCase(c) && !caseDocGateBlocked(c)).map((c) => c.code)
    const blockedCount = selectedCases.filter((c) => this.canDecideCase(c) && caseDocGateBlocked(c)).length
    codes.forEach((code) => {
      const c = selectedCases.find((x) => x.code === code)
      this.store.decideCase(code, 'approved')
      const onboardingComplete = c?.ownerRole === 'leadership' && !!c.candidateId
      this.store.logAudit({
        actor: me.name, kind: 'human',
        action: onboardingComplete ? 'Onboarding Complete' : 'Approved case (' + ROLE_BY_CODE[viewingAs].label + ')',
        entity: code,
      })
      if (onboardingComplete && c) {
        this.store.pushNotification({ title: code + ' — Onboarding Complete', body: c.partnerName + ' has cleared final sign-off and is now an active partner.', href: '/partners', forRole: 'ase_asm' })
      }
    })
    this.notice.set(codes.length + ' case' + (codes.length !== 1 ? 's' : '') + ' approved in bulk.'
      + (blockedCount > 0 ? ' ' + blockedCount + ' skipped — Discontinuation Form still missing.' : ''))
    this.selected.set([])
  }

  // The decision itself belongs to whichever team currently owns the case, and only while it's
  // still open — "All cases"/history browsing lets Finance look at a Channel Dev case (or an
  // already-resolved one), but it shouldn't let them (re-)approve it.
  protected canDecideCase(c: CaseRecord): boolean {
    return (c.ownerRole === this.viewingAs() || this.viewingAs() === 'admin') && c.status === 'flagged'
  }
  // Was this role ever involved with the case — not just its CURRENT ownerRole — so "Mine"
  // doesn't lose it the moment ownership moves on (e.g. Channel Development approving their own
  // check on a dual-fail candidate flips status to 'approved' while ownerRole stays
  // 'channel_dev', or a single-fail case hands ownerRole off to 'leadership' entirely). Seeded
  // cases predating involvedRoles fall back to just their current ownerRole.
  private wasInvolved(c: CaseRecord): boolean {
    return (c.involvedRoles ?? [c.ownerRole]).includes(this.viewingAs())
  }

  protected readonly openCase = computed<CaseRecord | null>(() =>
    this.store.flaggedCases().find((c) => c.code === this.openCode()) ?? null)

  // "Mine" is now the full status/history view for this persona too, not just the still-open
  // queue — a team that was ever involved (e.g. Channel Development on a dual-fail candidate
  // now sitting with Finance, or already fully approved into an active Partner) keeps seeing
  // where it ended up instead of it disappearing from their own tab the moment it resolves or
  // hands off. "All cases" broadens the same history view to every team, not just yours.
  // flaggedCases never deletes a resolved case — decideCase only flips its status/ownerRole —
  // so this is genuinely the same record all the way through, including after the candidate
  // becomes an active Partner.
  protected readonly rows = computed(() => {
    const cases = this.store.flaggedCases()
    const effectiveScope = this.effectiveScope()
    const filter = this.filter()
    return cases
      .filter((c) => effectiveScope === 'all' || this.wasInvolved(c))
      .filter((c) => filter === 'all' || c.partnerType === filter)
  })

  protected roleLabel(role: string): string {
    return role.replace('_', ' ')
  }

  protected roleByCodeLabel(role: RoleCode): string {
    return ROLE_BY_CODE[role]?.label ?? role
  }

  // Half-donut confidence gauge — clamped/tone helpers backing the inline SVG in the template
  // (React's ArcGauge subcomponent, inlined here since screen-local subcomponents aren't
  // promoted to their own Angular component).
  protected arcGaugeClamped(pct: number): number {
    return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0))
  }
  protected arcGaugeTone(pct: number): string {
    const clamped = this.arcGaugeClamped(pct)
    return clamped >= 70 ? 'var(--good)' : clamped >= 50 ? 'var(--warn)' : 'var(--crit)'
  }

  protected iconForTone(tone: 'good' | 'warn' | 'crit'): IconName {
    return tone === 'good' ? 'check' : tone === 'warn' ? 'alert' : 'close'
  }
  protected journeyIcon(state: JourneyState): IconName {
    return state === 'done' ? 'check' : state === 'current' ? 'clock' : 'user'
  }

  // Opens the case-review pane for `code`, resetting every piece of review-local state back to
  // its default — mirrors the React source mounting a brand-new <CaseReview> (fresh useState)
  // every time a row/Review button is clicked from the list.
  protected openReview(code: string): void {
    this.openCode.set(code)
    this.discFormOpen.set(false)
    this.emailTarget.set(null)
    this.emailSubject.set('')
    this.emailBody.set('')
    this.emailSentNote.set(null)
    this.completingOnboarding.set(false)
    this.sendingEmail.set(false)
    this.sendEmailError.set(null)
    this.leadershipNote.set('')
    this.leadershipSentNote.set(null)
    this.traceOpen.set(false)
    this.approveMenuOpen.set(false)
    this.confirmNoDocKind.set(null)
  }

  protected backToQueue(): void {
    this.openCode.set(null)
  }

  /* ---------------- Case review ---------------- */
  // Reachable via "All cases" once a case is no longer flagged (see `rows`' filter above) —
  // browsable forever for history/status, but never re-decidable.
  protected readonly isResolved = computed(() => this.openCase()?.status !== 'flagged')
  protected readonly flagReasonResult = computed(() => {
    const c = this.openCase()
    return c ? flagReason(c) : null
  })
  protected readonly reviewCanApprove = computed(() => {
    const c = this.openCase()
    return c ? this.canDecideCase(c) : false
  })
  protected readonly linked = computed(() => this.openCase()?.hasDiscontinuationForm ?? false)
  protected readonly blocked = computed(() => {
    const c = this.openCase()
    return !!c && c.subtype === 'replacement' && !this.linked()
  })
  protected readonly discFormOpen = signal(false)

  protected askCopilot(): void {
    this.store.setCopilotAgent('evaluation')
    this.store.setCopilotOpen(true)
  }
  protected readonly discussLabel = computed(() => (this.viewingAs() === 'ase_asm' ? 'Reply in case thread' : 'Communication Agent'))
  protected discuss(): void {
    const c = this.openCase()
    if (!c) return
    this.store.openCaseDiscussion({ code: c.code, town: c.town, partnerName: c.partnerName })
    this.router.navigate(['/communication'])
  }

  // Two ways to reach the ASM or the distributor: a real (mock) outbound email, or the
  // internal Communication Agent thread — reviewer picks whichever fits, instead of one
  // button silently deciding for them.
  private readonly asmUser = DEMO_USERS.ase_asm // the ASM this prototype's cases are attributed to
  protected readonly distributorEmail = computed(() => {
    const c = this.openCase()
    return c ? emailForCase(c, this.store.candidates()) : ''
  })
  protected readonly emailTarget = signal<EmailTarget | null>(null)
  protected readonly emailSubject = signal('')
  protected readonly emailBody = signal('')
  protected readonly emailSentNote = signal<string | null>(null)
  protected readonly emailTo = computed(() => (this.emailTarget() === 'asm' ? this.asmUser.email : this.distributorEmail()))
  protected readonly emailRecipientName = computed(() => (this.emailTarget() === 'asm' ? this.asmUser.name : (this.openCase()?.partnerName ?? '')))
  // When Leadership's final sign-off opens this composer (see approveWithConditions below),
  // sending the email is also what actually completes the approval — one confirmed action
  // instead of the decision silently firing before the distributor's even been told.
  protected readonly completingOnboarding = signal(false)
  protected openEmail(target: EmailTarget): void {
    const c = this.openCase()
    if (!c) return
    const summary = this.flagReasonResult()?.summary ?? ''
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    this.emailTarget.set(target)
    this.emailSentNote.set(null)
    if (target === 'asm') {
      this.emailSubject.set(c.code + ' — need your input')
      this.emailBody.set('Hi ' + this.asmUser.name + ',\n\n' + summary + '\n\nCan you share any context that would help ' + ROLE_BY_CODE[viewingAs].label + ' decide on ' + c.partnerName + ' (' + c.code + ')?\n\nThanks,\n' + me.name)
    } else {
      this.emailSubject.set('Action needed on your application — ' + c.code)
      this.emailBody.set('Hi ' + c.partnerName + ' team,\n\nWe\'re reviewing your application (' + c.code + ') and need your help closing out one item:\n\n' + summary + '\n\nCould you share an update or supporting documents at your earliest convenience?\n\nThanks,\n' + me.name + '\n' + ROLE_BY_CODE[viewingAs].label + ', Acme Distribution')
    }
  }
  protected openOnboardingCompleteEmail(): void {
    const c = this.openCase()
    if (!c) return
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    const hasConditions = this.hasConditions()
    const conditions = this.conditions()
    this.emailTarget.set('distributor')
    this.emailSentNote.set(null)
    this.completingOnboarding.set(true)
    this.emailSubject.set('Welcome to Acme Distribution — ' + c.partnerName + ' onboarding complete')
    this.emailBody.set('Hi ' + c.partnerName + ' team,\n\nGreat news — your onboarding (' + c.code + ') has cleared final sign-off and you\'re now live as an Acme Distribution partner.'
      + (hasConditions ? ('\n\nA few things to keep in mind:\n' + conditions.map((cond) => '- ' + cond).join('\n')) : '')
      + '\n\nWelcome aboard — looking forward to working together.\n\nRegards,\n' + me.name + '\n' + ROLE_BY_CODE[viewingAs].label + ', Acme Distribution')
  }
  protected readonly sendingEmail = signal(false)
  protected readonly sendEmailError = signal<string | null>(null)
  // Real SMTP send (same backend endpoint the intake "request missing info" reply uses) —
  // every email action on this screen (Email ASM, Email/Request from distributor, Complete
  // Onboarding) genuinely reaches the recipient's inbox instead of only logging that it did.
  protected async sendEmail(): Promise<void> {
    const c = this.openCase()
    if (!c) return
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    const emailTo = this.emailTo()
    const emailRecipientName = this.emailRecipientName()
    const completingOnboarding = this.completingOnboarding()
    const hasConditions = this.hasConditions()
    const conditions = this.conditions()
    this.sendingEmail.set(true)
    this.sendEmailError.set(null)
    try {
      await apiPost('/api/mail/reply', this.store.authToken(), { to: emailTo, subject: this.emailSubject(), text: this.emailBody() })
      this.store.logAudit({ actor: me.name, kind: 'human', action: 'Emailed ' + emailRecipientName + ' (' + emailTo + ') re: ' + c.code, entity: c.code })
      if (completingOnboarding) {
        if (hasConditions) this.store.logAudit({ actor: me.name, kind: 'human', action: 'Approved with conditions (' + conditions.join('; ') + ')', entity: c.code })
        this.decide(c.code, 'approved')
        this.completingOnboarding.set(false)
      } else {
        this.emailSentNote.set('Email sent to ' + emailTo + ' just now.')
        this.emailTarget.set(null)
      }
    } catch (err) {
      this.sendEmailError.set(err instanceof Error ? err.message : 'Send failed')
    } finally {
      this.sendingEmail.set(false)
    }
  }

  protected closeEmailModal(): void {
    this.emailTarget.set(null)
    this.completingOnboarding.set(false)
  }

  // Note for Leadership — persisted on the case itself (notesForLeadership) so it's actually
  // readable once the case reaches their queue, plus the one-time notification/audit line for
  // immediate visibility.
  protected readonly leadershipNote = signal('')
  protected readonly leadershipSentNote = signal<string | null>(null)
  protected sendLeadershipNote(): void {
    const c = this.openCase()
    if (!c) return
    const note = this.leadershipNote().trim()
    if (!note) return
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    this.store.addCaseNoteForLeadership(c.code, me.name, note)
    this.store.pushNotification({ title: 'Note on ' + c.code + ' from ' + ROLE_BY_CODE[viewingAs].label, body: note, href: '/approvals', forRole: 'leadership' })
    this.store.logAudit({ actor: me.name, kind: 'human', action: 'Left a note for Leadership on ' + c.code, entity: c.code })
    this.leadershipSentNote.set('Leadership has been notified.')
    this.leadershipNote.set('')
  }

  // AI Recommendation hero + Decision Panel — derived entirely from real case data. `cc` fills
  // in a numeric snapshot from the flag text itself when the case predates/lacks a structured
  // one (older persisted cases), so the real percentage/score is never silently hidden.
  protected readonly cc = computed<CaseRecord | null>(() => {
    const c = this.openCase()
    if (!c) return null
    return { ...c, financeSnapshot: deriveFinanceSnapshot(c), channelSnapshot: deriveChannelSnapshot(c) }
  })
  protected readonly teamLabel = computed(() => {
    const c = this.openCase()
    return c ? TEAM_LABEL[c.ownerRole] : ''
  })
  // Everything Leadership needs to see before final sign-off: the full audit trail (approvals,
  // rejections, emails, notes) plus the case's internal chat thread — not just a blank note box.
  protected readonly auditTrail = computed(() => {
    const c = this.openCase()
    return c ? getCaseAuditTrail(c.code, this.store.auditLog()) : []
  })
  protected readonly thread = computed(() => {
    const c = this.openCase()
    return c ? this.store.commThreads().find((t) => t.code === c.code) : undefined
  })
  protected readonly risk = computed(() => riskLevel(gapRatioFor(this.cc() as CaseRecord)))
  protected readonly traceOpen = signal(false)
  protected readonly insights = computed(() => {
    const cc = this.cc()
    const fr = this.flagReasonResult()
    return cc && fr ? aiInsights(cc, fr.summary) : []
  })
  protected readonly journey = computed(() => {
    const c = this.openCase()
    return c ? journeySteps(c, this.teamLabel()) : []
  })
  protected readonly hasConditions = computed(() => {
    const cc = this.cc()
    return !!(cc?.financeSnapshot || cc?.channelSnapshot)
  })
  protected readonly conditions = computed<string[]>(() => {
    const cc = this.cc()
    const conditions: string[] = ['ASM confirmation required']
    if (cc?.financeSnapshot) conditions.push('Distributor to infuse ₹' + Math.ceil(cc.financeSnapshot.fundingGap) + 'L capital')
    if (cc?.channelSnapshot) conditions.push('Distributor to close the coverage gap (' + cc.channelSnapshot.gap.toFixed(1) + '/10) before next review')
    conditions.push('Review after 90 days')
    return conditions
  })

  // Finance cases gate on one real document — the distributor's bank statement, which is what
  // actually backs the Own Funds / CC Limit figures — not a checklist of unrelated paperwork.
  protected readonly financeDocs = computed(() => this.openCase()?.financeDocsUploaded ?? {})
  protected readonly bankStatementFileInput = viewChild<ElementRef<HTMLInputElement>>('bankStatementFileInput')
  protected readonly bankStatementDoc = computed(() => this.financeDocs()[BANK_STATEMENT_KEY])
  // No longer a hard block — just flags that the bank statement isn't on file yet, so Approve
  // can surface a "continue anyway?" confirmation instead of disabling the button outright.
  protected readonly financeGateBlocked = computed(() => !!this.cc()?.financeSnapshot && !this.bankStatementDoc())
  // Real file if the reviewer actually attached one; the synthetic "mock" PDF (built from the
  // case's own numbers) only ever stands in for seeded/legacy cases that never had a real upload.
  protected readonly canAct = computed(() => this.viewingAs() === 'ase_asm' || this.reviewCanApprove())
  protected triggerBankStatementUpload(): void {
    this.bankStatementFileInput()?.nativeElement.click()
  }
  protected bankStatementPdf(): Blob | undefined {
    const cc = this.cc()
    const c = this.openCase()
    if (!cc?.financeSnapshot || !c) return undefined
    return buildPdf([
      { text: 'Acme Distribution Partner Platform — Bank Statement Summary', size: 9, gap: 18 },
      { text: c.partnerName, size: 18, bold: true, gap: 30 },
      { text: 'Account type: Cash Credit (CC) · ' + c.town + ', ' + c.state, size: 10.5, gap: 22 },
      { text: 'Financials', size: 13, bold: true, gap: 22 },
      { text: 'Total Own Funds / Borrowed (₹L):   ' + cc.financeSnapshot.ownFunds, size: 11, gap: 18 },
      { text: 'CC Limit (₹L):   ' + cc.financeSnapshot.ccLimit, size: 11, gap: 18 },
      { text: ' ', gap: 6 },
      { text: 'Total Available Capital (₹L):   ' + cc.financeSnapshot.capitalAvailable, size: 11, gap: 18 },
      { text: 'Required Investment (₹L):   ' + cc.financeSnapshot.requiredInvestment, size: 11, gap: 18 },
      { text: ' ', gap: 20 },
      { text: 'Generated preview PDF — prototype stand-in for the actual bank statement.', size: 8.5 },
    ])
  }
  protected viewBankStatement(): void {
    const doc = this.bankStatementDoc()
    if (doc?.dataUrl) { window.open(doc.dataUrl, '_blank'); return }
    const b = this.bankStatementPdf()
    if (b) openPdfInNewTab(b)
  }
  protected onPickFile(e: Event): void {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    const c = this.openCase()
    if (!c) return
    const code = c.code
    const reader = new FileReader()
    reader.onload = () => this.store.uploadCaseFinanceDoc(code, BANK_STATEMENT_KEY, f.name, typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(f)
  }

  // Attachments — only the linked candidate's real received documents (from its intake
  // extraction); no attachments card at all when there's nothing real to point to.
  protected readonly linkedCandidate = computed(() => {
    const c = this.openCase()
    return c ? this.store.candidates().find((x) => x.id === c.candidateId) : undefined
  })
  protected readonly linkedExt = computed(() => {
    const lc = this.linkedCandidate()
    return lc?.sourceIntakeId ? EXTRACTIONS[lc.sourceIntakeId] : undefined
  })
  protected readonly attachments = computed(() => this.linkedExt()?.documents?.filter((d) => d.received) ?? [])
  protected previewDoc(d: RequiredDoc): void {
    const c = this.openCase()
    if (!c) return
    openPdfInNewTab(buildPdf([
      { text: 'Acme Distribution Partner Platform — Document on file', size: 9, gap: 18 },
      { text: d.name, size: 18, bold: true, gap: 30 },
      { text: c.partnerName, size: 11, gap: 20 },
      { text: 'Status: Received' + (d.file ? (' — ' + d.file) : ''), size: 10.5, gap: 18 },
      { text: ' ', gap: 20 },
      { text: 'Generated preview PDF — prototype stand-in for the actual scan.', size: 8.5 },
    ]))
  }

  // Leadership approving a wizard-raised case is the final sign-off — the same "becomes a real
  // Partner" transition decideCase makes in store.ts — so instead of deciding silently, it opens
  // the onboarding-complete email to the distributor first; sending it is what actually confirms
  // the approval (see sendEmail above).
  protected readonly isFinalOnboardingApproval = computed(() => {
    const c = this.openCase()
    return this.viewingAs() === 'leadership' && c?.ownerRole === 'leadership' && !!c?.candidateId
  })
  protected readonly approveMenuOpen = signal(false)
  protected approveWithConditions(): void {
    const c = this.openCase()
    if (!c) return
    if (this.isFinalOnboardingApproval()) { this.openOnboardingCompleteEmail(); return }
    if (this.hasConditions()) {
      const viewingAs = this.viewingAs()
      const me = DEMO_USERS[viewingAs]
      this.store.logAudit({ actor: me.name, kind: 'human', action: 'Approved with conditions (' + this.conditions().join('; ') + ')', entity: c.code })
    }
    this.decide(c.code, 'approved')
  }
  protected approvePlain(): void {
    const c = this.openCase()
    if (!c) return
    this.approveMenuOpen.set(false)
    if (this.isFinalOnboardingApproval()) { this.openOnboardingCompleteEmail(); return }
    this.decide(c.code, 'approved')
  }
  // The bank statement is no longer a hard gate — approving without it just asks the reviewer
  // to confirm they're ready to continue (they can leave a Note for Leadership above first).
  protected readonly confirmNoDocKind = signal<'plain' | 'conditions' | null>(null)
  protected requestApprove(kind: 'plain' | 'conditions'): void {
    if (this.financeGateBlocked()) { this.confirmNoDocKind.set(kind); return }
    if (kind === 'plain') this.approvePlain(); else this.approveWithConditions()
  }
  protected confirmApproveWithoutDoc(): void {
    const kind = this.confirmNoDocKind()
    this.confirmNoDocKind.set(null)
    if (kind === 'plain') this.approvePlain(); else if (kind === 'conditions') this.approveWithConditions()
  }
}
