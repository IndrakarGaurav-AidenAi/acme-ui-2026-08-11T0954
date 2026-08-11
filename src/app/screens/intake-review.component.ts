import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { ButtonComponent, CardComponent, ModalComponent, PillComponent } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore } from '../store'
import { DEMO_USERS, ROLE_BY_CODE } from '../mock/roles'
import { EXTRACTIONS, DOC_DETAIL, applyDocOverrides, capturedCount, missingFieldLabels, mergedFields, recoveredFields } from '../mock/intake'
import type { Extraction, RequiredDoc } from '../mock/intake'
import type { ApplicationSubtype, CandidateCard, DisengagementForm } from '../types'
import { docBodyText, docIssuer, downloadDoc, fieldsFromDoc, focusRowKey, openDocPreview, sourceDocFor, sourceRowsFor } from '../lib/docSource'
import { apiGet, apiFetch, apiPost } from '../lib/api'
import { applyPartnerToDiscForm, BLANK_DISC_FORM, DB_SUBTYPES, DisengagementFormFieldsComponent, SUBTYPE_MAP } from '../components/DisengagementForm'

const FIELD_ICON: Record<string, IconName> = {
  'Firm / Agency Name': 'partners', 'Contact Person': 'user', 'Phone Number': 'comms',
  'Email Address': 'mail', 'Town / City': 'target', State: 'target',
  'DB Type Requested': 'templates', 'Turnover Claim (₹/mo)': 'analytics', 'GST Number': 'documents',
}

