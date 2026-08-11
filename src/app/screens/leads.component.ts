import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { ButtonComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import { CANDIDATE_STAGES } from '../mock/candidates'
import { INFRA_THRESHOLD, FIN_EVAL_PASS } from '../mock/onboarding'
import { ROLE_BY_CODE } from '../mock/roles'
import { AppStore } from '../store'
import type { CandidateCard } from '../types'

// The Leads page holds only the leads a user explicitly reviewed & created (Intake Review
// "Review & create lead", distributor Evaluate). ASE/ASM sees just their own creations;
// Channel Development/Admin see everything the field team created, since that's the
// shortlist they compare side by side in New Application.
@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [ButtonComponent, PillComponent, IconComponent],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsComponent {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  protected readonly CANDIDATE_STAGES = CANDIDATE_STAGES
  protected readonly INFRA_THRESHOLD = INFRA_THRESHOLD
  protected readonly FIN_EVAL_PASS = FIN_EVAL_PASS
  protected readonly ROLE_BY_CODE = ROLE_BY_CODE

  protected readonly expandedId = signal<string | null>(null)

  private readonly resolvedViewingAs = computed(() => this.store.viewingAs() ?? 'ase_asm')

  protected readonly isAse = computed(() => this.resolvedViewingAs() === 'ase_asm')
  protected readonly canOpenWizard = computed(() => this.resolvedViewingAs() !== 'ase_asm')

  // 'active' means fully onboarded — it now has a real Partner record (see activateCandidate
  // in store.ts) and belongs in the Partners directory, not the Leads queue anymore.
  protected readonly leads = computed(() => {
    const viewingAs = this.resolvedViewingAs()
    return this.store.candidates().filter((c) =>
      c.userCreated && c.stage !== 'active' && (viewingAs !== 'ase_asm' || c.createdBy === viewingAs))
  })

  protected readonly shortlisted = computed(() => {
    const evalIds = this.store.evalIds()
    return this.leads().filter((c) => evalIds.includes(c.id))
  })

  protected isShortlisted(id: string): boolean {
    return this.store.evalIds().includes(id)
  }

  protected stageLabel(c: CandidateCard): string {
    return this.CANDIDATE_STAGES.find((s) => s.id === c.stage)?.label ?? c.stage
  }

  protected toggleExpanded(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id)
  }

  protected openIntakeInbox(): void {
    this.router.navigate(['/intake-inbox'])
  }

  protected openNewApplication(): void {
    this.router.navigate(['/new-application'])
  }

  protected onCompare(): void {
    this.router.navigate(['/new-application'])
  }

  protected onReinstate(id: string): void {
    this.store.reinstateCandidate(id)
    if (this.canOpenWizard()) this.router.navigate(['/new-application'])
  }

  // Full profile stats of a created lead — everything recorded on the candidate, plus how it
  // stands against the evaluation thresholds Channel Development will score it on.
  protected leadStats(c: CandidateCard): { k: string; v: string }[] {
    return [
      { k: 'Monthly turnover', v: '₹' + c.turnoverMonthly + 'L' },
      { k: 'Expected Acme turnover/mo', v: '₹' + c.expectedAcmeTurnover + 'L' },
      { k: 'Coverage', v: c.coverageOutlets.toLocaleString() + ' outlets' },
      { k: 'Infrastructure score', v: c.infraScore.toFixed(1) + '/10' },
      { k: 'Financial evaluation', v: c.finEvalPct + '%' },
      { k: 'Lead confidence', v: c.confidencePct + '%' },
    ]
  }

  protected chanPass(c: CandidateCard): boolean {
    return c.infraScore >= this.INFRA_THRESHOLD
  }

  protected finPass(c: CandidateCard): boolean {
    return c.finEvalPct >= this.FIN_EVAL_PASS
  }

  protected createdByLabel(c: CandidateCard): string {
    return c.createdBy ? (this.ROLE_BY_CODE[c.createdBy]?.label ?? c.createdBy) : '—'
  }

  protected createdAtLabel(c: CandidateCard): string {
    return c.createdAt
      ? new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : ''
  }
}
