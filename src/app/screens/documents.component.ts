import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonComponent, ModalComponent, PillComponent, ToggleComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { CASE_PARTNER, DEMO_DOCUMENTS } from '../mock/cases'
import { PARTNER_TYPE_COLOR, partnerTypeLabel } from '../mock/templates'
import { DEMO_USERS } from '../mock/roles'
import { AppStore } from '../store'
import type { PartnerTypeCode, SubmittedDocument, VerificationStatus } from '../types'
import { isBusinessCapacityDoc, BUSINESS_CAPACITY_NOTE } from '../lib/documentPolicy'
import { buildPdf, wrapText, openPdfInNewTab } from '../lib/pdf'
import type { PdfLine } from '../lib/pdf'
import { listDocuments } from '../services/documents.service'
import type { BackendDocument } from '../services/documents.service'

function documentFromBackend(d: BackendDocument): SubmittedDocument {
  return {
    id: d.id, caseCode: d.caseCode ?? '', partnerType: (d.partnerType ?? 'distributor') as PartnerTypeCode,
    docName: d.docName, claimed: d.claimed ?? undefined, extracted: d.extracted ?? undefined,
    status: d.status as VerificationStatus, fileName: d.fileName ?? undefined,
    uploadedOn: d.uploadedOn ?? undefined, uploadedAt: d.uploadedAt ?? undefined,
    verifiedOn: d.verifiedOn ?? undefined, optional: d.optional || undefined, thisWeek: d.thisWeek || undefined,
  }
}

type Tab = 'all' | 'pending' | 'verified' | 'not_checked'
const PAGE_SIZES = [10, 25, 50]

const typeShort = (code: PartnerTypeCode) => partnerTypeLabel(code).split(' ')[0]
const partnerName = (caseCode: string) => CASE_PARTNER[caseCode] ?? '—'

// file-glyph tint per document kind, so the list reads like a real doc tray
const DOC_TINT: Record<string, string> = {
  'GST Certificate': 'var(--good)', GST: 'var(--good)', 'ISO 9001': 'var(--good)',
  PAN: 'var(--p-ase)', 'Cancelled Cheque': 'var(--p-ase)',
  'FSSAI License': 'var(--warn)', 'Factory Audit Report': 'var(--warn)',
  'Godown Proof': 'var(--crit)',
  'DB Onboarding Form': 'var(--ai)', MSME: 'var(--ai)',
}
const docTint = (name: string) => DOC_TINT[name] ?? 'var(--ai)'

const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: 'Verified', pending: 'Pending', mismatch: 'Mismatch', not_checked: 'Not checked',
}

// The issuing authority line shown at the top of a generated document PDF.
function docIssuer(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('gst')) return 'Government of India · GST Department'
  if (n.includes('fssai')) return 'Food Safety & Standards Authority of India'
  if (n.includes('godown')) return 'Warehouse lease / ownership proof'
  if (n.includes('pan')) return 'Income Tax Department'
  if (n.includes('iso')) return 'Quality management certification'
  if (n.includes('factory')) return 'Third-party factory audit'
  if (n.includes('msme')) return 'Ministry of MSME · Udyam'
  if (n.includes('cheque')) return 'Cancelled cheque · bank proof'
  if (n.includes('form') || n.includes('onboarding')) return 'Acme Distribution distributor onboarding'
  return 'Uploaded document'
}
// A realistic document body, built from the claimed/extracted values on file.
function docBodyText(d: SubmittedDocument, firm: string): string {
  const n = d.docName.toLowerCase()
  const claimed = d.claimed ?? '—'
  if (n.includes('gst')) return 'Registration certificate issued under the GST Act to ' + firm + ', GSTIN ' + claimed + '. Classified as a regular taxpayer, valid from the date of registration.'
  if (n.includes('fssai')) return 'This is to certify that ' + firm + ' is licensed as a Food Business Operator under the Food Safety and Standards Act, 2006. License number ' + claimed + '. Valid for the current registration period.'
  if (n.includes('godown')) return 'Warehouse lease / ownership proof for ' + firm + ' — covered storage premises (' + claimed + ') suitable for Acme Distribution Staples distribution.'
  if (n.includes('pan')) return 'Permanent Account Number card for ' + firm + ', PAN ' + claimed + ', issued by the Income Tax Department, Government of India.'
  if (n.includes('iso')) return firm + ' holds ISO 9001 certification for its quality management system (' + claimed + '), verified by an accredited certification body.'
  if (n.includes('factory')) return 'Third-party factory audit report for ' + firm + '. Overall assessment: ' + claimed + '.'
  if (n.includes('msme')) return 'Udyam (MSME) registration certificate for ' + firm + ', ' + claimed + ', issued by the Ministry of Micro, Small and Medium Enterprises.'
  if (n.includes('cheque')) return 'Cancelled cheque submitted by ' + firm + ' as proof of bank account details for payment set-up — ' + claimed + '.'
  if (n.includes('form') || n.includes('onboarding')) return d.docName + ' submitted by ' + firm + ' — ' + claimed + '.'
  return 'Uploaded document on file for ' + firm + '.'
}

