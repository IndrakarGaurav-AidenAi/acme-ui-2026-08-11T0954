import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, signal } from '@angular/core'
import { ButtonComponent, ModalComponent } from './ui'
import type { ApplicationSubtype, DisengagementForm, Partner } from '../types'

// Field-for-field reproduction of Acme Distribution's real Disengagement sheet — the "next sheet" a
// Replacement DB's old distributor gets filled in against. Shared by Create Lead (fill it up
// front, inline, matching the workbook's own "If Replacement, fill up next sheet" instruction —
// see DisengagementFormFields) and Approvals (the Discontinuation Form gate, wrapped in a modal
// via DisengagementFormModal, as a fallback if it wasn't filled at intake time).

// Shared by both Create Lead and Intake Review's own subtype pickers, so an email-derived lead
// gets the exact same "New DB / Replacement / Additional" options as one entered by hand.
export const DB_SUBTYPES = ['New DB', 'Replacement DB', 'Additional DB'] as const
export const SUBTYPE_MAP: Record<(typeof DB_SUBTYPES)[number], ApplicationSubtype> = {
  'New DB': 'new', 'Replacement DB': 'replacement', 'Additional DB': 'additional',
}

export const TERMINATION_REASONS = [
  'Non-performance / sales decline', 'Financial irregularities', 'Breach of distribution agreement',
  'Loss of business interest', 'Relocation / business closure', 'Others (plz give details)',
]
export const DISTRIBUTOR_DESIRE_REASONS = [
  'Health / personal reasons', 'Business not profitable for them', 'Family business succession issues',
  'Relocating / winding up business', 'Others (plz give details)',
]
export const BLANK_DISC_FORM: DisengagementForm = {
  distributorNameAddressDbCode: '', dateOfAppointment: '', majorTownsCovered: '',
  handlesOtherCompanies: false, competingCompanies: ['', '', '', ''],
  salesHistory: { fy24: { avgSalesPerMonth: 0, growthPct: 0 }, fy25: { avgSalesPerMonth: 0, growthPct: 0 } },
  terminationReason: TERMINATION_REASONS[0], distributorDesireReason: DISTRIBUTOR_DESIRE_REASONS[0],
  stockValueLakh: 0, actionPlanned: {}, ndcSubmitted: false,
}

// Picking which DB is being replaced already tells us who they are and when they were
// appointed — the Partners directory is the actual source of truth for that, so it pre-fills
// everything the app already knows instead of making someone re-type it. Only the genuinely
// new-to-this-form fields (sales history, termination reason, stock value, NDC…) still need a
// human to fill in — there's no existing record of those anywhere in the app.
export function applyPartnerToDiscForm(f: DisengagementForm, p: Partner): DisengagementForm {
  return {
    ...f,
    distributorNameAddressDbCode: `${p.legalName}, ${p.town}, ${p.state}${p.dbCode ? ` — ${p.dbCode}` : ''}`,
    dateOfAppointment: p.onboardedAt ?? f.dateOfAppointment,
    majorTownsCovered: p.town,
  }
}

// Just the sheet's own fields — no Modal, no submit button — so a caller can render the whole
// form inline (Create Lead, right where "Replacement DB" is picked) as easily as in a popup.
@Component({
  selector: 'app-disengagement-form-fields',
  standalone: true,
  templateUrl: './DisengagementFormFields.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisengagementFormFieldsComponent {
  readonly form = model.required<DisengagementForm>()
  readonly readOnly = input(false)

  protected readonly terminationReasons = TERMINATION_REASONS
  protected readonly distributorDesireReasons = DISTRIBUTOR_DESIRE_REASONS
  protected readonly yesNo = ['Yes', 'No'] as const
  protected readonly years = ['fy24', 'fy25'] as const
  protected readonly competingLabels = ['i', 'ii', 'iii', 'iv']

  // Native <input>/<select> onChange handlers hand back a plain Event — extracting .value here
  // (rather than via a template cast) keeps every field binding below a single method call.
  protected inputValue(e: Event): string {
    return (e.target as HTMLInputElement).value
  }

  protected setField<K extends keyof DisengagementForm>(key: K, value: DisengagementForm[K]): void {
    // The cast is needed because TS can't verify a spread + generic computed key still satisfies
    // DisengagementForm as a whole — it demonstrably does, since only the one keyed property (of
    // its own matching type) is overwritten and every other property comes through the spread untouched.
    this.form.update((s) => ({ ...s, [key]: value }) as DisengagementForm)
  }

  protected setCompany(i: number, value: string): void {
    this.form.update((s) => {
      const competingCompanies = [...s.competingCompanies]
      competingCompanies[i] = value
      return { ...s, competingCompanies }
    })
  }

  protected setSalesHistory(yr: 'fy24' | 'fy25', field: 'avgSalesPerMonth' | 'growthPct', value: string): void {
    this.form.update((s) => ({
      ...s,
      salesHistory: { ...s.salesHistory, [yr]: { ...s.salesHistory[yr], [field]: +value } },
    }))
  }

  protected setStockValue(value: string): void {
    this.form.update((s) => ({ ...s, stockValueLakh: +value }))
  }

  protected setActionPlanned(field: 'transferredTo' | 'liquidatedInMarket' | 'others', value: string): void {
    this.form.update((s) => ({ ...s, actionPlanned: { ...s.actionPlanned, [field]: value } }))
  }
}

// Modal wrapper around DisengagementFormFields, for contexts that need it as a popup rather than
// inline (Approvals' Discontinuation Form gate).
@Component({
  selector: 'app-disengagement-form-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, DisengagementFormFieldsComponent],
  templateUrl: './DisengagementFormModal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisengagementFormModalComponent {
  readonly open = input.required<boolean>()
  readonly existing = input<DisengagementForm>()
  readonly readOnly = input(false)
  readonly title = input<string>()
  readonly submitLabel = input<string>()
  readonly closed = output<void>()
  readonly submitted = output<DisengagementForm>()

  protected readonly f = signal<DisengagementForm>(BLANK_DISC_FORM)

  // Re-sync when a different case's existing form (or none) opens, or if it was just submitted.
  // Mirrors the original's useRef-guarded "adjust state during render" pattern: the first effect
  // run always captures the mount-time `existing` (matching useState's lazy initializer); every
  // run after that only resyncs while `open` is true, and only pushes into `f` when `existing`
  // is truthy — reopening for a case with no existing form leaves whatever `f` last held.
  private openedFor: DisengagementForm | undefined
  private initialized = false

  protected readonly canSubmit = computed(() =>
    !this.readOnly() && this.f().distributorNameAddressDbCode.trim() !== '' && this.f().dateOfAppointment.trim() !== '',
  )

  constructor() {
    effect(() => {
      const isOpen = this.open()
      const existing = this.existing()
      if (!this.initialized) {
        this.initialized = true
        this.openedFor = existing
        this.f.set(existing ?? BLANK_DISC_FORM)
        return
      }
      if (isOpen && this.openedFor !== existing) {
        this.openedFor = existing
        if (existing) this.f.set(existing)
      }
    })
  }
}
