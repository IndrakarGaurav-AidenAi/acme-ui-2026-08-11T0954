import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent, ToggleComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { AgentTraceComponent } from '../components/ui/AgentTrace'
import type { TraceLine } from '../components/ui/AgentTrace'
import { IconComponent } from '../components/ui/icons'
import { AppStore, nextCaseCode, slaLabelFromHours } from '../store'
import { PARTNER_TYPES, WIZARD_BUILT } from '../mock/templates'
import {
  DB_TYPES, DEFAULT_INFRA,
  EXPECTED_ACME_TURNOVER, FIN_EVAL_PASS, INFRA_FACTORS, INFRA_THRESHOLD,
  REQUIRED_INVESTMENT, approvalAuthority, meanInfra, round1,
} from '../mock/onboarding'
import type { DbCategory } from '../mock/onboarding'
import { CANDIDATE_STAGES, IDEAL_DB, DIRECTORY_LEADS } from '../mock/candidates'
import {
  BASIC_INFORMATION, BACKGROUND_INFORMATION, COVERAGE_DATA, FINANCIAL_BREAKDOWN, TOTAL_INVESTMENT_REQUIRED,
} from '../mock/recommendationForm'
import type { ApplicationSubtype, CandidateCard, CandidateStage, CaseRecord, DisengagementForm, PartnerTypeCode } from '../types'
import { EXTRACTIONS, mergedFields } from '../mock/intake'
import type { Extraction, RequiredDoc } from '../mock/intake'
import { buildPdf, openPdfInNewTab } from '../lib/pdf'
import { apiPost } from '../lib/api'
import { DEMO_USERS, ROLE_BY_CODE } from '../mock/roles'
import { DisengagementFormModalComponent } from '../components/DisengagementForm'

// The Intake and Recommend wizard steps were folded away — that content (the recommendation
// form fields, the AI outcome prediction, the accept/override choice) now lives entirely in
// the Leads step's "View details" popup, so Leads goes straight to Evaluate.
type Step = 'type' | 'candidates' | 'evaluate' | 'finance-review' | 'channel-review' | 'agreement' | 'success'

// A candidate's pipeline stage is an outcome of the wizard steps it has actually cleared —
// never something set by hand. Entering one of these steps advances the stage; navigating
// back does not regress it, since real approval status doesn't un-happen.
const STAGE_ON_ENTER: Partial<Record<Step, CandidateStage>> = {
  evaluate: 'pending',
  'finance-review': 'approval_1', 'channel-review': 'approval_2',
  agreement: 'approval_2',
}
const MAIN_STEPS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Type' }, { id: 'candidates', label: 'Leads' },
  { id: 'evaluate', label: 'Evaluate' }, { id: 'finance-review', label: 'Review' }, { id: 'agreement', label: 'Agreement' },
]
const PT_COLOR: Record<PartnerTypeCode, string> = {
  distributor: 'var(--p-finance)', vendor: 'var(--p-mdm)', logistics: 'var(--p-channel)', copacker: 'var(--p-ase)',
}

// The "+ Add" picker draws from the Partner directory (via DIRECTORY_LEADS) so the leads you
// can add are the same partners shown in the Partners directory.
const LEAD_CANDIDATES: CandidateCard[] = DIRECTORY_LEADS

// Logistics Partner and Co-packer are upcoming — hidden from New Application until their wizards ship.
const VISIBLE_PARTNER_TYPES = PARTNER_TYPES.filter((t) => t.code !== 'logistics' && t.code !== 'copacker')

const MAX_COMPARE = 3

function coverageTag(ol: number): { label: string; tone: 'good' | 'warn' | 'crit' } {
  return ol >= 2000 ? { label: 'High', tone: 'good' } : ol >= 1000 ? { label: 'Medium', tone: 'warn' } : { label: 'Low', tone: 'crit' }
}
function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

// Same override resolution the wizard's own Intake step uses (createLead's setOv calls) —
// rebuilt per-lead so the popup can show real values for ANY compared lead, not just whichever
// one is currently active in the wizard (the only one with a live overrides object).
// Return type is deliberately `string | undefined` (not plain `string`) even though every branch
// below only ever assigns a string — only a handful of labels are ever set (the rest of this
// sparse map's keys genuinely read back as undefined at runtime), and callers rely on that via
// `?? fallback`. A plain `Record<string, string>` return type would claim every lookup always
// succeeds, which is what caused Angular's template checker to flag that `??` as dead code.
function overridesForLead(c: CandidateCard, ext?: Extraction): Record<string, string | undefined> {
  const overrides: Record<string, string> = {
    'Agency / Firm name': c.name,
    Town: c.town,
    'Total Monthly Turnover of the Firm': String(c.turnoverMonthly),
    'Expected Acme turnover per month': String(c.expectedAcmeTurnover),
  }
  if (ext) {
    const val = (re: RegExp) => mergedFields(ext).find((f) => re.test(f.label) && f.ok)?.value
    const state = val(/^state/i), phone = val(/phone/i)
    if (state) overrides['State'] = state
    if (phone) overrides['Phone Number'] = phone
  }
  return overrides
}

// Real email address when the lead came in over email intake; a plausible placeholder
// otherwise (seeded/directory leads carry no email on the CandidateCard itself).
function emailForCandidate(c: CandidateCard): string {
  const ext = c.sourceIntakeId ? EXTRACTIONS[c.sourceIntakeId] : undefined
  if (ext?.channel === 'email') return ext.source
  const emailField = ext ? mergedFields(ext).find((f) => /email/i.test(f.label) && f.ok)?.value : undefined
  if (emailField) return emailField
  return c.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '') + '@example.com'
}

// Matches the Excel workbook's "New DB (new town opening) / Replacement DB / Additional DB (in
// same town)" dropdown labels exactly, so the wizard reads the same as the sheet it mirrors.
const SUBTYPE_LABEL: Record<ApplicationSubtype, string> = {
  new: 'New DB (new town opening)', replacement: 'Replacement DB', additional: 'Additional DB (in same town)',
}

/* ---------- Step 4: evaluation (batch) types + helpers ---------- */
interface Evaluated { c: CandidateCard; fin: number; infra: number; financePass: boolean; channelPass: boolean }
interface DocField { k: string; claimed: string; extracted: string; ok: boolean }
interface EvalDoc { name: string; file: string; fields: DocField[] }
function routeLabel(e: Evaluated): { label: string; tone: 'good' | 'warn' | 'crit' } {
  if (e.financePass && e.channelPass) return { label: 'Auto-clear', tone: 'good' }
  const to = [!e.financePass && 'Finance', !e.channelPass && 'Trade Marketing'].filter(Boolean).join(' + ')
  return { label: '→ ' + to, tone: e.financePass || e.channelPass ? 'warn' : 'crit' }
}

// The documents the Document Intelligence Agent reads for the proceeding candidate. Each
// carries the fields it extracted and whether they matched the claimed values.
function docsForCandidate(c: CandidateCard): EvalDoc[] {
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return [
    { name: 'GST Certificate', file: 'GST_' + slug + '.pdf', fields: [
      { k: 'GSTIN', claimed: '27ABCPD1234K1Z5', extracted: '27ABCPD1234K1Z5', ok: true },
      { k: 'Legal name', claimed: c.name, extracted: c.name, ok: true },
    ] },
    { name: 'DB Onboarding Form', file: 'DB_Form_' + slug + '.pdf', fields: [
      { k: 'Firm name', claimed: c.name, extracted: c.name.replace(/s$/, ''), ok: false },
      { k: 'Contact person', claimed: 'On file', extracted: 'On file', ok: true },
      { k: 'DB category', claimed: c.dbCategory, extracted: c.dbCategory, ok: true },
    ] },
    { name: 'Godown Proof', file: 'Godown_' + slug + '.pdf', fields: [
      { k: 'Warehouse address', claimed: 'Plot 14, MIDC ' + c.town, extracted: 'Plot 14, MIDC ' + c.town, ok: true },
      { k: 'Area (sq ft)', claimed: '4,500', extracted: '4,500', ok: true },
    ] },
  ]
}

/* ---------- Candidates step compare table row model ---------- */
type CmpRowKind =
  | 'plain' | 'coverage' | 'pct' | 'infraFactor' | 'infraTotal' | 'channelCheck'
  | 'ownFunds' | 'ccLimit' | 'finEvalPct' | 'financeCheck' | 'route'
interface CmpRow {
  label: string
  kind: CmpRowKind
  value: (c: CandidateCard) => number
  ideal: string | number
  noBest?: boolean
  factorKey?: string
}
interface CmpSection { title: string; rows: CmpRow[] }