@Component({
  selector: 'app-intake-review',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent, CardComponent, ModalComponent, PillComponent, IconComponent, DisengagementFormFieldsComponent],
  templateUrl: './intake-review.component.html',
  styleUrl: './intake-review.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntakeReviewComponent {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  protected readonly store = inject(AppStore)
  private readonly destroyRef = inject(DestroyRef)

  protected readonly id = this.route.snapshot.paramMap.get('id') ?? ''
  private readonly refreshTick = signal(0)
  protected readonly ext = computed<Extraction | undefined>(() => {
    this.refreshTick()
    return EXTRACTIONS[this.id]
  })
  protected readonly refetchDone = signal(false)

  protected readonly showRaw = signal(false)
  protected readonly notes = signal('')
  protected readonly docs = signal<RequiredDoc[]>(EXTRACTIONS[this.id]?.documents ?? [])
  protected readonly uploadNote = signal<string | null>(null)
  protected readonly locState = signal<'idle' | 'running' | 'done'>('idle')
  protected readonly manualValues = signal<Record<string, string>>({})
  protected readonly editField = signal<string | null>(null)
  protected readonly editVal = signal('')
  protected readonly sourceDoc = signal<{ doc: RequiredDoc; field?: string } | null>(null)
  protected readonly requestOpen = signal(false)
  protected readonly requestSel = signal<Set<string>>(new Set())
  protected readonly requestMsg = signal('')
  protected readonly sending = signal(false)
  protected readonly sendError = signal<string | null>(null)
  protected readonly mailNote = signal<string | null>(null)
  protected readonly uploadedFiles = signal<Record<string, File>>({})
  protected readonly uploadedFields = signal<Record<string, { label: string; value: string; ok: boolean }[]>>({})
  protected readonly extractingDoc = signal<string | null>(null)
  protected readonly subtype = signal<ApplicationSubtype>(EXTRACTIONS[this.id]?.subtype ?? 'new')
  protected readonly oldDbCode = signal(EXTRACTIONS[this.id]?.oldDbCode ?? '')
  protected readonly oldDbName = signal(EXTRACTIONS[this.id]?.oldDbName ?? '')
  protected readonly additionalReason = signal(EXTRACTIONS[this.id]?.additionalReason ?? '')
  protected readonly discForm = signal<DisengagementForm>(EXTRACTIONS[this.id]?.discontinuationForm ?? BLANK_DISC_FORM)
  protected readonly openMenuDoc = signal<string | null>(null)

  protected readonly DB_SUBTYPES = DB_SUBTYPES

  protected readonly viewingAs = computed(() => this.store.viewingAs() ?? 'ase_asm')
  protected readonly canUpload = computed(() => this.viewingAs() === 'ase_asm' || this.viewingAs() === 'admin' || this.viewingAs() === 'channel_dev')
  protected readonly allPartners = computed(() => this.store.partners())
  protected readonly codedDistributors = computed(() => this.allPartners().filter((p) => p.partnerType === 'distributor' && p.dbCode))
  protected readonly dbSubtypeLabel = computed(() =>
    (Object.entries(SUBTYPE_MAP).find(([, v]) => v === this.subtype())?.[0] ?? 'New DB') as (typeof DB_SUBTYPES)[number])

  protected readonly total = computed(() => this.ext()?.fields.length ?? 0)
  protected readonly manualCount = computed(() => Object.values(this.manualValues()).filter((v) => v.trim()).length)
  protected readonly captured = computed(() => {
    const e = this.ext()
    return e ? Math.min(this.total(), capturedCount(e) + this.manualCount()) : 0
  })
  protected readonly confPct = computed(() => this.ext()?.confidencePct ?? 0)
  protected readonly confTone = computed(() => (this.confPct() >= 85 ? 'good' : this.confPct() >= 60 ? 'warn' : 'crit') as 'good' | 'warn' | 'crit')
  protected readonly confLabel = computed(() => (this.confPct() >= 85 ? 'High' : this.confPct() >= 60 ? 'Medium' : 'Low'))
  protected readonly docsReceived = computed(() => this.docs().filter((d) => d.received).length)
  protected readonly missing = computed(() => {
    const e = this.ext()
    if (!e) return []
    return missingFieldLabels(e).filter((l) => !this.manualValues()[l]?.trim())
  })
  protected readonly missingDocs = computed(() => this.docs().filter((d) => !d.received).map((d) => d.name))
  protected readonly missingAll = computed(() => [...this.missing(), ...this.missingDocs()])
  protected readonly recoveredCount = computed(() => (this.ext() ? recoveredFields(this.ext()!).length : 0))

  protected readonly messageSummary = computed(() => {
    const e = this.ext()
    if (!e) return ''
    if (e.summary) return e.summary
    const firm = this.mval(/firm|agency/i) ?? e.source
    const town = this.mval(/town/i)
    const state = this.mval(/^state/i)
    const dbType = this.mval(/db type/i)
    const contact = this.mval(/contact/i)
    const email = this.mval(/email/i)
    const docs = this.docs()
    return [
      `${firm}${town ? ` (${town}${state ? ', ' + state : ''})` : ''} is requesting appointment${dbType ? ` as ${dbType}` : ' as a distributor'}.`,
      contact ? `Contact: ${contact}${email ? ` · ${email}` : ''}.` : '',
      docs.length ? `${docs.filter((d) => d.received).length} of ${docs.length} required documents attached.` : '',
    ].filter(Boolean).join(' ')
  })
  protected readonly messageParagraphs = computed(() => {
    const e = this.ext()
    const raw = e?.raw ?? ''
    const blocks = raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
    if (blocks.length > 1) return blocks
    const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(' '))
    return out
  })
  protected readonly claimedTown = computed(() => this.mval(/town/i))
  protected readonly claimedState = computed(() => this.mval(/^state/i))
  protected readonly partnerFirmName = computed(() => {
    const e = this.ext()
    return e?.fields.find((f) => /firm|agency/i.test(f.label) && f.ok)?.value ?? e?.source
  })

  constructor() {
    const e0 = EXTRACTIONS[this.id]
    if (e0) applyDocOverrides(e0, this.store.intakeDocOverrides()[this.id])
    if (e0) {
      this.refetchDone.set(true)
    } else {
      apiGet<Extraction[]>('/api/intake', this.store.authToken())
        .then((items) => {
          const found = items.find((it) => it.id === this.id)
          if (found) {
            applyDocOverrides(found, this.store.intakeDocOverrides()[this.id])
            EXTRACTIONS[this.id] = found
          }
        })
        .catch(() => { /* server not running or item genuinely gone — fall through to not-found */ })
        .finally(() => { this.refetchDone.set(true); this.refreshTick.update((n) => n + 1) })
    }

    effect(() => {
      const e = this.ext()
      if (e) this.docs.set(e.documents ?? [])
    })

    const onDocClickOutside = () => this.openMenuDoc.set(null)
    document.addEventListener('mousedown', onDocClickOutside)
    this.destroyRef.onDestroy(() => document.removeEventListener('mousedown', onDocClickOutside))
  }

  private mval(re: RegExp): string | undefined {
    const e = this.ext()
    if (!e) return undefined
    return Object.entries(this.manualValues()).find(([l, v]) => re.test(l) && v.trim())?.[1]
      ?? mergedFields(e).find((f) => re.test(f.label) && f.ok)?.value
  }

  protected mergedFieldsFor(): { label: string; value: string; ok: boolean; recoveredFrom?: string }[] {
    const e = this.ext()
    return e ? mergedFields(e) : []
  }
  protected fieldIcon(label: string): IconName {
    return FIELD_ICON[label] ?? 'documents'
  }
  protected sourceDocForField(f: { label: string; ok: boolean }): RequiredDoc | undefined {
    const manual = this.manualValues()[f.label]?.trim()
    return !manual ? sourceDocFor(this.docs(), f as never) : undefined
  }
  protected initialsOf(name: string): string {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  }

  protected setEditVal(v: string) { this.editVal.set(v) }
  protected saveManual(label: string) {
    if (!this.editVal().trim()) return
    this.manualValues.update((m) => ({ ...m, [label]: this.editVal().trim() }))
    this.editField.set(null)
    this.editVal.set('')
  }
  protected startManualEdit(label: string) {
    this.editField.set(label)
    this.editVal.set('')
  }
  protected onManualKeydown(e: KeyboardEvent, label: string) {
    if (e.key === 'Enter') this.saveManual(label)
    if (e.key === 'Escape') this.editField.set(null)
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  protected async uploadDoc(docName: string, file: File) {
    const e = this.ext()
    if (!e) return
    const dataUrl = await this.readAsDataUrl(file).catch(() => undefined)
    const docs = this.docs()
    const updated: RequiredDoc = {
      ...(docs.find((d) => d.name === docName) ?? { name: docName, received: false }),
      received: true, file: file.name, dataUrl,
      detail: `${DOC_DETAIL[docName] ?? ''} Uploaded just now from this review.`.trim(),
    }
    const next = docs.map((d) => (d.name === docName ? updated : d))
    this.docs.set(next)
    e.documents = next
    e.attachments = [...(e.attachments ?? []), file.name]
    this.store.setIntakeDocOverride(this.id, updated)
    this.uploadedFiles.update((f) => ({ ...f, [docName]: file }))
    this.uploadNote.set(`"${file.name}" attached as ${docName} — reading the document…`)
    this.extractingDoc.set(docName)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/api/extract-document', this.store.authToken(), { method: 'POST', body: form })
      const result = await res.json().catch(() => null)
      if (res.ok && Array.isArray(result?.fields)) {
        this.uploadedFields.update((f) => ({ ...f, [docName]: result.fields }))
        const found = result.fields.filter((fl: { ok: boolean }) => fl.ok).length
        this.uploadNote.set(`"${file.name}" attached as ${docName} — found ${found} field${found === 1 ? '' : 's'} in the document.`)
      } else {
        this.uploadNote.set(`"${file.name}" attached as ${docName} — couldn't read fields from this file.`)
      }
    } catch {
      this.uploadNote.set(`"${file.name}" attached as ${docName} — attached, but couldn't reach the extraction service.`)
    } finally {
      this.extractingDoc.set(null)
    }
  }

  protected removeDoc(docName: string) {
    const e = this.ext()
    if (!e) return
    const docs = this.docs()
    const cleared: RequiredDoc = { name: docName, received: false }
    const next = docs.map((d) => (d.name === docName ? cleared : d))
    this.docs.set(next)
    e.documents = next
    const removedFile = docs.find((d) => d.name === docName)?.file
    if (removedFile) e.attachments = (e.attachments ?? []).filter((a) => a !== removedFile)
    this.store.setIntakeDocOverride(this.id, cleared)
    this.uploadedFiles.update((f) => { const { [docName]: _drop, ...rest } = f; return rest })
    this.uploadedFields.update((f) => { const { [docName]: _drop, ...rest } = f; return rest })
    this.uploadNote.set(`${docName} removed.`)
  }

  protected onDocFileSelected(e: Event, docName: string) {
    const input = e.target as HTMLInputElement
    const f = input.files?.[0]
    if (f) this.uploadDoc(docName, f)
    input.value = ''
  }

  protected confirmRemoveDoc(docName: string) {
    this.openMenuDoc.set(null)
    if (window.confirm(`Remove "${docName}"?`)) this.removeDoc(docName)
  }

  protected toggleDocMenu(docName: string) {
    this.openMenuDoc.update((cur) => (cur === docName ? null : docName))
  }

  protected runLoc() {
    this.locState.set('running')
    setTimeout(() => {
      this.locState.set('done')
      const e = this.ext()
      const town = this.claimedTown()
      const state = this.claimedState()
      this.store.logAudit({
        actor: 'Document Intelligence Agent', kind: 'ai',
        action: town ? `Verified location — ${town}${state ? ', ' + state : ''}` : 'Location check inconclusive (no town captured)',
        entity: e?.source ?? '',
      })
    }, 1100)
  }

  protected onSubtypeSelect(label: string) {
    this.subtype.set(SUBTYPE_MAP[label as (typeof DB_SUBTYPES)[number]])
  }
  protected onOldDbCodeSelect(code: string) {
    const picked = this.codedDistributors().find((p) => p.dbCode === code)
    this.oldDbCode.set(code)
    this.oldDbName.set(picked?.legalName ?? '')
    if (picked) this.discForm.update((s) => applyPartnerToDiscForm(s, picked))
  }

  protected createLead() {
    const e = this.ext()
    if (!e) return
    const merged = mergedFields(e)
    const val = (re: RegExp) =>
      Object.entries(this.manualValues()).find(([l, v]) => re.test(l) && v.trim())?.[1]
      ?? merged.find((f) => re.test(f.label) && f.ok)?.value
    const name = val(/firm|agency/i) ?? e.source
    const town = (val(/town/i) ?? 'Nashik').split(',')[0].trim()
    const dbType = val(/db type/i)
    const dbCategory = dbType && /GT DB|GM Excl|Traders/i.test(dbType) ? dbType : 'GT DB (with CSO/DSM)'
    const turnoverNum = parseFloat((val(/turnover/i) ?? '').replace(/[^\d.]/g, ''))
    const turnoverMonthly = Number.isFinite(turnoverNum) && turnoverNum > 0 ? turnoverNum : 150
    const viewingAs = this.viewingAs()
    const subtype = this.subtype()
    const discForm = this.discForm()
    const id = `intake-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
    const intakeLead: CandidateCard = {
      id, name, town, dbCategory,
      turnoverMonthly, expectedAcmeTurnover: Math.round(turnoverMonthly * 0.2), coverageOutlets: 1000,
      infraScore: 7, finEvalPct: 100, stage: 'open', confidencePct: e.confidencePct ?? 80,
      userCreated: true, createdBy: viewingAs, createdAt: Date.now(), sourceIntakeId: e.id,
      subtype: subtype === 'new' ? undefined : subtype,
      oldDbCode: subtype === 'replacement' ? this.oldDbCode() || undefined : undefined,
      oldDbName: subtype === 'replacement' ? this.oldDbName() || undefined : undefined,
      additionalReason: subtype === 'additional' ? this.additionalReason() || undefined : undefined,
      discontinuationForm: subtype === 'replacement' && discForm.distributorNameAddressDbCode.trim() && discForm.dateOfAppointment.trim()
        ? discForm : undefined,
    }
    const fieldOverrides: Record<string, string> = {}
    const setOv = (label: string, v?: string) => { if (v) fieldOverrides[label] = v }
    setOv('Agency / Firm name', name)
    setOv('Town', town)
    setOv('State', val(/^state/i))
    setOv('Phone Number', val(/phone/i))
    if (Number.isFinite(turnoverNum) && turnoverNum > 0) setOv('Total Monthly Turnover of the Firm', String(turnoverNum))
    this.store.shortlistCandidate(intakeLead)
    this.store.markIntakeProcessed(e.id)
    this.store.pushNotification({
      title: 'Lead shortlisted — please check',
      body: `${name} (${town}) has been shortlisted by ${DEMO_USERS[viewingAs].name} (${ROLE_BY_CODE[viewingAs].label}). Review and compare it in New Application.`,
      href: '/new-application',
      forRole: 'channel_dev',
    })
    if (viewingAs === 'ase_asm') {
      this.router.navigate(['/leads'])
      return
    }
    this.router.navigate(['/new-application'], { state: { partnerType: e.partnerType ?? 'distributor', intakeLead, fieldOverrides, intakeDocs: this.docs() } })
  }

  private async fetchRealDocBlob(doc: RequiredDoc): Promise<Blob | null> {
    if (!doc.file) return null
    const e = this.ext()
    if (!e) return null
    try {
      const res = await apiFetch(`/api/intake/${encodeURIComponent(e.id)}/attachment?filename=${encodeURIComponent(doc.file)}`, this.store.authToken())
      return res.ok ? await res.blob() : null
    } catch {
      return null
    }
  }

  protected async viewDoc(doc: RequiredDoc, field?: string) {
    const e = this.ext()
    if (!e) return
    const real = this.uploadedFiles()[doc.name]
    if (real) {
      const url = URL.createObjectURL(real)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }
    if (doc.file) {
      const labels = field ? [field] : fieldsFromDoc(e, doc)
      const values = labels.map((label) => mergedFields(e).find((f) => f.label === label)?.value).filter((v): v is string => !!v)
      const qs = new URLSearchParams({ itemId: e.id, filename: doc.file, title: doc.name })
      values.forEach((v) => qs.append('q', v))
      window.open(`/document-viewer?${qs.toString()}`, '_blank')
      return
    }
    openDocPreview(e, doc)
  }

  protected async downloadDocFile(doc: RequiredDoc) {
    const real = this.uploadedFiles()[doc.name]
    if (real) {
      const url = URL.createObjectURL(real)
      const a = document.createElement('a')
      a.href = url
      a.download = real.name
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    const blob = await this.fetchRealDocBlob(doc)
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file ?? doc.name
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    const e = this.ext()
    if (e) downloadDoc(e, doc)
  }

  private draftFor(fields: string[]): string {
    return `Hi — thanks for reaching out. To move ahead we still need: ${fields.join(', ')}. Could you share these when you get a chance?`
  }
  protected openRequest() {
    const all = this.missingAll()
    this.requestSel.set(new Set(all))
    this.requestMsg.set(this.draftFor(all))
    this.sendError.set(null)
    this.requestOpen.set(true)
  }
  protected setRequestMsg(v: string) { this.requestMsg.set(v) }
  protected toggleRequestField(label: string) {
    this.requestSel.update((sel) => {
      const next = new Set(sel)
      if (next.has(label)) next.delete(label); else next.add(label)
      this.requestMsg.set(this.draftFor(Array.from(next)))
      return next
    })
  }
  protected missingDocsSelected(): boolean {
    const sel = this.requestSel()
    return this.missingDocs().some((d) => sel.has(d))
  }
  protected missingDocsSelectedList(): string {
    const sel = this.requestSel()
    return this.missingDocs().filter((d) => sel.has(d)).join(', ')
  }

  protected async sendRequest() {
    const e = this.ext()
    if (!e) return
    this.sending.set(true)
    this.sendError.set(null)
    try {
      const requestSel = this.requestSel()
      await apiPost('/api/mail/reply', this.store.authToken(), {
        to: e.source, subject: `Re: ${e.title}`, text: this.requestMsg().trim() || this.draftFor(Array.from(requestSel)),
        itemId: e.id,
        attachDocs: this.missingDocs().filter((d) => requestSel.has(d)),
      })
      const viewingAs = this.viewingAs()
      this.store.logAudit({
        actor: DEMO_USERS[viewingAs].name, kind: 'human',
        action: `Emailed ${e.source} requesting missing info — ${Array.from(requestSel).join(', ')}`,
        entity: this.partnerFirmName() ?? '',
      })
      this.requestOpen.set(false)
      this.mailNote.set(`Reply sent to ${e.source} requesting: ${Array.from(requestSel).join(', ')}.`)
    } catch (err) {
      this.sendError.set(err instanceof Error ? err.message : 'Send failed')
    } finally {
      this.sending.set(false)
    }
  }

  protected sourceDocIssuer(name: string): string {
    return docIssuer(name)
  }
  protected sourceDocBodyText(doc: RequiredDoc): string {
    const e = this.ext()
    return e ? docBodyText(e, doc) : ''
  }
  protected sourceRows(doc: RequiredDoc) {
    const e = this.ext()
    return e ? sourceRowsFor(e, doc) : []
  }
  protected highlightKeysFor(sourceDoc: { doc: RequiredDoc; field?: string }): Set<string> {
    const e = this.ext()
    if (!e) return new Set()
    return new Set(
      sourceDoc.field
        ? [focusRowKey(sourceDoc.field)].filter((k): k is string => !!k)
        : fieldsFromDoc(e, sourceDoc.doc).map((label) => focusRowKey(label)).filter((k): k is string => !!k),
    )
  }
  protected closeRequest() { this.requestOpen.set(false) }
  protected closeSourceDoc() { this.sourceDoc.set(null) }
  protected openSourceDoc(doc: RequiredDoc, field?: string) { this.sourceDoc.set({ doc, field }) }
  protected goToIntakeInbox() { this.router.navigate(['/intake-inbox']) }
}
