import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { ButtonComponent, ModalComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore } from '../store'
import { EXTRACTIONS, REQUIRED_DOCS, capturedCount, missingFieldLabels, downloadSampleTemplate, firmOfExtraction } from '../mock/intake'
import type { Extraction, ExtractedField, IntakeChannel, IntakePriority, RequiredDoc } from '../mock/intake'
import { extractEmail } from '../lib/extract'
import { apiGet, apiPost } from '../lib/api'
import { DB_TYPES } from '../mock/onboarding'
import type { DbCategory } from '../mock/onboarding'
import { DEMO_USERS, ROLE_BY_CODE } from '../mock/roles'
import { applyPartnerToDiscForm, BLANK_DISC_FORM, DB_SUBTYPES, DisengagementFormFieldsComponent, SUBTYPE_MAP } from '../components/DisengagementForm'
import type { DisengagementForm } from '../types'

const VENDOR_DOCS = ['GST', 'PAN', 'ISO 9001', 'Factory Audit Report']

const BLANK_CREATE_FORM = {
  partnerType: 'distributor' as 'distributor' | 'vendor',
  firmName: '', contactPerson: '', phone: '', email: '', town: '', state: 'Maharashtra',
  dbSubtype: 'New DB' as typeof DB_SUBTYPES[number], dbCategory: 'GT DB (with CSO/DSM)' as DbCategory,
  turnover: '', gst: '', oldDbCode: '', oldDbName: '', additionalReason: '',
}

const initialsOf = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, '').split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

// Text-only uploads the built-in extractor can actually read — PDF/Excel parsing needs the
// backend extraction service, so anything else is rejected with a note instead of silently
// failing.
const TEXT_FILE = /\.(csv|txt|eml|md|tsv|json|log)$/i