@Component({
  selector: 'app-new-application',
  standalone: true,
  imports: [
    FormsModule, ButtonComponent, CardComponent, ModalComponent, PillComponent, ToggleComponent,
    IconComponent, AgentTraceComponent, DisengagementFormModalComponent,
  ],
  templateUrl: './new-application.component.html',
  styleUrl: './new-application.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewApplicationComponent implements OnInit {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Module-level data/constants the template reads directly.
  protected readonly MAIN_STEPS = MAIN_STEPS
  protected readonly VISIBLE_PARTNER_TYPES = VISIBLE_PARTNER_TYPES
  protected readonly PARTNER_TYPES = PARTNER_TYPES
  protected readonly PT_COLOR = PT_COLOR
  protected readonly DB_TYPES = DB_TYPES
  protected readonly INFRA_FACTORS = INFRA_FACTORS
  protected readonly LEAD_CANDIDATES = LEAD_CANDIDATES
  protected readonly CANDIDATE_STAGES = CANDIDATE_STAGES
  // Template needs the literal cap for the "up to N leads at a time" copy in the compare header.
  protected readonly MAX_COMPARE = MAX_COMPARE
  protected readonly IDEAL_DB = IDEAL_DB
  protected readonly BASIC_INFORMATION = BASIC_INFORMATION
  protected readonly BACKGROUND_INFORMATION = BACKGROUND_INFORMATION
  protected readonly COVERAGE_DATA = COVERAGE_DATA
  protected readonly FINANCIAL_BREAKDOWN = FINANCIAL_BREAKDOWN
  protected readonly TOTAL_INVESTMENT_REQUIRED = TOTAL_INVESTMENT_REQUIRED
  protected readonly SUBTYPE_LABEL = SUBTYPE_LABEL
  protected readonly REQUIRED_INVESTMENT = REQUIRED_INVESTMENT
  protected readonly FIN_EVAL_PASS = FIN_EVAL_PASS
  protected readonly INFRA_THRESHOLD = INFRA_THRESHOLD
  protected readonly EXPECTED_ACME_TURNOVER = EXPECTED_ACME_TURNOVER
  protected readonly ROLE_BY_CODE = ROLE_BY_CODE
  protected readonly coverageTag = coverageTag
  protected readonly initials = initials
  // The "Original intake" panel in the lead-detail popup renders every merged field directly.
  protected readonly mergedFields = mergedFields

  // A lead created from the Intake Inbox already implies a partner type (its documents/fields
  // are shaped for one) — skip straight past the Type step instead of asking the user to redo it.
  // Only skip when that type's wizard actually exists; otherwise land on Type with it pre-selected
  // so the "Phase 2" gate explains why (rather than dropping into the distributor-shaped flow).
  private readonly initNav = ((this.router.getCurrentNavigation()?.extras.state ?? null) as
    | { partnerType?: PartnerTypeCode; intakeLead?: CandidateCard }
    | null)
  private readonly skipType = this.initNav?.partnerType
  private readonly skipBuilt = this.skipType ? WIZARD_BUILT[this.skipType] : false
  // When the field team's shortlist is already waiting (Trade Marketing arriving from the
  // "Lead shortlisted" notification or the sidebar), skip Type and open on the comparison.
  // Captured once at construction (mirrors the source's `useApp.getState()` one-time read).
  private readonly shortlistWaitingAtInit = this.store.evalIds().length > 0

  protected readonly step = signal<Step>(this.skipBuilt || this.shortlistWaitingAtInit ? 'candidates' : 'type')
  protected readonly partnerType = signal<PartnerTypeCode | null>(this.skipType ?? (this.shortlistWaitingAtInit ? 'distributor' : null))

  // Batch-proceed with all checked leads (used by the success step's summary table).
  protected readonly batchChosen = signal<Evaluated[]>([])

  // ---- Candidates step local state ----
  protected readonly candPickerOpen = signal(false)
  protected readonly candDiffOnly = signal(false)
  protected readonly candHighlightDiff = signal(false)
  protected readonly candLeadDetailId = signal<string | null>(null)
  protected readonly candCatFilter = signal<DbCategory | 'all'>('all')
  protected readonly ldDiscFormOpen = signal(false)

  // ---- Evaluate step local state ----
  protected readonly evalDone = signal(false)
  protected readonly evalFrozenEval = signal<Evaluated[] | null>(null)
  protected readonly evalFrozenLines = signal<TraceLine[] | null>(null)
  protected readonly evalCheckedIds = signal<string[]>([])
  protected readonly evalProceedId = signal('')
  protected readonly evalDocOn = signal(false)
  protected readonly evalOpenDetail = signal<string | null>(null)
  protected readonly evalDocView = signal<EvalDoc | null>(null)

  // ---- Review step (finance-review / channel-review) local state ----
  protected readonly reviewMsgs = signal<{ who: string; role: string; txt: string; color: string }[]>([])
  protected readonly reviewDraft = signal('')
  protected readonly reviewEmailOpen = signal(false)
  protected readonly reviewEmailSubject = signal('')
  protected readonly reviewEmailBody = signal('')
  protected readonly reviewEmailSentNote = signal<string | null>(null)
  protected readonly reviewLeadershipNote = signal('')
  protected readonly reviewLeadershipSentNote = signal<string | null>(null)
  protected readonly reviewDecisionPick = signal<'approved' | 'conditional' | 'rejected' | null>(null)
  protected readonly reviewDecisionNote = signal('')
  protected readonly reviewDetailsOpen = signal(false)

  // ---- Agreement step local state ----
  protected readonly agreementSent = signal(false)
  protected readonly agreementSending = signal(false)
  protected readonly agreementSendError = signal<string | null>(null)
  protected readonly agreementNote = signal('')
  protected readonly agreementRoutedToLeadership = signal(false)

  // Approval authority: >₹50L expected Acme turnover ⇒ RBL, else SM. Constant for this demo scenario.
  protected readonly authority: 'SM' | 'RBL' = approvalAuthority(EXPECTED_ACME_TURNOVER)
  protected readonly viewingAs = computed(() => this.store.viewingAs() ?? 'ase_asm')

  constructor() {
    // Never leave the "proceed" candidate outside the evaluation set.
    effect(() => {
      const evalIds = this.store.evalIds()
      const selectedId = this.store.selectedCandidateId()
      if (evalIds.length && !evalIds.includes(selectedId)) this.store.setSelectedCandidateId(evalIds[0])
    })

    // The Scenario toggle presets the numbers so the demo cleanly auto-clears or flags.
    effect(() => {
      const scenario = this.store.scenario()
      if (scenario === 'flagged') {
        this.store.setInfra({ salesmen: 6, delivery: 6, godown: 6, computer: 7, reputation: 6, coverage: 6, credit: 7, involvement: 6 })
        this.store.setOwnFunds(90)
        this.store.setCcLimit(40) // (90+40)/144.6 = 90% ⇒ Financial Evaluation fails
      } else {
        this.store.setInfra({ ...DEFAULT_INFRA })
        this.store.setOwnFunds(120)
        this.store.setCcLimit(80) // 138% + infra 8 ⇒ auto-clear
      }
    })

    // Reset each step's own local state whenever the wizard actually (re-)enters it — mirrors
    // React unmounting/remounting a fresh step-component instance on every transition into it,
    // since these steps are screen-local subcomponents inlined onto this one component.
    effect(() => {
      const step = this.step()
      if (step === 'candidates') this.resetCandidatesState()
      else if (step === 'evaluate') this.resetEvaluateState()
      else if (step === 'finance-review') this.resetReviewState(true)
      else if (step === 'channel-review') this.resetReviewState(false)
      else if (step === 'agreement') this.resetAgreementState()
    })
  }

  ngOnInit(): void {
    // Arrived from an Intake item → drop that lead into the pipeline, select & tick it, and open
    // on the Leads step, so the wizard reflects the reviewed lead rather than a pre-seeded one.
    const lead = this.initNav?.intakeLead
    if (lead && WIZARD_BUILT[this.initNav?.partnerType ?? 'distributor']) {
      this.store.shortlistCandidate(lead)
      this.step.set('candidates')
    }
  }

  // ---- Shared derived state ----
  // Explicit `| undefined` return type: candidates[0] is itself only safe when the array is
  // non-empty (store.ts's candidates signal legitimately starts empty), so this can genuinely
  // resolve to undefined at runtime even though plain inference (without noUncheckedIndexedAccess)
  // would otherwise call it always-defined and flag every `selected()?.` in the template as dead.
  protected readonly selected = computed<CandidateCard | undefined>(() => {
    const candidates = this.store.candidates()
    const id = this.store.selectedCandidateId()
    return candidates.find((c) => c.id === id) ?? candidates[0]
  })
  protected readonly infraTotal = computed(() => meanInfra(this.store.infra()))
  protected readonly finEval = computed(() => Math.round(((this.store.ownFunds() + this.store.ccLimit()) / REQUIRED_INVESTMENT) * 100))
  protected readonly financePass = computed(() => this.finEval() >= FIN_EVAL_PASS)
  protected readonly channelPass = computed(() => this.infraTotal() >= INFRA_THRESHOLD)
  // Carried from the Create Lead / intake form's subtype selection (defaults to 'new' when absent).
  protected readonly isReplacement = computed(() => this.selected()?.subtype === 'replacement')
  protected readonly stepIndex = computed(() => {
    const idx = MAIN_STEPS.findIndex((f) => f.id === this.step())
    return idx === -1 ? (this.step() === 'channel-review' ? 3 : 0) : idx
  })

  // A candidate that's already been activated has a real Partner record — it belongs only in
  // the Partners directory from here on. One that's been routed to Finance/Channel review
  // (approval_1/approval_2) is now Approvals' to work, not New Application's.
  protected readonly pipelineCandidates = computed(() =>
    this.store.candidates().filter((c) => c.stage !== 'active' && c.stage !== 'approval_1' && c.stage !== 'approval_2'))

  protected readonly evaluated = computed<Evaluated[]>(() => {
    const pipeline = this.pipelineCandidates()
    const evalIds = this.store.evalIds()
    const selectedId = this.store.selectedCandidateId()
    const finEval = this.finEval()
    const infraTotal = this.infraTotal()
    return pipeline.filter((c) => evalIds.includes(c.id)).map((c) => {
      const fin = c.id === selectedId ? finEval : c.finEvalPct
      const infra = c.id === selectedId ? infraTotal : c.infraScore
      return { c, fin, infra, financePass: fin >= FIN_EVAL_PASS, channelPass: infra >= INFRA_THRESHOLD }
    })
  })

  protected readonly built = computed(() => {
    const pt = this.partnerType()
    return pt ? WIZARD_BUILT[pt] : false
  })

  protected stageLabel(c: CandidateCard): string {
    return CANDIDATE_STAGES.find((s) => s.id === c.stage)?.label ?? c.stage
  }

  // Reproduce a candidate's stored score on the live sliders, so proceeding with it keeps
  // the downstream review/routing consistent with what the comparison showed.
  protected loadCandidateScores(c: CandidateCard): void {
    const v = Math.max(1, Math.min(10, Math.round(c.infraScore)))
    this.store.setInfra({ salesmen: v, delivery: v, godown: v, computer: v, reputation: v, coverage: v, credit: v, involvement: v })
    const total = Math.round((c.finEvalPct / 100) * REQUIRED_INVESTMENT)
    const own = Math.min(200, Math.max(0, Math.round(total * 0.6)))
    this.store.setOwnFunds(own)
    this.store.setCcLimit(Math.min(150, Math.max(0, total - own)))
  }
  protected chooseProceed(id: string): void {
    if (id === this.store.selectedCandidateId()) return
    const c = this.store.candidates().find((x) => x.id === id)
    if (c) { this.loadCandidateScores(c); this.store.setSelectedCandidateId(id) }
  }

  protected addLead(c: CandidateCard): void { this.store.shortlistCandidate(c) }
  protected removeLead(id: string): void { this.store.removeCandidate(id) }

  protected clickSidenavStep(i: number, id: Step): void {
    if (i <= this.stepIndex()) this.step.set(id)
  }

  // Forward navigation advances the selected candidate's stage to match; backward navigation
  // (sidenav clicks, "Back" buttons) never regresses it — status only moves forward with progress.
  protected goToStep(next: Step): void {
    const stage = STAGE_ON_ENTER[next]
    if (stage) this.store.moveCandidate(this.store.selectedCandidateId(), stage)

    // Entering finance/channel review means the candidate was actually flagged — raise a real
    // case in the shared Approvals queue so the owning team can see and act on it there. A
    // candidate can fail BOTH checks — raise a case for EVERY team that's failing right now.
    if ((next === 'finance-review' || next === 'channel-review') && this.selected()) {
      const selected = this.selected()!
      const infra = this.store.infra()
      const ownFunds = this.store.ownFunds()
      const ccLimit = this.store.ccLimit()
      const infraTotalVal = meanInfra(infra)
      const finEvalVal = Math.round(((ownFunds + ccLimit) / REQUIRED_INVESTMENT) * 100)
      const partnerType = this.partnerType()
      const slaHours = this.store.slaHours()
      const authority = this.authority
      const codesSoFar = [...this.store.flaggedCases()]
      const raiseCase = (finance: boolean) => {
        const teamLabel = finance ? 'Finance' : 'Trade Marketing'
        // Re-entering this step for a candidate already raised must update that same team's
        // case, not mint a fresh code that'd just raise a duplicate.
        const existingCase = this.store.flaggedCases().find((c) => c.candidateId === selected.id && c.ownerRole === (finance ? 'finance' : 'channel_dev'))
        const caseCode = existingCase?.code ?? nextCaseCode(codesSoFar, partnerType ?? 'distributor')
        codesSoFar.push({ code: caseCode } as CaseRecord)
        const flagDetail = finance
          ? 'CC limit + own funds (₹' + (ownFunds + ccLimit) + 'L) are ' + (FIN_EVAL_PASS - finEvalVal) + '% below the ₹' + REQUIRED_INVESTMENT + 'L required investment (Financial Evaluation ' + finEvalVal + '% vs ' + FIN_EVAL_PASS + '% required).'
          : 'Channel Management Evaluation score (' + infraTotalVal.toFixed(1) + '/10) is below the ' + INFRA_THRESHOLD + ' threshold.'
        this.store.flagCandidateCase({
          code: caseCode,
          partnerName: selected.name,
          partnerType: partnerType ?? 'distributor',
          town: selected.town,
          state: 'MH',
          subtype: selected.subtype ?? 'new',
          status: 'flagged',
          ownerRole: finance ? 'finance' : 'channel_dev',
          slaLabel: slaLabelFromHours(slaHours),
          isOverdue: false,
          // Replacement DBs start ungated only once the Discontinuation Form is linked.
          hasDiscontinuationForm: selected.subtype !== 'replacement' || !!selected.discontinuationForm || (existingCase?.hasDiscontinuationForm ?? false),
          discontinuationForm: selected.discontinuationForm ?? existingCase?.discontinuationForm,
          confidencePct: finance ? finEvalVal : Math.round((infraTotalVal / INFRA_THRESHOLD) * 100),
          candidateId: selected.id,
          flagDetail,
          signoffAuthority: authority,
          ...(finance
            ? { financeSnapshot: { ownFunds, ccLimit, capitalAvailable: ownFunds + ccLimit, requiredInvestment: REQUIRED_INVESTMENT, fundingGap: round1(Math.max(0, REQUIRED_INVESTMENT - (ownFunds + ccLimit))), readinessPct: finEvalVal } }
            : { channelSnapshot: { score: infraTotalVal, threshold: INFRA_THRESHOLD, gap: Math.max(0, INFRA_THRESHOLD - infraTotalVal), readinessPct: Math.round((infraTotalVal / INFRA_THRESHOLD) * 100) } }),
        })
        this.store.pushNotification({
          title: caseCode + ' routed to ' + teamLabel,
          body: selected.name + ' (' + selected.town + ') — ' + flagDetail,
          href: '/approvals',
          forRole: finance ? 'finance' : 'channel_dev',
        })
        this.store.logAudit({ actor: 'Evaluation Agent', kind: 'ai', action: 'Flagged & routed to ' + teamLabel, entity: caseCode })
      }
      if (!this.financePass()) raiseCase(true)
      if (!this.channelPass()) raiseCase(false)
    }
    this.step.set(next)
  }

  // Batch-proceed with all checked leads. Each lead is routed independently — cases are created
  // for those that fail Finance or Channel; those that auto-clear are moved straight along. The
  // wizard then navigates to the most complex next step across the batch.
  protected goAfterEvaluate(chosenList: Evaluated[]): void {
    if (!chosenList.length) return
    this.batchChosen.set(chosenList)
    const codesSoFar = [...this.store.flaggedCases()]
    const partnerType = this.partnerType()
    const slaHours = this.store.slaHours()
    const authority = this.authority
    chosenList.forEach((chosen) => {
      const raiseCase = (finance: boolean) => {
        const teamLabel = finance ? 'Finance' : 'Trade Marketing'
        const existingCase = this.store.flaggedCases().find((c) => c.candidateId === chosen.c.id && c.ownerRole === (finance ? 'finance' : 'channel_dev'))
        const caseCode = existingCase?.code ?? nextCaseCode(codesSoFar, partnerType ?? 'distributor')
        codesSoFar.push({ code: caseCode } as CaseRecord)
        const flagDetail = finance
          ? 'CC limit + own funds are ' + (FIN_EVAL_PASS - chosen.fin) + '% below the ₹' + REQUIRED_INVESTMENT + 'L required investment (Financial Evaluation ' + chosen.fin + '% vs ' + FIN_EVAL_PASS + '% required).'
          : 'Channel Management Evaluation score (' + chosen.infra.toFixed(1) + '/10) is below the ' + INFRA_THRESHOLD + ' threshold.'
        this.store.flagCandidateCase({
          code: caseCode,
          partnerName: chosen.c.name,
          partnerType: partnerType ?? 'distributor',
          town: chosen.c.town,
          state: 'MH',
          subtype: chosen.c.subtype ?? 'new',
          status: 'flagged',
          ownerRole: finance ? 'finance' : 'channel_dev',
          slaLabel: slaLabelFromHours(slaHours),
          isOverdue: false,
          hasDiscontinuationForm: chosen.c.subtype !== 'replacement' || !!chosen.c.discontinuationForm || (existingCase?.hasDiscontinuationForm ?? false),
          discontinuationForm: chosen.c.discontinuationForm ?? existingCase?.discontinuationForm,
          confidencePct: finance ? chosen.fin : Math.round((chosen.infra / INFRA_THRESHOLD) * 100),
          candidateId: chosen.c.id,
          flagDetail,
          signoffAuthority: authority,
          ...(finance
            ? (() => {
              // Batch evaluation only scores an aggregate financial % — split the resulting
              // capital 65/35 as a reasonable own-funds-led mix.
              const capitalAvailable = Math.round((chosen.fin / 100) * REQUIRED_INVESTMENT)
              const ownFundsSplit = Math.round(capitalAvailable * 0.65)
              return { financeSnapshot: { ownFunds: ownFundsSplit, ccLimit: capitalAvailable - ownFundsSplit, capitalAvailable, requiredInvestment: REQUIRED_INVESTMENT, fundingGap: round1(Math.max(0, REQUIRED_INVESTMENT - capitalAvailable)), readinessPct: chosen.fin } }
            })()
            : { channelSnapshot: { score: chosen.infra, threshold: INFRA_THRESHOLD, gap: Math.max(0, INFRA_THRESHOLD - chosen.infra), readinessPct: Math.round((chosen.infra / INFRA_THRESHOLD) * 100) } }),
        })
        this.store.pushNotification({
          title: caseCode + ' routed to ' + teamLabel,
          body: chosen.c.name + ' (' + chosen.c.town + ') — ' + flagDetail,
          href: '/approvals',
          forRole: finance ? 'finance' : 'channel_dev',
        })
        this.store.logAudit({ actor: 'Evaluation Agent', kind: 'ai', action: 'Flagged & routed to ' + teamLabel, entity: caseCode })
      }
      // A Replacement DB is a compliance gate, not a performance one — even a candidate that
      // clears both evaluations still can't go active until the old DB's Discontinuation Form
      // is linked, so it always gets a case raised for Channel Development.
      const needsDiscontinuation = chosen.c.subtype === 'replacement' && !chosen.c.discontinuationForm
      const raiseDiscontinuationCase = () => {
        const existingCase = this.store.flaggedCases().find((c) => c.candidateId === chosen.c.id && c.ownerRole === 'channel_dev')
        if (existingCase?.hasDiscontinuationForm) return
        const caseCode = existingCase?.code ?? nextCaseCode(codesSoFar, partnerType ?? 'distributor')
        codesSoFar.push({ code: caseCode } as CaseRecord)
        const oldDbLabel = chosen.c.oldDbCode ? (' for ' + chosen.c.oldDbCode + (chosen.c.oldDbName ? (' (' + chosen.c.oldDbName + ')') : '')) : ''
        const flagDetail = needsDiscontinuation
          ? 'Replacement DB' + oldDbLabel + ' — the Discontinuation Form for the old DB must be linked before this can be approved.'
          : 'Replacement DB' + oldDbLabel + ' — Disengagement Form already filled in at Create Lead time; shared here for visibility, no action needed.'
        this.store.flagCandidateCase({
          code: caseCode,
          partnerName: chosen.c.name,
          partnerType: partnerType ?? 'distributor',
          town: chosen.c.town,
          state: 'MH',
          subtype: 'replacement',
          status: needsDiscontinuation ? 'flagged' : 'approved',
          ownerRole: 'channel_dev',
          slaLabel: slaLabelFromHours(slaHours),
          isOverdue: false,
          hasDiscontinuationForm: !needsDiscontinuation,
          discontinuationForm: chosen.c.discontinuationForm,
          confidencePct: chosen.c.confidencePct,
          candidateId: chosen.c.id,
          flagDetail,
          signoffAuthority: authority,
        })
        this.store.pushNotification({
          title: needsDiscontinuation ? (caseCode + ' routed to Trade Marketing') : (caseCode + ' — Replacement DB, for your visibility'),
          body: chosen.c.name + ' (' + chosen.c.town + ') — ' + flagDetail,
          href: '/approvals',
          forRole: 'channel_dev',
        })
        this.store.logAudit({
          actor: 'Evaluation Agent', kind: 'ai',
          action: needsDiscontinuation ? 'Flagged & routed to Trade Marketing — Discontinuation Form required' : 'Shared Disengagement Form with Trade Marketing for visibility',
          entity: caseCode,
        })
      }
      // Clearing both evaluations is no longer enough to go live on its own — it still needs
      // Leadership's final SM/RBL sign-off once Channel Development actually sends the e-signature.
      const raiseLeadershipCase = () => {
        const existingCase = this.store.flaggedCases().find((c) => c.candidateId === chosen.c.id && c.ownerRole === 'leadership')
        const caseCode = existingCase?.code ?? nextCaseCode(codesSoFar, partnerType ?? 'distributor')
        codesSoFar.push({ code: caseCode } as CaseRecord)
        this.store.flagCandidateCase({
          code: caseCode,
          partnerName: chosen.c.name,
          partnerType: partnerType ?? 'distributor',
          town: chosen.c.town,
          state: 'MH',
          subtype: chosen.c.subtype ?? 'new',
          status: 'flagged',
          ownerRole: 'leadership',
          slaLabel: slaLabelFromHours(slaHours),
          isOverdue: false,
          hasDiscontinuationForm: chosen.c.subtype !== 'replacement' || !!chosen.c.discontinuationForm || (existingCase?.hasDiscontinuationForm ?? false),
          discontinuationForm: chosen.c.discontinuationForm ?? existingCase?.discontinuationForm,
          confidencePct: existingCase?.confidencePct ?? 96,
          candidateId: chosen.c.id,
          flagDetail: 'Financial & Channel Management Evaluation both cleared — awaiting e-signature, then routed to Leadership for final sign-off.',
          signoffAuthority: authority,
        })
        this.store.moveCandidate(chosen.c.id, 'approval_2')
      }
      if (!chosen.financePass) raiseCase(true)
      if (!chosen.channelPass) raiseCase(false)
      if (chosen.financePass && chosen.channelPass) {
        if (chosen.c.subtype === 'replacement') raiseDiscontinuationCase()
        if (needsDiscontinuation) {
          this.store.moveCandidate(chosen.c.id, 'approval_1')
        } else {
          raiseLeadershipCase()
        }
      } else {
        this.store.moveCandidate(chosen.c.id, 'approval_1')
      }
    })
    // Sync sliders to the primary lead (first checked that needs most review, or first that clears).
    const primary = chosenList.find((e) => !e.financePass) ?? chosenList.find((e) => !e.channelPass) ?? chosenList[0]
    this.loadCandidateScores(primary.c)
    this.store.setSelectedCandidateId(primary.c.id)
    // Navigate to the most complex step across the batch.
    const anyFinance = chosenList.some((e) => !e.financePass)
    const anyChannel = chosenList.some((e) => !e.channelPass)
    const anyReplacementNeedsDiscontinuation = chosenList.some((e) => e.c.subtype === 'replacement' && !e.c.discontinuationForm)
    const next: Step = anyFinance ? 'finance-review' : (anyChannel || anyReplacementNeedsDiscontinuation) ? 'channel-review' : 'agreement'
    this.step.set(next)
  }
  protected afterFinance(): Step { return !this.channelPass() ? 'channel-review' : 'agreement' }
  protected goAfterFinance(): void { this.goToStep(this.afterFinance()) }

  /* ================= Step 1: partner type ================= */
  protected partnerTypeLabelOf(code: PartnerTypeCode | null): string {
    return code ? (PARTNER_TYPES.find((t) => t.code === code)?.label ?? '') : ''
  }
  protected selectPartnerType(t: PartnerTypeCode): void { this.partnerType.set(t) }
  protected continueType(): void { this.goToStep('candidates') }

  /* ================= Step 1.5: candidate pipeline (board + evaluate) ================= */
  private resetCandidatesState(): void {
    this.candPickerOpen.set(false)
    this.candDiffOnly.set(false)
    this.candHighlightDiff.set(false)
    this.candLeadDetailId.set(null)
    this.candCatFilter.set('all')
    this.ldDiscFormOpen.set(false)
  }

  protected candOpenPicker(): void { this.candPickerOpen.set(true) }
  protected candClosePicker(): void { this.candPickerOpen.set(false) }
  protected candSetCatFilter(v: string): void { this.candCatFilter.set(v as DbCategory | 'all') }
  protected candOpenDetail(id: string): void { this.candLeadDetailId.set(id) }
  protected candCloseDetail(): void { this.candLeadDetailId.set(null) }
  protected candSetSlider(key: string, v: number): void { this.store.setInfra({ ...this.store.infra(), [key]: v }) }
  protected candSetOwnFunds(v: number): void { this.store.setOwnFunds(v) }
  protected candSetCcLimit(v: number): void { this.store.setCcLimit(v) }
  protected openLeadsPage(): void { this.router.navigate(['/leads']) }
  // "+Compare" — ticks a lead already in the pipeline straight into the comparison, from the picker.
  protected candCompareLead(id: string): void { this.store.toggleEvalId(id); this.candPickerOpen.set(false) }

  protected candCountLabel(): string {
    return this.candCatFilter() === 'all'
      ? String(this.pipelineCandidates().length)
      : (this.visibleCandidates().length + ' of ' + this.pipelineCandidates().length)
  }
  protected candEvalHint(): string {
    const n = this.store.evalIds().length
    return n === 0 ? 'Tick the leads you want to evaluate' : (n + ' selected for evaluation — tick to add or remove')
  }

  // The active (selected) lead within the pipeline-scoped comparison table (distinct from
  // `selected`, which is based on the full candidates list, since this drives the compare table).
  // Explicit `| undefined` — see the identical reasoning on `selected` above (pipeline can be empty).
  protected readonly candSelected = computed<CandidateCard | undefined>(() => {
    const pipeline = this.pipelineCandidates()
    const id = this.store.selectedCandidateId()
    return pipeline.find((c) => c.id === id) ?? pipeline[0]
  })
  protected candCategoryLocked(c: CandidateCard): boolean {
    const inEval = this.store.evalIds().includes(c.id)
    const cat = this.compareCategory()
    return !inEval && !!cat && c.dbCategory !== cat
  }
  protected candCategoryLockTitle(c: CandidateCard): string {
    const cat = this.compareCategory()
    return 'Comparison is locked to ' + cat + ' — untick those first to compare a ' + c.dbCategory + ' lead'
  }
  protected readonly visibleCandidates = computed(() => {
    const cat = this.candCatFilter()
    return this.pipelineCandidates().filter((c) => cat === 'all' || c.dbCategory === cat)
  })

  // The comparison shows only the leads ticked for evaluation — with nothing ticked yet, fall
  // back to the active lead so the table isn't empty. Capped at MAX_COMPARE side by side.
  protected readonly candTicked = computed(() => this.pipelineCandidates().filter((c) => this.store.evalIds().includes(c.id)))
  protected readonly candCols = computed<CandidateCard[]>(() => {
    const ticked = this.candTicked()
    const sel = this.candSelected()
    const list = ticked.length ? ticked : (sel ? [sel] : [])
    return list.slice(0, MAX_COMPARE)
  })
  // A comparison only makes sense within one DB category — once something's ticked, it locks it.
  protected readonly compareCategory = computed(() => this.candTicked()[0]?.dbCategory)
  protected readonly untickedInPipeline = computed(() => {
    const cols = this.candCols()
    return this.pipelineCandidates().filter((c) => !cols.some((col) => col.id === c.id))
  })
  protected readonly untickedSameCategory = computed(() => {
    const cat = this.compareCategory()
    return this.untickedInPipeline().filter((c) => !cat || c.dbCategory === cat)
  })
  protected readonly availableLeads = computed(() => {
    const pipeline = this.pipelineCandidates()
    return LEAD_CANDIDATES.filter((lc) => !pipeline.some((c) => c.id === lc.id))
  })
  protected readonly canAddCompare = computed(() => {
    const cat = this.compareCategory()
    return this.candCols().length < MAX_COMPARE
      && (this.untickedSameCategory().length > 0 || this.availableLeads().some((lc) => !cat || lc.dbCategory === cat))
  })
  protected pickerLockNoteVisible(): boolean {
    const cat = this.compareCategory()
    if (!cat) return false
    return this.untickedInPipeline().length > this.untickedSameCategory().length
      || this.availableLeads().some((lc) => lc.dbCategory !== cat)
  }
  protected readonly pickerAvailableSameCategory = computed(() => {
    const cat = this.compareCategory()
    return this.availableLeads().filter((lc) => !cat || lc.dbCategory === cat)
  })

  protected readonly stageIndexCand = computed(() => {
    const sel = this.candSelected()
    return sel ? CANDIDATE_STAGES.findIndex((s) => s.id === sel.stage) : -1
  })

  // Side-by-side comparison rows. The active (selected) lead's infra/financial scores come from
  // the live sliders; other leads use recorded scores.
  protected liveInfra(c: CandidateCard): number {
    const sel = this.candSelected()
    return sel && c.id === sel.id ? this.infraTotal() : c.infraScore
  }
  protected liveFin(c: CandidateCard): number {
    const sel = this.candSelected()
    return sel && c.id === sel.id ? this.finEval() : c.finEvalPct
  }
  // Non-active leads only record an aggregate infra score — spread it into a stable per-factor
  // breakdown (deterministic per lead+factor) so the factors are comparable across columns.
  protected factorScore(c: CandidateCard, key: string): number {
    const sel = this.candSelected()
    if (sel && c.id === sel.id) return this.store.infra()[key]
    const h = [...(c.id + key)].reduce((a, ch) => a + ch.charCodeAt(0), 0)
    return Math.min(10, Math.max(1, Math.round(c.infraScore + ((h % 3) - 1))))
  }
  protected capital(c: CandidateCard): number {
    const sel = this.candSelected()
    return sel && c.id === sel.id ? this.store.ownFunds() + this.store.ccLimit() : Math.round((REQUIRED_INVESTMENT * c.finEvalPct) / 100)
  }
  protected chanPass(c: CandidateCard): boolean { return this.liveInfra(c) >= INFRA_THRESHOLD }
  protected finPass(c: CandidateCard): boolean { return this.liveFin(c) >= FIN_EVAL_PASS }

  protected readonly compareSections = computed<CmpSection[]>(() => [
    {
      title: 'Parameters & Scores',
      rows: [
        { label: 'Monthly turnover (₹L)', kind: 'plain', value: (c) => c.turnoverMonthly, ideal: IDEAL_DB.turnoverMonthly },
        { label: 'Expected Acme turnover/mo (₹L)', kind: 'plain', value: (c) => c.expectedAcmeTurnover, ideal: IDEAL_DB.expectedAcmeTurnover },
        { label: 'Overall coverage (outlets)', kind: 'coverage', value: (c) => c.coverageOutlets, ideal: IDEAL_DB.coverageOutlets.toLocaleString() },
        { label: 'Lead confidence', kind: 'pct', value: (c) => c.confidencePct, ideal: '100%' },
      ],
    },
    {
      title: 'Channel evaluation — infrastructure',
      rows: [
        ...INFRA_FACTORS.map((f): CmpRow => ({
          label: f.label, kind: 'infraFactor', value: (c: CandidateCard) => this.factorScore(c, f.key), ideal: '8/10', factorKey: f.key,
        })),
        { label: 'Infrastructure score (avg · threshold ' + INFRA_THRESHOLD.toFixed(1) + ')', kind: 'infraTotal', value: (c) => this.liveInfra(c), ideal: IDEAL_DB.infraScore.toFixed(1) },
        { label: 'Channel check', kind: 'channelCheck', value: (c) => (this.chanPass(c) ? 1 : 0), noBest: true, ideal: '' },
      ],
    },
    {
      title: 'Financial evaluation & outcome',
      rows: [
        { label: 'Required investment (₹L)', kind: 'plain', value: () => REQUIRED_INVESTMENT, noBest: true, ideal: REQUIRED_INVESTMENT },
        { label: 'Own funds / borrowed (₹L)', kind: 'ownFunds', value: (c) => (this.candSelected()?.id === c.id ? this.store.ownFunds() : -1), noBest: true, ideal: REQUIRED_INVESTMENT },
        { label: 'CC limit (₹L)', kind: 'ccLimit', value: (c) => (this.candSelected()?.id === c.id ? this.store.ccLimit() : -1), noBest: true, ideal: 0 },
        { label: 'Capital available (₹L)', kind: 'plain', value: (c) => this.capital(c), ideal: REQUIRED_INVESTMENT },
        { label: 'Financial Evaluation (threshold ' + FIN_EVAL_PASS + '%)', kind: 'finEvalPct', value: (c) => this.liveFin(c), ideal: FIN_EVAL_PASS + '%' },
        { label: 'Financial check', kind: 'financeCheck', value: (c) => (this.finPass(c) ? 1 : 0), noBest: true, ideal: '' },
        { label: 'Route', kind: 'route', value: (c) => (this.finPass(c) && this.chanPass(c) ? 1 : 0), noBest: true, ideal: '' },
      ],
    },
  ])
  protected candRowDiffers(r: CmpRow): boolean {
    const vals = this.candCols().map(r.value)
    return vals.some((v) => v !== vals[0])
  }
  protected candRowBest(r: CmpRow, c: CandidateCard): boolean {
    const cols = this.candCols()
    if (cols.length <= 1 || r.noBest) return false
    const vals = cols.map(r.value)
    const max = Math.max(...vals)
    return r.value(c) === max
  }
  protected readonly visibleSections = computed(() => {
    const cols = this.candCols()
    const diffOnly = this.candDiffOnly()
    return this.compareSections()
      .map((s) => ({ ...s, rows: diffOnly && cols.length > 1 ? s.rows.filter((r) => this.candRowDiffers(r)) : s.rows }))
      .filter((s) => s.rows.length > 0)
  })
  protected colspanFor(): number {
    return this.candCols().length + 2 + (this.canAddCompare() ? 1 : 0)
  }

  /* ---------- "View details" popup on a comparison lead ---------- */
  protected readonly ldCandidate = computed(() => this.pipelineCandidates().find((x) => x.id === this.candLeadDetailId()))
  protected readonly ldExt = computed(() => {
    const c = this.ldCandidate()
    return c?.sourceIntakeId ? EXTRACTIONS[c.sourceIntakeId] : undefined
  })
  protected readonly ldOverrides = computed(() => {
    const c = this.ldCandidate()
    return c ? overridesForLead(c, this.ldExt()) : {}
  })
  protected ldBg(key: string): string {
    const f = BACKGROUND_INFORMATION.find((x) => x.key === key)
    if (!f) return '—'
    const overrides = this.ldOverrides()
    return (overrides[f.label] ?? f.value) + (f.suffix ? (' ' + f.suffix) : '')
  }
  protected readonly ldInfraTotal = computed(() => { const c = this.ldCandidate(); return c ? this.liveInfra(c) : 0 })
  protected readonly ldFinEval = computed(() => { const c = this.ldCandidate(); return c ? this.liveFin(c) : 0 })
  protected readonly ldFinancePass = computed(() => { const c = this.ldCandidate(); return c ? this.finPass(c) : false })
  protected readonly ldChannelPass = computed(() => { const c = this.ldCandidate(); return c ? this.chanPass(c) : false })
  protected readonly ldWillAutoClear = computed(() => this.ldFinancePass() && this.ldChannelPass())
  protected readonly ldConfidence = computed(() => Math.round(Math.min(this.ldFinEval(), 120) / 120 * 50 + this.ldInfraTotal() / 10 * 50))
  protected readonly ldKeyDrivers = computed<{ label: string; tone: 'good' | 'warn' | 'crit' }[]>(() => {
    const financePass = this.ldFinancePass()
    const channelPass = this.ldChannelPass()
    return [
      { label: financePass ? 'Turnover within Acme range' : 'Turnover below Acme range', tone: financePass ? 'good' : 'crit' },
      { label: 'Strong business history', tone: 'good' },
      { label: channelPass ? 'WS contribution good' : 'WS contribution medium', tone: channelPass ? 'good' : 'warn' },
      { label: channelPass ? 'Good geographic coverage' : 'Coverage below threshold', tone: channelPass ? 'good' : 'warn' },
    ]
  })
  protected readonly ldNextStepLabel = computed(() => this.ldWillAutoClear() ? 'Auto-clear' : (!this.ldFinancePass() ? 'Route to Finance' : 'Route to Trade Marketing'))
  protected readonly ldTimelineText = computed(() => this.ldWillAutoClear() ? '0.5 - 1 day' : '2.0 - 2.5 days')
  protected readonly ldStageTag = computed(() => {
    const c = this.ldCandidate()
    return c ? (CANDIDATE_STAGES.find((s) => s.id === c.stage)?.label ?? c.stage) : ''
  })
  protected readonly ldModalTitle = computed(() => {
    const c = this.ldCandidate()
    return c ? (c.name + ' · ' + this.ldStageTag()) : 'Lead details'
  })

  protected ldReject(): void {
    const c = this.ldCandidate()
    if (!c) return
    this.store.rejectCandidate(c.id)
    this.candCloseDetail()
  }
  protected ldRequestInfo(): void {
    const c = this.ldCandidate()
    if (!c) return
    this.store.askCopilot('Get more information about ' + c.name + '\'s application before deciding.')
    this.candCloseDetail()
  }
  protected ldAccept(): void {
    const c = this.ldCandidate()
    if (!c) return
    this.store.setSelectedCandidateId(c.id)
    this.goToStep('evaluate')
    this.candCloseDetail()
  }
  protected ldOpenDiscForm(): void { this.ldDiscFormOpen.set(true) }
  protected ldCloseDiscForm(): void { this.ldDiscFormOpen.set(false) }
  protected ldSubmitDiscForm(form: DisengagementForm): void {
    const c = this.ldCandidate()
    if (!c) return
    this.store.setCandidateDiscForm(c.id, form)
    this.ldDiscFormOpen.set(false)
  }
  protected ldViewDoc(d: RequiredDoc): void {
    const c = this.ldCandidate()
    if (!c) return
    openPdfInNewTab(buildPdf([
      { text: 'Acme Distribution Partner Platform — Document on file', size: 9, gap: 18 },
      { text: d.name, size: 18, bold: true, gap: 30 },
      { text: c.name, size: 11, gap: 20 },
      { text: 'Status: Received' + (d.file ? (' — ' + d.file) : ''), size: 10.5, gap: 18 },
      { text: ' ', gap: 20 },
      { text: 'Generated preview PDF — prototype stand-in for the actual scan.', size: 8.5 },
    ]))
  }

  /* ================= Step 4: evaluation ================= */
  private resetEvaluateState(): void {
    const sel = this.store.selectedCandidateId()
    this.evalDone.set(false)
    this.evalFrozenEval.set(null)
    this.evalFrozenLines.set(null)
    this.evalCheckedIds.set([sel])
    this.evalProceedId.set(sel)
    this.evalDocOn.set(false)
    this.evalOpenDetail.set(null)
    this.evalDocView.set(null)
  }

  protected readonly evalDisplayEval = computed(() => this.evalFrozenEval() ?? this.evaluated())
  protected readonly evalMulti = computed(() => this.evalDisplayEval().length > 1)
  protected readonly evalClears = computed(() => this.evalDisplayEval().filter((e) => e.financePass && e.channelPass).length)
  protected readonly evalProceed = computed(() =>
    this.evalDisplayEval().find((e) => e.c.id === this.evalProceedId())
    ?? this.evalDisplayEval().find((e) => this.evalCheckedIds().includes(e.c.id))
    ?? this.evalDisplayEval()[0])

  protected evalToggleCheck(id: string): void {
    const prev = this.evalCheckedIds()
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    if (next.length === 0) return
    this.evalCheckedIds.set(next)
    if (!next.includes(this.evalProceedId())) this.evalProceedId.set(next[0])
  }
  // Reject drops the lead out of this comparison entirely — it stays on the Leads page (tagged
  // 'rejected') rather than being deleted outright.
  protected evalRejectRow(id: string): void {
    this.store.rejectCandidate(id)
    this.evalCheckedIds.update((prev) => prev.filter((x) => x !== id))
    this.evalFrozenEval.update((prev) => (prev ? prev.filter((e) => e.c.id !== id) : prev))
    if (this.evalProceedId() === id) this.evalProceedId.set('')
  }

  protected readonly diDocs = computed<EvalDoc[]>(() => {
    const proceed = this.evalProceed()
    return proceed ? docsForCandidate(proceed.c) : []
  })
  protected readonly diMismatches = computed(() => this.diDocs().reduce((n, d) => n + d.fields.filter((f) => !f.ok).length, 0))
  // Per-document match tally the template needs for each row in the Document Intelligence list.
  protected docOkCount(d: EvalDoc): number { return d.fields.filter((f) => f.ok).length }
  protected docAllOk(d: EvalDoc): boolean { return this.docOkCount(d) === d.fields.length }

  protected routeLabel(e: Evaluated): { label: string; tone: 'good' | 'warn' | 'crit' } { return routeLabel(e) }
  protected routeExplain(e: Evaluated): string {
    if (e.financePass && e.channelPass) return 'Both evaluations clear the bar — ' + e.c.name + ' auto-clears straight to agreement with ' + this.authority + ' sign-off.'
    const parts: string[] = []
    if (!e.financePass) parts.push('Financial Evaluation at ' + e.fin + '% is below the ' + FIN_EVAL_PASS + '% required, so it routes to Finance')
    if (!e.channelPass) parts.push('Channel score ' + e.infra.toFixed(1) + '/10 is under the ' + INFRA_THRESHOLD + '/10 bar, so it routes to Trade Marketing')
    return parts.join('; ') + '.'
  }

  protected readonly liveLines = computed<TraceLine[]>(() => {
    const evaluated = this.evaluated()
    const multi = evaluated.length > 1
    const clears = evaluated.filter((e) => e.financePass && e.channelPass).length
    return [
      { text: '> Evaluation Agent — running the approval matrix on ' + evaluated.length + ' lead' + (multi ? 's' : ''), tone: 'accent' },
      ...evaluated.map((e): TraceLine => {
        const pass = e.financePass && e.channelPass
        const route = pass ? 'AUTO-CLEAR' : ('route to ' + [!e.financePass && 'Finance', !e.channelPass && 'Trade Marketing'].filter(Boolean).join(' + '))
        return {
          text: e.c.name + ': Financial ' + e.fin + '% ' + (e.financePass ? '≥100% ✓' : '<100% ✗') + ' · Channel ' + e.infra.toFixed(1) + '/10 ' + (e.channelPass ? '✓' : '✗') + ' → ' + route,
          tone: pass ? 'ok' : 'bad',
        }
      }),
      { text: 'Approval authority: expected Acme turnover ₹' + EXPECTED_ACME_TURNOVER + 'L → ' + this.authority + ' sign-off.', tone: 'muted' },
      { text: 'Decision: ' + clears + ' auto-clear, ' + (evaluated.length - clears) + ' need review.', tone: 'accent' },
    ]
  })
  // After freezing, use the snapshot; before freezing, stream the live lines.
  protected readonly lines = computed<TraceLine[]>(() => this.evalFrozenLines() ?? this.liveLines())

  protected onEvalTraceDone(): void {
    this.evalDone.set(true)
    this.evalFrozenEval.set(this.evaluated())
    this.evalFrozenLines.set(this.liveLines())
  }
  protected evalSetDocOn(v: boolean): void { this.evalDocOn.set(v) }
  protected evalToggleDetail(id: string): void { this.evalOpenDetail.set(this.evalOpenDetail() === id ? null : id) }
  protected evalSetDocView(d: EvalDoc | null): void { this.evalDocView.set(d) }
  protected evalDetailAvail(e: Evaluated): number { return Math.round((e.fin / 100) * REQUIRED_INVESTMENT) }
  protected evalDetailGap(e: Evaluated): number { return Math.max(0, Math.round((REQUIRED_INVESTMENT - this.evalDetailAvail(e)) * 10) / 10) }
  protected evalContinueLabel(): string {
    const n = this.evalCheckedIds().length
    return n > 1 ? (n + ' leads') : (this.evalProceed()?.c.name ?? 'selected lead')
  }
  protected evalContinue(): void {
    const chosen = this.evalDisplayEval().filter((e) => this.evalCheckedIds().includes(e.c.id))
    const proceed = this.evalProceed()
    this.goAfterEvaluate(chosen.length ? chosen : (proceed ? [proceed] : []))
  }

  /* ================= Step 5: reviews (finance + channel) ================= */
  // The case this wizard raised in the shared Approvals queue — matches on candidateId only
  // (no ownerRole filter), same as the source's expression for both finance-review and
  // channel-review, so whichever case exists first for this candidate is the one shown.
  protected readonly reviewCode = computed(() => this.store.flaggedCases().find((c) => c.candidateId === this.selected()?.id)?.code ?? '')
  protected readonly reviewIsFinance = computed(() => this.step() === 'finance-review')
  protected readonly reviewTeamLabel = computed(() => this.reviewIsFinance() ? 'Finance' : 'Trade Marketing')
  protected readonly reviewTeamColor = computed(() => this.reviewIsFinance() ? 'var(--p-finance)' : 'var(--p-channel)')
  // The approve/reject decision belongs to the owning team — only they (or admin) see it.
  protected readonly reviewIsReviewer = computed(() => {
    const viewingAs = this.viewingAs()
    return viewingAs === (this.reviewIsFinance() ? 'finance' : 'channel_dev') || viewingAs === 'admin'
  })
  protected readonly reviewCaseRecord = computed(() => this.store.flaggedCases().find((c) => c.code === this.reviewCode()))
  protected readonly reviewAlreadyApproved = computed(() => this.reviewCaseRecord()?.status === 'approved')
  protected readonly reviewMe = computed(() => DEMO_USERS[this.viewingAs()])
  protected readonly reviewBriefing = computed(() => this.reviewIsFinance()
    ? 'Replacement DB in Nashik with strong ASE-attested coverage and turnover fit. Sole blocker: Financial Evaluation at ' + this.finEval() + '% — own funds + CC limit fall short of the ₹' + REQUIRED_INVESTMENT + 'L required investment. Expected Acme turnover ₹' + EXPECTED_ACME_TURNOVER + 'L ⇒ ' + this.authority + ' sign-off. Form and documents read for you — recommend conditional approval pending a written top-up commitment.'
    : 'Strong financial position and turnover fit for Nashik. Sole blocker is the Channel Management Evaluation score, below the ' + INFRA_THRESHOLD + ' threshold this coverage plan requires. Full form read for you.')
  private computeFlagText(finance: boolean): string {
    const caseRecord = this.store.flaggedCases().find((c) => c.code === this.reviewCode())
    if (caseRecord?.flagDetail) return caseRecord.flagDetail
    return finance
      ? 'CC limit + own funds are ' + (FIN_EVAL_PASS - this.finEval()) + '% below the ₹' + REQUIRED_INVESTMENT + 'L required investment (Financial Evaluation ' + this.finEval() + '% vs ' + FIN_EVAL_PASS + '% required).'
      : 'Channel Management Evaluation score (' + this.infraTotal().toFixed(1) + '/10) is below the ' + INFRA_THRESHOLD + ' threshold.'
  }
  protected readonly reviewFlagText = computed(() => this.computeFlagText(this.reviewIsFinance()))
  protected readonly reviewDistributorEmail = computed(() => { const c = this.selected(); return c ? emailForCandidate(c) : '' })

  private resetReviewState(finance: boolean): void {
    this.reviewMsgs.set(finance
      ? [
          { who: 'R. Malhotra', role: 'ASM · 2h ago', txt: 'This distributor already services 3 other FMCG majors here with strong retailer feedback.', color: 'var(--p-ase)' },
          { who: 'Finance', role: '35m ago', txt: 'Thanks — funds are short of the required investment. Can we get a top-up commitment in writing?', color: 'var(--p-finance)' },
        ]
      : [
          { who: 'R. Malhotra', role: 'ASM · 1h ago', txt: 'Godown expansion is planned next month — coverage should improve once done.', color: 'var(--p-ase)' },
          { who: 'Trade Marketing', role: '20m ago', txt: 'Noted — can you share the expansion timeline in writing before we clear this?', color: 'var(--p-channel)' },
        ])
    this.reviewDraft.set('')
    this.reviewEmailOpen.set(false)
    const candidate = this.selected()
    const code = this.reviewCode()
    const viewingAs = this.viewingAs()
    const me = DEMO_USERS[viewingAs]
    const flagText = this.computeFlagText(finance)
    this.reviewEmailSubject.set('Action needed on your ' + (candidate?.dbCategory ?? '') + ' application — ' + code)
    this.reviewEmailBody.set(
      'Hi ' + (candidate?.name ?? '') + ' team,\n\nWe\'re reviewing your distributor application (' + code + ') and need your help closing out one item:\n\n'
      + flagText + '\n\nCould you share an update or supporting documents at your earliest convenience?\n\nThanks,\n' + me.name + '\n' + ROLE_BY_CODE[viewingAs].label + ', Acme Distribution',
    )
    this.reviewEmailSentNote.set(null)
    this.reviewLeadershipNote.set('')
    this.reviewLeadershipSentNote.set(null)
    this.reviewDecisionPick.set(null)
    this.reviewDecisionNote.set('')
    this.reviewDetailsOpen.set(false)
  }

  protected reviewSend(): void {
    const draft = this.reviewDraft().trim()
    if (!draft) return
    this.reviewMsgs.update((m) => [...m, { who: this.reviewTeamLabel(), role: 'just now', txt: draft, color: this.reviewTeamColor() }])
    this.reviewDraft.set('')
  }
  protected reviewSendEmail(): void {
    const candidate = this.selected()
    if (!candidate) return
    const me = this.reviewMe()
    const code = this.reviewCode()
    const email = this.reviewDistributorEmail()
    this.store.logAudit({ actor: me.name, kind: 'human', action: 'Emailed ' + candidate.name + ' (' + email + ') re: ' + code, entity: code })
    this.reviewEmailSentNote.set('Email sent to ' + email + ' just now.')
    this.reviewEmailOpen.set(false)
  }
  protected reviewRequestInfo(): void {
    const caseRecord = this.reviewCaseRecord()
    if (!caseRecord) return
    const candidate = this.selected()
    this.store.requestInfoFromAsm({
      code: this.reviewCode(), town: caseRecord.town, partnerName: candidate?.name ?? '',
      reviewerRole: this.viewingAs(), reviewerName: this.reviewMe().name,
      note: 'More information needed on ' + this.reviewCode() + ' before we can proceed — ' + this.reviewFlagText(),
    })
    this.router.navigate(['/communication'])
  }
  protected reviewSendLeadershipNote(): void {
    const note = this.reviewLeadershipNote().trim()
    if (!note) return
    this.store.pushNotification({ title: 'Note on ' + this.reviewCode() + ' from ' + this.reviewTeamLabel(), body: note, href: '/approvals', forRole: 'leadership' })
    this.store.logAudit({ actor: this.reviewMe().name, kind: 'human', action: 'Left a note for Leadership on ' + this.reviewCode(), entity: this.reviewCode() })
    this.reviewLeadershipSentNote.set('Leadership has been notified.')
    this.reviewLeadershipNote.set('')
  }
  protected reviewApprove(): void {
    if (this.reviewIsFinance()) this.goAfterFinance()
    else this.goToStep('agreement')
  }
  protected reviewSubmitDecision(): void {
    const pick = this.reviewDecisionPick()
    const note = this.reviewDecisionNote().trim()
    if (!pick || !note) return
    const code = this.reviewCode()
    const candidate = this.selected()
    const me = this.reviewMe()
    const viewingAs = this.viewingAs()
    if (pick === 'rejected') {
      this.store.decideCase(code, 'rejected')
      this.store.logAudit({ actor: me.name, kind: 'human', action: 'Rejected case (' + ROLE_BY_CODE[viewingAs].label + ') — ' + note, entity: code })
      this.store.pushNotification({ title: code + ' rejected', body: (candidate?.name ?? '') + ' — rejected by ' + ROLE_BY_CODE[viewingAs].label + '.', href: '/approvals' })
      return
    }
    this.store.decideCase(code, 'approved')
    const conditional = pick === 'conditional'
    this.store.logAudit({
      actor: me.name, kind: 'human',
      action: (conditional ? 'Conditionally approved' : 'Approved') + ' case (' + ROLE_BY_CODE[viewingAs].label + ') — ' + note,
      entity: code,
    })
    this.store.pushNotification({
      title: code + ' ' + (conditional ? 'conditionally approved' : 'approved'),
      body: (candidate?.name ?? '') + ' — ' + (conditional ? 'conditionally approved' : 'approved') + ' by ' + ROLE_BY_CODE[viewingAs].label + '.',
      href: '/approvals',
    })
    this.reviewApprove()
  }

  protected readonly reviewAvailable = computed<number | undefined>(() => this.reviewIsFinance() ? Math.round((this.finEval() / 100) * REQUIRED_INVESTMENT * 10) / 10 : undefined)
  protected readonly reviewShortfall = computed<number | undefined>(() => this.reviewIsFinance() ? Math.max(0, Math.round((REQUIRED_INVESTMENT - (this.reviewAvailable() ?? 0)) * 10) / 10) : undefined)
  protected readonly reviewShortfallPct = computed<number | undefined>(() => this.reviewIsFinance() ? Math.max(0, FIN_EVAL_PASS - this.finEval()) : undefined)

  /* ================= Step 6: agreement ================= */
  private resetAgreementState(): void {
    this.agreementSent.set(false)
    this.agreementSending.set(false)
    this.agreementSendError.set(null)
    this.agreementNote.set('')
    this.agreementRoutedToLeadership.set(false)
  }
  protected readonly agreementTo = computed(() => { const c = this.selected(); return c ? emailForCandidate(c) : '' })
  protected readonly agreementSubject = 'Welcome to Acme Distribution — Distributor Appointment Confirmed'
  protected readonly agreementBody = computed(() => {
    const c = this.selected()
    return 'Dear ' + (c?.name ?? '') + ' team,\n\nCongratulations — your appointment as an authorized Acme Distribution Staples distributor for ' + (c?.town ?? '') + ', Maharashtra is confirmed, effective 3 July 2026.\n\nAttached is your Distributor Appointment Agreement for e-signature — please review and counter-sign at your earliest convenience. Once signed, you\'ll receive your onboarding kit and Acme Distribution Partner Portal access.\n\nWelcome aboard,\nAcme Distribution Distributor Onboarding Team'
  })

  // Sends a real email over SMTP — an official welcome + e-signature request.
  protected async agreementSendForSignature(): Promise<void> {
    this.agreementSending.set(true)
    this.agreementSendError.set(null)
    const to = this.agreementTo()
    const subject = this.agreementSubject
    const body = this.agreementBody()
    try {
      await apiPost('/api/mail/reply', this.store.authToken(), { to, subject, text: body })
      const me = DEMO_USERS[this.viewingAs()]
      this.store.logAudit({ actor: me.name, kind: 'human', action: 'Sent onboarding welcome + e-signature request to ' + to, entity: this.selected()?.name ?? '' })
      this.agreementSent.set(true)
    } catch (err) {
      this.agreementSendError.set(err instanceof Error ? err.message : 'Send failed')
    } finally {
      this.agreementSending.set(false)
    }
  }

  // Channel Development no longer completes onboarding itself once the e-signature goes out —
  // this routes the case to Leadership for the actual final SM/RBL sign-off.
  protected agreementSendToLeadership(): void {
    const candidate = this.selected()
    if (!candidate) return
    const me = DEMO_USERS[this.viewingAs()]
    const flaggedCases = this.store.flaggedCases()
    const existing = flaggedCases.find((c) => c.candidateId === candidate.id && c.ownerRole === 'leadership')
    const partnerType = this.partnerType()
    const caseCode = existing?.code ?? nextCaseCode(flaggedCases, partnerType ?? 'distributor')
    this.store.flagCandidateCase({
      code: caseCode,
      partnerName: candidate.name,
      partnerType: partnerType ?? 'distributor',
      town: candidate.town,
      state: 'MH',
      subtype: candidate.subtype ?? 'new',
      status: 'flagged',
      ownerRole: 'leadership',
      slaLabel: slaLabelFromHours(this.store.slaHours()),
      isOverdue: false,
      hasDiscontinuationForm: candidate.subtype !== 'replacement' || !!candidate.discontinuationForm || (existing?.hasDiscontinuationForm ?? false),
      discontinuationForm: candidate.discontinuationForm ?? existing?.discontinuationForm,
      confidencePct: existing?.confidencePct ?? 96,
      candidateId: candidate.id,
      flagDetail: 'Financial & Channel Management Evaluation both cleared; e-signature sent — routed to Leadership for final sign-off.',
      signoffAuthority: this.authority,
    })
    const note = this.agreementNote().trim()
    if (note) this.store.addCaseNoteForLeadership(caseCode, me.name, note)
    this.store.pushNotification({
      title: caseCode + ' — awaiting final sign-off',
      body: candidate.name + ' (' + candidate.town + ') — e-signature sent, routed to Leadership for final approval.',
      href: '/approvals', forRole: 'leadership',
    })
    this.store.logAudit({ actor: me.name, kind: 'human', action: 'Routed to Leadership for final sign-off' + (note ? ' with a note' : ''), entity: caseCode })
    this.agreementRoutedToLeadership.set(true)
    this.goToStep('success')
  }

  /* ================= Step 7: success ================= */
  protected readonly successAutoCleared = computed(() => this.financePass() && this.channelPass())
  protected readonly successIsBatch = computed(() => this.batchChosen().length > 1)
  protected readonly successTally = computed(() => {
    const batchChosen = this.batchChosen()
    const financePass = this.financePass()
    const channelPass = this.channelPass()
    const t = ['Recommendation Engine · ranked leads', 'Evaluation Agent · scored ' + (batchChosen.length > 0 ? batchChosen.length : 2) + ' leads']
    if (!financePass || batchChosen.some((e) => !e.financePass)) t.push('Routing · Finance')
    if (!channelPass || batchChosen.some((e) => !e.channelPass)) t.push('Routing · Trade Marketing')
    t.push('Routing · Leadership final sign-off')
    t.push('Communication Agent · notified ASM')
    return t
  })
  protected restart(): void {
    this.step.set('type')
    this.partnerType.set(null)
    this.batchChosen.set([])
  }
  protected goToAnalytics(): void { this.router.navigate(['/analytics']) }
}