function statusView(d: SubmittedDocument): { tone: Tone; dot: boolean; label: string; sub: string } {
  switch (d.status) {
    case 'verified':
      return { tone: 'good', dot: true, label: 'Verified', sub: d.verifiedOn ? 'Verified on ' + d.verifiedOn : 'Verified' }
    case 'pending':
      return { tone: 'warn', dot: true, label: 'Pending', sub: 'Awaiting verification' }
    case 'mismatch':
      return { tone: 'crit', dot: true, label: 'Mismatch', sub: 'Needs review' }
    default:
      return { tone: 'neutral', dot: false, label: 'Not checked', sub: d.optional ? 'Optional' : '—' }
  }
}

// compact page list with ellipsis for larger sets (1 2 3 … 9)
function pageList(total: number, cur: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, cur - 1)
  const end = Math.min(total - 1, cur + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, ButtonComponent, ModalComponent, PillComponent, ToggleComponent, IconComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsComponent implements OnInit {
  protected readonly store = inject(AppStore)

  // Live server documents overlaid on top of the mock seed — same resilient pattern as the
  // Intake Inbox's pull(): server rows win by id, anything mock-only the server doesn't know
  // about yet is kept, and an unreachable backend just leaves this empty (no error, no blocking).
  private readonly serverDocs = signal<SubmittedDocument[]>([])

  ngOnInit(): void {
    listDocuments(this.store.authToken())
      .then((server) => this.serverDocs.set(server.map(documentFromBackend)))
      .catch(() => { /* backend not running/reachable — keep mock data */ })
  }

  protected readonly PAGE_SIZES = PAGE_SIZES
  protected readonly PARTNER_TYPE_COLOR = PARTNER_TYPE_COLOR
  protected readonly BUSINESS_CAPACITY_NOTE = BUSINESS_CAPACITY_NOTE

  protected readonly tab = signal<Tab>('all')
  protected readonly query = signal('')
  protected readonly ptFilter = signal<'all' | PartnerTypeCode>('all')
  protected readonly showFilters = signal(false)
  protected readonly page = signal(1)
  protected readonly pageSize = signal(10)

  // MDM workflow state: per-document verification overrides, per-case Document Intelligence
  // toggle, onboarded cases, and which case is open in the document-check modal.
  protected readonly statuses = signal<Record<string, VerificationStatus>>({})
  protected readonly diCases = signal<Record<string, boolean>>({})
  protected readonly onboarded = signal<string[]>([])
  protected readonly reviewCase = signal<string | null>(null)
  protected readonly notice = signal<string | null>(null)

  // documents with any live verification override applied — server rows (once loaded) take
  // precedence over the mock seed by id, same merge-by-id convention store.ts's sync*FromServer
  // methods use.
  protected readonly docs = computed<SubmittedDocument[]>(() => {
    const statuses = this.statuses()
    const server = this.serverDocs()
    const serverIds = new Set(server.map((d) => d.id))
    const merged = [...server, ...DEMO_DOCUMENTS.filter((d) => !serverIds.has(d.id))]
    return merged.map((d) => (statuses[d.id] ? { ...d, status: statuses[d.id] } : d))
  })

  // global stats (all documents), independent of tab/search
  protected readonly stats = computed(() => {
    const docs = this.docs()
    const total = docs.length
    const by = (s: VerificationStatus) => docs.filter((d) => d.status === s).length
    const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0')
    return { total, verified: by('verified'), pending: by('pending'), notChecked: by('not_checked'), thisWeek: docs.filter((d) => d.thisWeek).length, pct }
  })

  // search + partner-type filter (drives both the tab counts and the table)
  protected readonly base = computed(() => {
    const q = this.query().trim().toLowerCase()
    const ptFilter = this.ptFilter()
    return this.docs().filter((d) => {
      if (ptFilter !== 'all' && d.partnerType !== ptFilter) return false
      if (!q) return true
      return [d.docName, d.caseCode, d.fileName, d.claimed, typeShort(d.partnerType), partnerName(d.caseCode)]
        .some((v) => v?.toLowerCase().includes(q))
    })
  })

  protected readonly tabCounts = computed(() => {
    const base = this.base()
    return {
      pending: base.filter((d) => d.status === 'pending').length,
      verified: base.filter((d) => d.status === 'verified').length,
      not_checked: base.filter((d) => d.status === 'not_checked').length,
    }
  })

  protected readonly rows = computed(() => {
    const base = this.base()
    const tab = this.tab()
    return tab === 'all' ? base : base.filter((d) => d.status === tab)
  })

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / this.pageSize())))
  protected readonly curPage = computed(() => Math.min(this.page(), this.totalPages()))
  protected readonly start = computed(() => (this.curPage() - 1) * this.pageSize())
  protected readonly pageRows = computed(() => this.rows().slice(this.start(), this.start() + this.pageSize()))
  protected readonly showingTo = computed(() => Math.min(this.start() + this.pageSize(), this.rows().length))

  protected readonly filtersActive = computed(() => this.ptFilter() !== 'all')

  // ---- MDM actions ----
  // Godown Proof evidences a business-capacity claim (godown size), which Acme Distribution's process
  // explicitly leaves to ASE/ASM field judgment — MDM verifies compliance documents only
  // (GST, PAN, FSSAI, etc.), never business-capacity ones, even where technically possible.
  protected readonly caseDocs = computed(() => {
    const reviewCase = this.reviewCase()
    return reviewCase ? this.docs().filter((d) => d.caseCode === reviewCase) : []
  })
  protected readonly verifiableDocs = computed(() => this.caseDocs().filter((d) => !isBusinessCapacityDoc(d.docName)))
  protected readonly diOn = computed(() => {
    const reviewCase = this.reviewCase()
    return reviewCase ? !!this.diCases()[reviewCase] : false
  })
  protected readonly allVerified = computed(() => {
    const verifiableDocs = this.verifiableDocs()
    return verifiableDocs.length > 0 && verifiableDocs.every((d) => d.status === 'verified')
  })
  protected readonly isOnboarded = computed(() => {
    const reviewCase = this.reviewCase()
    return reviewCase ? this.onboarded().includes(reviewCase) : false
  })

  protected readonly verifiedCount = computed(() => this.verifiableDocs().filter((d) => d.status === 'verified').length)
  protected readonly excludedCount = computed(() => this.caseDocs().length - this.verifiableDocs().length)

  protected readonly reviewTitle = computed(() => {
    const reviewCase = this.reviewCase()
    return reviewCase ? 'Document check · ' + reviewCase + ' — ' + partnerName(reviewCase) : 'Document check'
  })

  protected readonly TABS = computed<{ key: Tab; label: string; count?: number }[]>(() => {
    const tabCounts = this.tabCounts()
    return [
      { key: 'all', label: 'All Documents' },
      { key: 'pending', label: 'Pending', count: tabCounts.pending },
      { key: 'verified', label: 'Verified', count: tabCounts.verified },
      { key: 'not_checked', label: 'Not Checked', count: tabCounts.not_checked },
    ]
  })

  protected readonly STAT_CARDS = computed<{ label: string; value: number; sub: string; icon: IconName; fg: string; bg: string }[]>(() => {
    const stats = this.stats()
    return [
      { label: 'Total Documents', value: stats.total, sub: 'Across all cases', icon: 'documents', fg: 'var(--ai)', bg: 'var(--ai-bg)' },
      { label: 'Verified', value: stats.verified, sub: stats.pct(stats.verified) + '% of total', icon: 'check', fg: 'var(--good)', bg: 'var(--good-bg)' },
      { label: 'Pending Verification', value: stats.pending, sub: stats.pct(stats.pending) + '% of total', icon: 'clock', fg: 'var(--warn)', bg: 'var(--warn-bg)' },
      { label: 'Not Checked', value: stats.notChecked, sub: stats.pct(stats.notChecked) + '% of total', icon: 'alert', fg: 'var(--crit)', bg: 'var(--crit-bg)' },
      { label: 'Total Uploaded', value: stats.thisWeek, sub: 'This week', icon: 'upload', fg: 'var(--p-ase)', bg: 'color-mix(in srgb, var(--p-ase) 15%, var(--surface))' },
    ]
  })

  protected typeShort(code: PartnerTypeCode): string {
    return typeShort(code)
  }

  protected partnerName(caseCode: string): string {
    return partnerName(caseCode)
  }

  protected docTint(name: string): string {
    return docTint(name)
  }

  protected statusView(d: SubmittedDocument): { tone: Tone; dot: boolean; label: string; sub: string } {
    return statusView(d)
  }

  protected isExcluded(d: SubmittedDocument): boolean {
    return isBusinessCapacityDoc(d.docName)
  }

  protected rowExtracted(d: SubmittedDocument): string {
    return d.extracted ?? d.claimed ?? '—'
  }

  protected rowMatch(d: SubmittedDocument): boolean {
    return (d.claimed ?? '') === (d.extracted ?? d.claimed ?? '')
  }

  // "View" generates a real single-page PDF from the on-file data and opens it in a new
  // browser tab (native PDF viewer) — no summary popup.
  protected viewPdf(d: SubmittedDocument): void {
    const firm = partnerName(d.caseCode)
    openPdfInNewTab(buildPdf([
      { text: 'Acme Distribution Partner Platform - Document on file', size: 9, gap: 18 },
      { text: d.docName, size: 18, bold: true, gap: 30 },
      { text: docIssuer(d.docName), size: 10.5, gap: 18 },
      { text: 'Partner:   ' + firm, size: 11, gap: 20 },
      { text: 'Partner type:   ' + typeShort(d.partnerType), size: 11, gap: 20 },
      { text: 'Case:   ' + d.caseCode, size: 11, gap: 20 },
      { text: 'Claimed value:   ' + (d.claimed ?? '—'), size: 11, gap: 20 },
      ...(d.extracted ? [{ text: 'Extracted value:   ' + d.extracted, size: 11, gap: 20 } as PdfLine] : []),
      { text: 'Uploaded on:   ' + (d.uploadedOn ?? '—') + (d.uploadedAt ? ' · ' + d.uploadedAt : ''), size: 11, gap: 20 },
      { text: 'Status:   ' + STATUS_LABEL[d.status], size: 11, gap: 20 },
      { text: ' ', gap: 12 },
      ...wrapText(docBodyText(d, firm)).map((t): PdfLine => ({ text: t, size: 10.5, gap: 16 })),
      { text: ' ', gap: 20 },
      { text: 'Generated preview PDF - prototype stand-in for the actual scan.', size: 8.5 },
    ]))
  }

  protected setTab(t: Tab): void {
    this.tab.set(t)
    this.resetPage()
  }

  protected onQueryChange(v: string): void {
    this.query.set(v)
    this.resetPage()
  }

  protected toggleShowFilters(): void {
    this.showFilters.set(!this.showFilters())
  }

  protected onPtFilterChange(v: 'all' | PartnerTypeCode): void {
    this.ptFilter.set(v)
    this.resetPage()
  }

  protected resetFilters(): void {
    this.ptFilter.set('all')
    this.resetPage()
  }

  protected resetPage(): void {
    this.page.set(1)
  }

  protected setPage(p: number): void {
    this.page.set(p)
  }

  // native <select> values always come back as strings — coerce, mirroring the source's
  // explicit Number(e.target.value).
  protected onPageSizeChange(v: string): void {
    this.pageSize.set(Number(v))
    this.resetPage()
  }

  protected dismissNotice(): void {
    this.notice.set(null)
  }

  protected openReview(caseCode: string): void {
    this.reviewCase.set(caseCode)
  }

  protected closeReview(): void {
    this.reviewCase.set(null)
  }

  protected setDiOn(v: boolean): void {
    const reviewCase = this.reviewCase()
    if (!reviewCase) return
    this.diCases.update((s) => ({ ...s, [reviewCase]: v }))
  }

  protected verifyDoc(id: string): void {
    this.statuses.update((s) => ({ ...s, [id]: 'verified' }))
  }

  protected confirmOnboard(): void {
    const reviewCase = this.reviewCase()
    if (!reviewCase) return
    const who = DEMO_USERS[this.store.viewingAs() ?? 'ase_asm']?.name ?? 'MDM'
    const verifiableDocs = this.verifiableDocs()
    this.statuses.update((s) => {
      const next = { ...s }
      verifiableDocs.forEach((d) => { next[d.id] = 'verified' })
      return next
    })
    this.onboarded.update((o) => (o.includes(reviewCase) ? o : [...o, reviewCase]))
    this.store.logAudit({ actor: who, kind: 'human', action: 'Confirmed & onboarded ' + partnerName(reviewCase), entity: reviewCase })
    this.store.pushNotification({ title: partnerName(reviewCase) + ' onboarded', body: reviewCase + ' cleared the MDM document check and is now a live partner.', href: '/partners' })
    this.notice.set(partnerName(reviewCase) + ' (' + reviewCase + ') confirmed & onboarded — logged to the audit trail.')
  }

  protected pageList(total: number, cur: number): (number | '…')[] {
    return pageList(total, cur)
  }
}