@Component({
  selector: 'app-intake-inbox',
  standalone: true,
  imports: [FormsModule, ButtonComponent, ModalComponent, PillComponent, IconComponent, DisengagementFormFieldsComponent],
  templateUrl: './intake-inbox.component.html',
  styleUrl: './intake-inbox.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntakeInboxComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AppStore)
  private readonly router = inject(Router)

  // Module-level data the template reads directly.
  protected readonly DB_TYPES = DB_TYPES
  protected readonly DB_SUBTYPES = DB_SUBTYPES
  protected readonly initialsOf = initialsOf
  protected readonly capturedCount = capturedCount
  protected readonly missingFieldLabels = missingFieldLabels
  protected readonly downloadSampleTemplate = downloadSampleTemplate

  // Dashboard's "Create Lead" shortcut lands here with `openCreateLead` so the form opens
  // immediately; a grievance/candidate deep-link lands with `agencies` to search for. Captured
  // via getCurrentNavigation()?.extras.state in the field initializer (runs during the
  // constructor while the activating navigation is still in flight) — mirrors the React
  // screen's useLocation().state read.
  private readonly navState = ((this.router.getCurrentNavigation()?.extras.state ?? null) as
    | { openCreateLead?: boolean; agencies?: string[] }
    | null)

  protected readonly tab = signal<IntakeChannel>('email')
  protected readonly query = signal('')
  protected readonly note = signal<string | null>(null)
  protected readonly highlightId = signal<string | null>(null)
  protected readonly noMatchAgency = signal<string | null>(null)
  protected readonly pasteOpen = signal(false)
  protected readonly pf = signal({ from: '', subject: '', body: '' })
  protected readonly busy = signal(false)
  protected readonly inbox = signal<{ connected: boolean; configured?: boolean; address?: string; error?: string }>({ connected: false })
  // EXTRACTIONS (mock/intake.ts) is a plain mutable module-level object, not a signal — bumped
  // whenever it's mutated in place (ingest/createLeadManually/the server-poll merge) so every
  // computed reading it below actually recomputes, mirroring the source's `setTick` force-render.
  private readonly tick = signal(0)

  // A structured "fill it in yourself" alternative to Paste Email — same required-fields +
  // documents checklist an incoming enquiry would have, for when there's no email to extract from.
  protected readonly createOpen = signal(false)
  protected readonly cf = signal(BLANK_CREATE_FORM)
  protected readonly cfDocs = signal<Record<string, File | null>>({})
  // The Disengagement Form ("next sheet") for a Replacement DB — filled in right here, inline,
  // at Create Lead time when possible, matching the workbook's own instruction, so the
  // Discontinuation Form gate in Approvals is already cleared by the time the case is raised.
  protected readonly cfDiscForm = signal<DisengagementForm>(BLANK_DISC_FORM)

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInputEl')

  private alive = true
  private pollTimer: ReturnType<typeof setInterval> | undefined

  protected readonly viewingAs = computed(() => this.store.viewingAs() ?? 'ase_asm')

  // Distributors that actually have a DB Code on file — the only real source for "OLD DB
  // Code" (see the Replacement DB picker below); there's nowhere else in the app to look one up.
  protected readonly codedDistributors = computed(() =>
    this.store.partners().filter((p) => p.partnerType === 'distributor' && p.dbCode))

  // Items already reviewed & converted to a lead are consumed — they leave the inbox.
  // Besides the explicit processed list, also drop any item whose firm already exists as a
  // created lead (covers leads created before processed-tracking existed).
  private readonly createdLeadNames = computed(() =>
    new Set(this.store.candidates().filter((c) => c.userCreated).map((c) => c.name.toLowerCase())))

  protected readonly all = computed<Extraction[]>(() => {
    this.tick()
    const processedIntakeIds = this.store.processedIntakeIds()
    const createdLeadNames = this.createdLeadNames()
    return Object.values(EXTRACTIONS).filter(
      (e) => !processedIntakeIds.includes(e.id) && !createdLeadNames.has(firmOfExtraction(e)))
  })
  protected readonly emails = computed(() => this.all().filter((e) => e.channel === 'email'))
  protected readonly docs = computed(() => this.all().filter((e) => e.channel === 'document'))

  private readonly q = computed(() => this.query().trim().toLowerCase())
  private match(e: Extraction): boolean {
    const q = this.q()
    return q === '' || e.source.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
  }
  // Newest first: mock items sort by their absolute timestamp; freshly ingested ones carry
  // Date.now() in their id (far larger than any mock date), so they always land on top.
  private recency(e: Extraction): number {
    const m = e.id.match(/^intake-(\d+)$/)
    if (m) return +m[1]
    const t = Date.parse(e.receivedFull ?? '')
    return Number.isNaN(t) ? 0 : t
  }
  protected readonly rows = computed(() => {
    const base = this.tab() === 'email' ? this.emails() : this.docs()
    return base.filter((e) => this.match(e)).sort((a, b) => this.recency(b) - this.recency(a))
  })

  // Summary stats derive from the live intake set, so the counts stay honest as it grows.
  private readonly successfullyExtracted = computed(() =>
    this.all().filter((e) => e.candidates || ((e.confidencePct ?? 0) >= 85 && missingFieldLabels(e).length === 0)).length)
  private readonly needReview = computed(() =>
    this.all().filter((e) => !e.candidates && (missingFieldLabels(e).length > 0 || (e.confidencePct ?? 0) < 85)).length)
  private readonly duplicatesCount = computed(() => this.all().filter((e) => e.duplicate).length)

  protected readonly STATS = computed<{ label: string; value: string; sub: string; icon: IconName; tone: string }[]>(() => [
    { label: 'Total Received', value: String(this.all().length), sub: 'Across all channels', icon: 'mail', tone: 'ai' },
    { label: 'Successfully Extracted', value: String(this.successfullyExtracted()), sub: 'High confidence', icon: 'approvals', tone: 'good' },
    { label: 'Need Review', value: String(this.needReview()), sub: 'Missing or low-confidence', icon: 'flag', tone: 'warn' },
    { label: 'Possible Duplicates', value: String(this.duplicatesCount()), sub: 'Flagged by agent', icon: 'templates', tone: 'warn' },
    { label: 'Manual Uploads', value: String(this.docs().length), sub: 'This week', icon: 'documents', tone: 'ai' },
  ])

  protected readonly cfDocNames = computed(() => (this.cf().partnerType === 'vendor' ? VENDOR_DOCS : REQUIRED_DOCS))

  ngOnInit(): void {
    // Dashboard's "Create Lead" shortcut lands here with this flag so the form opens immediately
    // instead of just dropping the ASE/ASM on the inbox list.
    if (this.navState?.openCreateLead) {
      this.createOpen.set(true)
    }

    const agencies = this.navState?.agencies
    if (agencies && agencies.length > 0) {
      const all = this.all()
      let found: Extraction | undefined
      for (const agency of agencies) {
        const needle = agency.toLowerCase()
        found = all.find((r) =>
          r.source.toLowerCase().includes(needle)
          || r.title.toLowerCase().includes(needle)
          || needle.includes(r.title.toLowerCase().split(' ')[0]))
        if (found) break
      }
      if (found) {
        const foundId = found.id
        this.tab.set(found.channel)
        this.highlightId.set(foundId)
        this.noMatchAgency.set(null)
        window.setTimeout(() => document.getElementById('intake-row-' + foundId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
        window.setTimeout(() => this.highlightId.set(null), 3000)
      } else {
        this.noMatchAgency.set(agencies[0])
      }
    }

    // Pull server-extracted intake (the Gmail poller) into the inbox + show connection status.
    this.pull()
    // Matches the backend's own IMAP poll cadence (INTAKE_POLL_SECONDS, default 10s) so a
    // freshly-captured email shows up here without an extra ~20s on top of that wait.
    this.pollTimer = window.setInterval(() => this.pull(), 8000)
  }

  ngOnDestroy(): void {
    this.alive = false
    if (this.pollTimer !== undefined) window.clearInterval(this.pollTimer)
  }

  private async pull(): Promise<void> {
    try {
      const items = await apiGet<Extraction[]>('/api/intake', this.store.authToken())
      let changed = false
      for (const it of items) {
        // Not just "add if missing" — a distributor's reply merges into the SAME item id
        // server-side, so an already-known id can come back with previously-missing fields now
        // filled in and needs to actually refresh.
        const existing = EXTRACTIONS[it.id]
        if (!existing || JSON.stringify(existing) !== JSON.stringify(it)) { EXTRACTIONS[it.id] = it; changed = true }
      }
      if (changed && this.alive) this.tick.update((n) => n + 1)
    } catch { /* server not running — keep the mock data */ }
    try {
      const status = await apiGet<{ connected: boolean; configured?: boolean; address?: string; error?: string }>(
        '/api/inbox/status', this.store.authToken())
      if (this.alive) this.inbox.set(status)
    } catch { /* ignore */ }
  }

  // Parse with the LLM-backed extractor when the local /api/extract server is running;
  // otherwise fall back to the built-in regex extractor. Same ExtractResult shape either way.
  protected async ingest(source: string, subject: string, body: string, channel: IntakeChannel): Promise<void> {
    this.busy.set(true)
    let ex: ReturnType<typeof extractEmail>
    let via = 'the built-in extractor'
    try {
      ex = await apiPost<ReturnType<typeof extractEmail>>(
        '/api/extract', this.store.authToken(), { source, subject, body })
      via = 'the AI extractor'
    } catch {
      ex = extractEmail({ source, title: subject, body })
    }
    const id = 'intake-' + Date.now()
    const docNames = ex.partnerType === 'vendor' ? VENDOR_DOCS : REQUIRED_DOCS
    EXTRACTIONS[id] = {
      id, channel,
      source: source || (channel === 'email' ? 'pasted@intake' : 'manual-upload'),
      title: subject || '(no subject)', receivedAt: 'just now',
      confidencePct: ex.confidencePct, fields: ex.fields, summary: ex.summary,
      partnerType: ex.partnerType, priority: ex.priority, region: ex.region,
      assignedTo: 'Unassigned', raw: body,
      documents: docNames.map((name) => ({ name, received: false })),
    }
    this.tick.update((n) => n + 1)
    this.busy.set(false)
    this.tab.set(channel)
    this.highlightId.set(id)
    this.note.set('Parsed with ' + via + ' — extracted ' + ex.captured + '/9 fields; review and create a lead.')
    window.setTimeout(() => document.getElementById('intake-row-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
    window.setTimeout(() => this.highlightId.set(null), 3000)
  }

  protected async submitPaste(): Promise<void> {
    const { from, subject, body } = this.pf()
    await this.ingest(from, subject, body, 'email')
    this.pasteOpen.set(false)
    this.pf.set({ from: '', subject: '', body: '' })
  }

  protected patchPf(patch: Partial<{ from: string; subject: string; body: string }>): void {
    this.pf.update((s) => ({ ...s, ...patch }))
  }

  protected patchCf(patch: Partial<typeof BLANK_CREATE_FORM>): void {
    this.cf.update((s) => ({ ...s, ...patch }))
  }

  protected onOldDbCodeChange(code: string): void {
    const picked = this.codedDistributors().find((p) => p.dbCode === code)
    // A code alone means nothing to a reviewer — carry the name alongside it.
    this.cf.update((s) => ({ ...s, oldDbCode: code, oldDbName: picked?.legalName ?? '' }))
    // Pre-fills everything the Partners directory already knows about this DB (name/address/code,
    // date of appointment, towns covered) so it isn't re-typed — the picker above is the only
    // real source for this.
    if (picked) this.cfDiscForm.update((s) => applyPartnerToDiscForm(s, picked))
  }

  protected onCfDocChange(event: Event, name: string): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) this.cfDocs.update((d) => ({ ...d, [name]: file }))
    input.value = ''
  }

  // Builds the same Extraction shape ingest() does, straight from the form — no extractor pass
  // needed since every field is already structured — then hands off to the normal Intake Review
  // screen (documents, Document Intelligence, notes) instead of duplicating that flow here.
  // Deliberately NOT an immediate shortlist: if a required document is still missing, Manual
  // Upload (via Intake Review) is where it actually gets attached before the lead is finalized —
  // skipping straight to Leads would leave nowhere to upload it afterward.
  protected createLeadManually(): void {
    const cf = this.cf()
    const cfDiscForm = this.cfDiscForm()
    const cfDocs = this.cfDocs()
    const cfDocNames = this.cfDocNames()
    const subtype = SUBTYPE_MAP[cf.dbSubtype]
    // Only counts as "filled" once the two fields the sheet itself requires are actually
    // entered — an all-blank form object shouldn't silently satisfy the Discontinuation Form gate.
    const discFormFilled = subtype === 'replacement' && !!cfDiscForm.distributorNameAddressDbCode.trim() && !!cfDiscForm.dateOfAppointment.trim()
    const fields: ExtractedField[] = [
      { label: 'Firm / Agency Name', value: cf.firmName.trim(), ok: !!cf.firmName.trim() },
      { label: 'Contact Person', value: cf.contactPerson.trim(), ok: !!cf.contactPerson.trim() },
      { label: 'Phone Number', value: cf.phone.trim(), ok: !!cf.phone.trim() },
      { label: 'Email Address', value: cf.email.trim(), ok: !!cf.email.trim() },
      { label: 'Town / City', value: cf.town.trim(), ok: !!cf.town.trim() },
      { label: 'State', value: cf.state.trim(), ok: !!cf.state.trim() },
      { label: 'DB Type Requested', ...(cf.partnerType === 'distributor'
        ? { value: cf.dbCategory, ok: true }
        : { value: 'Not applicable (Vendor)', ok: false }) },
      ...(cf.partnerType === 'distributor' ? [{ label: 'New DB / Replacement / Additional', value: cf.dbSubtype as string, ok: true }] : []),
      ...(subtype === 'replacement' ? [{ label: 'OLD DB Code', value: cf.oldDbCode.trim() ? cf.oldDbCode.trim() + (cf.oldDbName.trim() ? ' — ' + cf.oldDbName.trim() : '') : 'Not provided', ok: !!cf.oldDbCode.trim() }] : []),
      ...(subtype === 'additional' ? [{ label: 'Reason for Additional DB', value: cf.additionalReason.trim() || 'Not provided', ok: !!cf.additionalReason.trim() }] : []),
      { label: 'Turnover Claim (₹/mo)', value: cf.turnover.trim() ? '₹' + cf.turnover.trim() + 'L' : '', ok: !!cf.turnover.trim() },
      { label: 'GST Number', value: cf.gst.trim() || 'Not provided', ok: !!cf.gst.trim() },
    ]
    const documents: RequiredDoc[] = cfDocNames.map((name) => {
      const file = cfDocs[name]
      return file ? { name, received: true, file: file.name } : { name, received: false }
    })
    const captured = fields.filter((f) => f.ok).length
    const id = 'intake-' + Date.now()
    const viewingAs = this.viewingAs()
    EXTRACTIONS[id] = {
      id, channel: 'document',
      source: cf.email.trim() || 'manual-entry',
      title: 'Manually created lead — ' + (cf.firmName.trim() || 'untitled'),
      receivedAt: 'just now', confidencePct: Math.round((captured / fields.length) * 100),
      fields, partnerType: cf.partnerType, priority: 'normal',
      region: cf.town.trim() ? cf.town.trim() + ', ' + cf.state.trim() : undefined,
      assignedTo: DEMO_USERS[viewingAs].name + ' (' + ROLE_BY_CODE[viewingAs].label + ')',
      attachments: Object.values(cfDocs).filter((f): f is File => !!f).map((f) => f.name),
      summary: (cf.firmName.trim() || 'This firm') + ' (' + (cf.town.trim() || 'town not entered') + ') — entered directly by ' + DEMO_USERS[viewingAs].name + ', no incoming email. ' + documents.filter((d) => d.received).length + '/' + documents.length + ' documents attached.',
      documents,
      subtype: cf.partnerType === 'distributor' ? subtype : undefined,
      oldDbCode: subtype === 'replacement' ? (cf.oldDbCode.trim() || undefined) : undefined,
      oldDbName: subtype === 'replacement' ? (cf.oldDbName.trim() || undefined) : undefined,
      additionalReason: subtype === 'additional' ? (cf.additionalReason.trim() || undefined) : undefined,
      discontinuationForm: discFormFilled ? cfDiscForm : undefined,
    }
    this.tick.update((n) => n + 1)
    this.cancelCreate()
    this.router.navigate(['/intake', id])
  }

  protected cancelCreate(): void {
    this.createOpen.set(false)
    this.cf.set(BLANK_CREATE_FORM)
    this.cfDocs.set({})
    this.cfDiscForm.set(BLANK_DISC_FORM)
  }

  protected handleFile(file: File): void {
    if (!TEXT_FILE.test(file.name)) {
      this.note.set('"' + file.name + '" is a binary file — PDF/Excel parsing needs the extraction backend. Paste the email text to run the extractor now.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => this.ingest(file.name, 'Manual upload — ' + file.name, String(reader.result ?? ''), 'document')
    reader.onerror = () => this.note.set('Couldn\'t read "' + file.name + '".')
    reader.readAsText(file)
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) this.handleFile(file)
    input.value = ''
  }

  // Open the full review as an in-app detail view (same window — keeps the sidebar/topbar).
  protected review(id: string): void {
    this.router.navigate(['/intake', id])
  }

  protected goToMySettings(): void {
    this.router.navigate(['/my-settings'])
  }

  protected goToNewApplication(): void {
    this.router.navigate(['/new-application'])
  }

  protected metaLine(e: Extraction): string {
    let s = e.receivedAt + ' · ' + (e.channel === 'email' ? 'Email' : 'Upload')
    if (e.region) s += ' · ' + e.region
    if (e.attachments?.length) s += ' · ' + e.attachments.length + ' file' + (e.attachments.length > 1 ? 's' : '')
    return s
  }

  protected confTone(p: number): 'good' | 'warn' | 'crit' {
    return p >= 85 ? 'good' : p >= 60 ? 'warn' : 'crit'
  }

  protected priorityPillData(p?: IntakePriority): { tone: 'crit' | 'neutral'; dot: boolean; label: string } | null {
    if (p === 'high') return { tone: 'crit', dot: true, label: 'High priority' }
    if (p === 'low') return { tone: 'neutral', dot: false, label: 'Low priority' }
    return null
  }

  protected hasMissingDocs(e: Extraction): boolean {
    return !!e.documents && e.documents.some((d) => !d.received)
  }

  protected missingDocsCount(e: Extraction): number {
    return e.documents ? e.documents.filter((d) => !d.received).length : 0
  }

  protected candidateNames(e: Extraction): string {
    return e.candidates ? e.candidates.map((c) => c.name).join(', ') : ''
  }

  private fieldNames(e: Extraction): string[] {
    return e.candidates ? [] : e.fields.filter((f) => f.ok).map((f) => f.label)
  }

  protected fieldNamesPreview(e: Extraction): string {
    const names = this.fieldNames(e)
    return names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '')
  }
}
