import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ButtonComponent, CardComponent, PillComponent } from '../components/ui'
import type { Tone } from '../components/ui'
import { IconComponent } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import { AppStore } from '../store'
import { EXTRACTIONS, applyDocOverrides, mergedFields } from '../mock/intake'
import type { Extraction, RequiredDoc } from '../mock/intake'
import { isBusinessCapacityDoc } from '../lib/documentPolicy'
import { buildPdf, openPdfInNewTab } from '../lib/pdf'
import type { PdfLine } from '../lib/pdf'
import { apiFetch } from '../lib/api'

// Same deterministic per-file tamper check Intake Review runs inline — centralized here so
// ASE/ASM has one place to authenticity-check every received document across the whole intake
// queue, instead of opening each lead one at a time.
function scanFor(fileName: string): boolean {
  const h = [...fileName].reduce((a, ch) => a + ch.charCodeAt(0), 0)
  return h % 7 === 0
}

type CheckStatus = 'passed' | 'suspicious' | 'tampered'
// Every check always carries a detail — for a passed check it's what was actually verified
// (not just "nothing to report"), so dropping down any row shows real supporting information.
interface CheckItem {
  key: string; label: string; sub: string; status: CheckStatus
  detail: { page: number; location: string; issue: string; confidence: number }
}
interface Analysis { checks: CheckItem[]; overallScore: number; confidence: number; risk: 'Low' | 'Medium' | 'High' }

// Deterministic per document — same file always analyzes the same way. The base tampered
// signal reuses the list view's scanFor() so the two screens never disagree with each other.
function analyzeDoc(doc: RequiredDoc): Analysis {
  const key = doc.file ?? doc.name
  const seed = [...key].reduce((a, ch) => a + ch.charCodeAt(0), 0)
  const tampered = scanFor(key)
  const fontSus = seed % 5 === 0
  const sigSus = seed % 4 === 0
  const checks: CheckItem[] = [
    {
      key: 'metadata', label: 'Metadata Analysis', sub: 'File creation & modification history', status: 'passed',
      detail: { page: 1, location: 'Document properties', issue: 'Creation and last-modified timestamps are consistent with the claimed upload date — no post-hoc editing tool signature found.', confidence: 96 },
    },
    {
      key: 'text', label: 'Text Layer Analysis', status: tampered ? 'tampered' : 'passed',
      sub: tampered ? 'Edited text detected' : 'No edited text layers found',
      detail: tampered
        ? { page: 1, location: 'GSTIN', issue: 'Text appears to be digitally altered', confidence: 94 }
        : { page: 1, location: 'Full document', issue: 'Every text layer traces back to the original render — no overlaid or re-typed characters detected.', confidence: 95 },
    },
    {
      key: 'font', label: 'Font Consistency', status: fontSus ? 'suspicious' : 'passed',
      sub: fontSus ? 'Different font family detected' : 'Consistent font usage throughout',
      detail: fontSus
        ? { page: 1, location: 'Date of issue', issue: 'Font weight differs from surrounding text', confidence: 68 }
        : { page: 1, location: 'Full document', issue: 'Same font family and weight used end to end, matching the issuing authority\'s known template.', confidence: 92 },
    },
    {
      key: 'qr', label: 'QR Code Verification', sub: 'QR matches issuing database', status: 'passed',
      detail: { page: 1, location: 'QR code', issue: 'Decoded payload matches the issuing authority\'s reference number on file.', confidence: 97 },
    },
    {
      key: 'seal', label: 'Seal Detection', sub: 'Seal detected and verified', status: 'passed',
      detail: { page: 1, location: 'Official seal', issue: 'Seal shape, placement and ink pattern match the issuing authority\'s registered seal.', confidence: 93 },
    },
    {
      key: 'sig', label: 'Signature Analysis', status: sigSus ? 'suspicious' : 'passed',
      sub: sigSus ? 'Possible pasted signature' : 'Signature consistent with issuer records',
      detail: sigSus
        ? { page: 1, location: 'Signature block', issue: 'Signature edges show pixel inconsistency', confidence: 61 }
        : { page: 1, location: 'Signature block', issue: 'Stroke pressure and pixel edges are continuous with the rest of the scan — no cut-and-paste artifacts.', confidence: 90 },
    },
  ]
  const issues = checks.filter((c) => c.status !== 'passed').length
  return {
    checks,
    overallScore: Math.max(35, 100 - issues * 22),
    confidence: Math.max(50, 100 - issues * 10),
    risk: tampered ? 'High' : issues > 0 ? 'Medium' : 'Low',
  }
}

// Field rows for the mock preview panel — real extracted values where the lead's intake has
// them, generic placeholders otherwise (same "prototype stand-in" convention used everywhere
// else this app generates a document preview).
function previewRows(ext: Extraction, doc: RequiredDoc): { k: string; v: string; flag?: 'text' | 'font' }[] {
  const val = (re: RegExp) => mergedFields(ext).find((f) => re.test(f.label) && f.ok)?.value
  const firm = val(/firm|agency/i) ?? ext.source
  const gst = val(/gst/i) ?? '27AAAAA0000A1Z5'
  const town = val(/town/i) ?? '—'
  const state = val(/^state/i) ?? 'Maharashtra'
  if (doc.name.toLowerCase().includes('gst')) {
    // Field-for-field match to the real Form GST REG-06 Registration Certificate (see
    // samples_for_demo/gst_rao_distributors.pdf) — a synthetic preview should read as a
    // complete certificate, not a truncated summary, even with no real file to fall back to.
    return [
      { k: 'GSTIN', v: gst, flag: 'text' },
      { k: 'Legal Name', v: firm.toUpperCase() },
      { k: 'Trade Name, if any', v: firm },
      { k: 'Constitution of Business', v: 'Proprietorship' },
      { k: 'Address of Principal Place of Business', v: town + ', ' + state },
      { k: 'Date of Liability', v: ext.receivedAt },
      { k: 'Period of Validity', v: 'From date of liability · To Not Applicable' },
      { k: 'Type of Registration', v: 'Regular' },
      { k: 'Particulars of Approving Authority', v: 'State Tax Officer, ' + town },
      { k: 'Date of issue of Certificate', v: ext.receivedAt, flag: 'font' },
    ]
  }
  return [
    { k: 'Firm / Agency', v: firm },
    { k: 'Town / City', v: town },
    { k: 'State', v: state },
    { k: 'Document', v: doc.name, flag: 'text' },
  ]
}

const STATUS_TONE: Record<CheckStatus, Tone> = { passed: 'good', suspicious: 'warn', tampered: 'crit' }
const STATUS_LABEL: Record<CheckStatus, string> = { passed: 'Passed', suspicious: 'Suspicious', tampered: 'Tampered' }

// Same deterministic bucketing scanFor() already uses for tampered — extended with a
// "pending" bucket (not yet reviewed) purely for the dashboard's 3-way split. A document's
// bucket never changes between screens since it's derived from the same file identity.
type DocBucket = 'verified' | 'flagged' | 'pending'
function bucketFor(doc: RequiredDoc): DocBucket {
  const key = doc.file ?? doc.name
  const h = [...key].reduce((a, ch) => a + ch.charCodeAt(0), 0)
  if (h % 7 === 0) return 'flagged'
  if (h % 9 === 0) return 'pending'
  return 'verified'
}
const BUCKET_LABEL: Record<DocBucket, string> = { verified: 'Verified', flagged: 'Flagged', pending: 'Pending' }
const BUCKET_TONE: Record<DocBucket, Tone> = { verified: 'good', flagged: 'crit', pending: 'warn' }
const BUCKET_COLOR: Record<DocBucket, string> = { verified: 'var(--good)', flagged: 'var(--crit)', pending: 'var(--warn)' }
const BUCKET_ORDER: DocBucket[] = ['verified', 'flagged', 'pending']

// Deterministic 7-point series ending exactly at `end` — decorative trend history, not a
// claim of real historical data (same convention Analytics.tsx's trendToward() uses).
function trendToward(end: number, n = 7): number[] {
  const start = Math.max(0, end * 0.5)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const base = start + (end - start) * t
    const wiggle = Math.sin(i * 2.1 + end) * (base * 0.12)
    return Math.max(0, Math.round(base + wiggle))
  })
}

const PAGE_SIZE = 7
const DONUT_R = 46
const DONUT_C = 2 * Math.PI * DONUT_R
const TREND_W = 320
const TREND_H = 130
const TREND_PAD = 8

interface IntakeDocRow { ext: Extraction; docs: RequiredDoc[]; excluded: RequiredDoc[] }
interface DonutSegment { bucket: DocBucket; len: number; offset: number }
interface CopilotMsg { who: 'user' | 'bot'; text: string; bullets?: string[] }

@Component({
  selector: 'app-document-authenticity',
  standalone: true,
  imports: [FormsModule, ButtonComponent, CardComponent, PillComponent, IconComponent],
  templateUrl: './document-authenticity.component.html',
  styleUrl: './document-authenticity.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentAuthenticityComponent {
  protected readonly store = inject(AppStore)

  // Module-level data/functions the template reads directly.
  protected readonly STATUS_TONE = STATUS_TONE
  protected readonly STATUS_LABEL = STATUS_LABEL
  protected readonly BUCKET_LABEL = BUCKET_LABEL
  protected readonly BUCKET_TONE = BUCKET_TONE
  protected readonly BUCKET_COLOR = BUCKET_COLOR
  protected readonly BUCKET_ORDER = BUCKET_ORDER
  protected readonly LEAD_TABS: ('all' | DocBucket)[] = ['all', 'verified', 'flagged', 'pending']
  protected readonly THUMB_PAGES = [1, 2, 3]

  // ---- dashboard state ----
  protected readonly detail = signal<{ ext: Extraction; doc: RequiredDoc } | null>(null)
  protected readonly tab = signal<'all' | 'verified' | 'flagged' | 'pending'>('all')
  protected readonly query = signal('')
  protected readonly page = signal(1)

  // ---- detail-view state (mirrors DocumentDetail's own local state in the source) ----
  protected readonly docSel = signal<RequiredDoc | null>(null)
  protected readonly detailTab = signal<'all' | 'issues' | 'passed'>('all')
  protected readonly openCheck = signal<string | null>(null)
  protected readonly realDoc = signal<{ url: string; type: string } | null>(null)
  protected readonly copilotMsgs = signal<CopilotMsg[]>([])
  protected readonly copilotDraft = signal('')

  // Cancellation token for the real-attachment fetch below — a stale response for a doc the
  // analyst has since switched away from must never overwrite the currently-selected preview.
  private docLoadToken = 0
  private lastObjectUrl: string | null = null

  private recency(e: Extraction): number {
    const m = e.id.match(/^intake-(\d+)$/)
    if (m) return +m[1]
    const t = Date.parse(e.receivedFull ?? '')
    return Number.isNaN(t) ? 0 : t
  }

  // Every intake item with at least one received document — across the whole Intake Inbox,
  // not just whichever lead you happened to open. Reactive on intakeDocOverrides so a document
  // actually uploaded/replaced from Intake Review is re-applied here too (see store.ts's
  // intakeDocOverrides), same as the source's per-render Object.values(...).forEach(...) call.
  protected readonly items = computed<IntakeDocRow[]>(() => {
    const overrides = this.store.intakeDocOverrides()
    Object.values(EXTRACTIONS).forEach((e) => applyDocOverrides(e, overrides[e.id]))
    return Object.values(EXTRACTIONS)
      .map((ext) => ({
        ext,
        docs: (ext.documents ?? []).filter((d) => d.received && !isBusinessCapacityDoc(d.name)),
        excluded: (ext.documents ?? []).filter((d) => d.received && isBusinessCapacityDoc(d.name)),
      }))
      .filter((row) => row.docs.length > 0 || row.excluded.length > 0)
      .sort((a, b) => this.recency(b.ext) - this.recency(a.ext))
  })

  protected readonly allDocsFlat = computed(() => this.items().flatMap(({ ext, docs, excluded }) => [...docs, ...excluded].map((doc) => ({ ext, doc }))))

  protected readonly counts = computed<Record<DocBucket, number>>(() => {
    const counts: Record<DocBucket, number> = { verified: 0, flagged: 0, pending: 0 }
    this.allDocsFlat().forEach(({ doc }) => counts[bucketFor(doc)]++)
    return counts
  })

  protected readonly total = computed(() => this.allDocsFlat().length)

  protected leadStatus(row: IntakeDocRow): DocBucket {
    const docs = [...row.docs, ...row.excluded]
    if (docs.some((d) => bucketFor(d) === 'flagged')) return 'flagged'
    if (docs.some((d) => bucketFor(d) === 'pending')) return 'pending'
    return 'verified'
  }

  protected readonly topTypes = computed(() => {
    const typeCounts = new Map<string, number>()
    this.allDocsFlat().forEach(({ doc }) => typeCounts.set(doc.name, (typeCounts.get(doc.name) ?? 0) + 1))
    return [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  })

  protected readonly flaggedDocs = computed(() => {
    return this.allDocsFlat()
      .filter(({ doc }) => bucketFor(doc) === 'flagged')
      .map(({ ext, doc }) => {
        const failing = analyzeDoc(doc).checks.find((c) => c.status !== 'passed')
        return { ext, doc, tag: failing?.label.replace(' Analysis', '').replace(' Verification', '').replace(' Detection', '') ?? 'Flagged' }
      })
      .slice(0, 4)
  })

  protected readonly trendLabels: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  })

  protected readonly filteredItems = computed(() => {
    const tab = this.tab()
    const query = this.query()
    return this.items()
      .filter((row) => tab === 'all' || this.leadStatus(row) === tab)
      .filter((row) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        return row.ext.source.toLowerCase().includes(q) || [...row.docs, ...row.excluded].some((d) => d.name.toLowerCase().includes(q))
      })
  })

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / PAGE_SIZE)))
  protected readonly pageItems = computed(() => {
    const page = this.page()
    return this.filteredItems().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  })
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1))
  protected readonly showingFrom = computed(() => (this.page() - 1) * PAGE_SIZE + 1)
  protected readonly showingTo = computed(() => Math.min(this.page() * PAGE_SIZE, this.filteredItems().length))

  protected readonly donutSegments = computed<DonutSegment[]>(() => {
    const counts = this.counts()
    const total = this.total()
    let cursor = 0
    return BUCKET_ORDER.map((bucket) => {
      const frac = total ? counts[bucket] / total : 0
      const len = Math.max(0, frac * DONUT_C - (frac > 0 ? 2.5 : 0))
      const seg: DonutSegment = { bucket, len, offset: -cursor * DONUT_C }
      cursor += frac
      return seg
    }).filter((seg) => counts[seg.bucket] > 0)
  })
  protected readonly donutCircumference = DONUT_C

  protected readonly trendChart = computed(() => {
    const counts = this.counts()
    const series = [
      { label: 'Verified', bucket: 'verified' as DocBucket, data: trendToward(counts.verified) },
      { label: 'Flagged', bucket: 'flagged' as DocBucket, data: trendToward(counts.flagged) },
      { label: 'Pending', bucket: 'pending' as DocBucket, data: trendToward(counts.pending) },
    ]
    const labels = this.trendLabels
    const n = labels.length
    const max = Math.max(1, ...series.flatMap((s) => s.data))
    const x = (i: number) => TREND_PAD + (i / (n - 1)) * (TREND_W - TREND_PAD * 2)
    const y = (v: number) => TREND_H - TREND_PAD - (v / max) * (TREND_H - TREND_PAD * 2 - 16)
    return series.map((s) => ({
      label: s.label,
      color: BUCKET_COLOR[s.bucket],
      points: s.data.map((v, i) => x(i) + ',' + y(v)).join(' '),
      circles: s.data.map((v, i) => ({ cx: x(i), cy: y(v) })),
    }))
  })

  protected pct(n: number, of: number): number {
    return of ? Math.round((n / of) * 100) : 0
  }

  protected barWidth(count: number): number {
    const top = this.topTypes()[0]?.[1] || 1
    return Math.round((count / top) * 100)
  }

  protected leadTabLabel(t: 'all' | DocBucket): string {
    if (t === 'all') return 'All ' + this.items().length
    return BUCKET_LABEL[t] + ' ' + this.items().filter((r) => this.leadStatus(r) === t).length
  }

  protected rowDocs(row: IntakeDocRow): RequiredDoc[] {
    return [...row.docs, ...row.excluded]
  }

  protected rowDocCount(row: IntakeDocRow): number {
    return row.docs.length + row.excluded.length
  }

  // Open whichever document actually earned the row's status badge — a lead badged "Flagged"
  // because doc #3 is tampered shouldn't land on doc #1's clean analysis.
  protected rowFirstDoc(row: IntakeDocRow): RequiredDoc | undefined {
    const allDocs = this.rowDocs(row)
    const priorityDoc = allDocs.find((d) => bucketFor(d) === 'flagged') ?? allDocs.find((d) => bucketFor(d) === 'pending')
    return priorityDoc ?? allDocs[0]
  }

  protected setTab(t: 'all' | 'verified' | 'flagged' | 'pending'): void {
    this.tab.set(t)
    this.page.set(1)
  }

  protected onQueryChange(v: string): void {
    this.query.set(v)
    this.page.set(1)
  }

  protected setPage(p: number): void {
    this.page.set(p)
  }

  protected prevPage(): void {
    this.page.update((p) => p - 1)
  }

  protected nextPage(): void {
    this.page.update((p) => p + 1)
  }

  // Opening a lead+doc is the one and only "mount" of the detail view (mirrors DocumentDetail's
  // own useState initializers, and its `useEffect(() => setDoc(initialDoc), [initialDoc])`, which
  // only ever ran on mount since the source unmounts DocumentDetail entirely on "Back to queue") —
  // so every per-detail-view signal is (re)initialized here, synchronously, rather than through a
  // reactive effect keyed off `detail()` that could otherwise observe a stale signal for a tick.
  protected openDoc(ext: Extraction, doc: RequiredDoc): void {
    this.store.logAudit({ actor: 'Document Intelligence Agent', kind: 'ai', action: 'Opened analysis for ' + doc.name, entity: ext.source })
    this.detail.set({ ext, doc })
    this.docSel.set(doc)
    this.detailTab.set('all')
    const analysis = analyzeDoc(doc)
    this.openCheck.set(analysis.checks.find((c) => c.status !== 'passed')?.key ?? null)
    const issues = analysis.checks.filter((c) => c.status !== 'passed')
    this.copilotMsgs.set(issues.length
      ? [{ who: 'user', text: 'Why do you think this document is tampered?' }, { who: 'bot', text: 'I found several indicators in this document:', bullets: this.summaryBulletsFor(issues) }]
      : [])
    this.copilotDraft.set('')
    this.loadRealDoc(ext, doc)
  }

  protected backToQueue(): void {
    if (this.lastObjectUrl) { URL.revokeObjectURL(this.lastObjectUrl); this.lastObjectUrl = null }
    this.realDoc.set(null)
    this.docSel.set(null)
    this.detail.set(null)
  }

  protected bucketFor(doc: RequiredDoc): DocBucket {
    return bucketFor(doc)
  }

  // ---- detail-view derived state ----

  // Which of this lead's received documents is being checked — every document the row has,
  // recomputed from `items` (so it stays live if intakeDocOverrides changes) rather than frozen
  // to whatever was true at the moment the lead was opened.
  protected readonly detailDocs = computed<RequiredDoc[]>(() => {
    const d = this.detail()
    if (!d) return []
    const row = this.items().find((r) => r.ext.id === d.ext.id)
    return row ? this.rowDocs(row) : [d.doc]
  })

  protected readonly analysis = computed<Analysis | null>(() => {
    const doc = this.docSel()
    return doc ? analyzeDoc(doc) : null
  })

  protected readonly detailIssues = computed(() => this.analysis()?.checks.filter((c) => c.status !== 'passed') ?? [])
  protected readonly detailPassed = computed(() => this.analysis()?.checks.filter((c) => c.status === 'passed') ?? [])
  protected readonly visibleChecks = computed(() => {
    const a = this.analysis()
    if (!a) return []
    const tab = this.detailTab()
    return tab === 'issues' ? this.detailIssues() : tab === 'passed' ? this.detailPassed() : a.checks
  })

  protected readonly detailRows = computed(() => {
    const d = this.detail()
    const doc = this.docSel()
    return d && doc ? previewRows(d.ext, doc) : []
  })
  protected readonly tamperedRow = computed(() => {
    const a = this.analysis()
    return this.detailRows().find((r) => r.flag === 'text' && a?.checks.find((c) => c.key === 'text')?.status === 'tampered')
  })
  protected readonly suspiciousRow = computed(() => {
    const a = this.analysis()
    return this.detailRows().find((r) => r.flag === 'font' && a?.checks.find((c) => c.key === 'font')?.status === 'suspicious')
  })
  protected certRowClass(r: { k: string; v: string; flag?: 'text' | 'font' }): string {
    if (this.tamperedRow() === r) return 'tampered'
    if (this.suspiciousRow() === r) return 'suspicious'
    return ''
  }

  protected readonly worst = computed<CheckStatus>(() => {
    const a = this.analysis()
    if (!a) return 'passed'
    return a.checks.some((c) => c.status === 'tampered') ? 'tampered' : a.checks.some((c) => c.status === 'suspicious') ? 'suspicious' : 'passed'
  })
  protected readonly verdictTitle = computed(() => {
    const w = this.worst()
    return w === 'tampered' ? 'Possible Tampering Detected' : w === 'suspicious' ? 'Minor Inconsistencies Found' : 'Document Appears Authentic'
  })
  protected readonly verdictBody = computed(() => {
    const w = this.worst()
    return w === 'tampered'
      ? 'This document has signs of digital alteration in certain areas. Please review the details.'
      : w === 'suspicious'
        ? 'Nothing conclusive, but a few checks came back suspicious rather than a clean pass.'
        : 'All checks passed — no signs of tampering, inconsistent fonts, or seal/signature issues.'
  })
  protected readonly verdictRec = computed(() => (this.worst() === 'passed' ? 'No further action needed.' : 'Review & verify with original source.'))

  protected confidenceCaption(pct: number): string {
    return pct >= 80 ? 'High Confidence' : pct >= 60 ? 'Medium Confidence' : 'Low Confidence'
  }

  protected checkIcon(status: CheckStatus): IconName {
    return status === 'passed' ? 'check' : status === 'suspicious' ? 'alert' : 'close'
  }

  protected selectDoc(doc: RequiredDoc): void {
    this.docSel.set(doc)
    const d = this.detail()
    if (d) this.loadRealDoc(d.ext, doc)
  }

  protected toggleCheck(key: string): void {
    this.openCheck.set(this.openCheck() === key ? null : key)
  }

  protected setDetailTab(t: 'all' | 'issues' | 'passed'): void {
    this.detailTab.set(t)
  }

  // Loads the REAL attachment for the inline preview panel — a file actually uploaded/replaced
  // from Intake Review (doc.dataUrl, persisted — see store.ts's intakeDocOverrides) first, then
  // the email-captured one on the backend (see backend/email_service/attachment_store.py), and
  // only falls back to the synthetic mock preview below if neither exists for this doc.
  private loadRealDoc(ext: Extraction, doc: RequiredDoc): void {
    const token = ++this.docLoadToken
    if (this.lastObjectUrl) { URL.revokeObjectURL(this.lastObjectUrl); this.lastObjectUrl = null }
    this.realDoc.set(null)
    if (doc.dataUrl) {
      this.realDoc.set({ url: doc.dataUrl, type: doc.dataUrl.match(/^data:([^;]+)/)?.[1] ?? '' })
      return
    }
    if (!doc.file) return
    apiFetch(`/api/intake/${encodeURIComponent(ext.id)}/attachment?filename=${encodeURIComponent(doc.file)}`, this.store.authToken())
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (token !== this.docLoadToken || !blob) return
        const objectUrl = URL.createObjectURL(blob)
        this.lastObjectUrl = objectUrl
        this.realDoc.set({ url: objectUrl, type: blob.type })
      })
      .catch(() => { /* fall back to mock preview */ })
  }

  // Same real-file-first preference as the inline preview above, for the "View original" tab.
  protected async viewOriginal(): Promise<void> {
    const d = this.detail()
    const doc = this.docSel()
    if (!d || !doc) return
    if (doc.dataUrl) { window.open(doc.dataUrl, '_blank'); return }
    if (doc.file) {
      const win = window.open('', '_blank')
      try {
        const res = await apiFetch(`/api/intake/${encodeURIComponent(d.ext.id)}/attachment?filename=${encodeURIComponent(doc.file)}`, this.store.authToken())
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          if (win) win.location.href = url; else window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
          return
        }
      } catch { /* fall through to mock */ }
      win?.close()
    }
    const rows = this.detailRows()
    openPdfInNewTab(buildPdf([
      { text: 'Acme Distribution Partner Platform — Document on file', size: 9, gap: 18 },
      { text: doc.name, size: 18, bold: true, gap: 30 },
      { text: d.ext.source, size: 11, gap: 20 },
      ...rows.map((r): PdfLine => ({ text: r.k + ':   ' + r.v, size: 10.5, gap: 18 })),
      { text: ' ', gap: 16 },
      { text: 'Generated preview PDF — prototype stand-in for the actual scan.', size: 8.5 },
    ]))
  }

  protected downloadReport(): void {
    const d = this.detail()
    const doc = this.docSel()
    const analysis = this.analysis()
    if (!d || !doc || !analysis) return
    openPdfInNewTab(buildPdf([
      { text: 'Acme Distribution Document Intelligence — Full Report', size: 9, gap: 18 },
      { text: doc.name, size: 18, bold: true, gap: 26 },
      { text: 'Overall Score: ' + analysis.overallScore + '/100   Risk Level: ' + analysis.risk + '   Confidence: ' + analysis.confidence + '%', size: 10.5, gap: 22 },
      ...analysis.checks.flatMap((c): PdfLine[] => ([
        { text: c.label + ' — ' + STATUS_LABEL[c.status], size: 11, bold: true, gap: 16 },
        { text: c.detail ? (c.detail.location + ': ' + c.detail.issue + ' (confidence ' + c.detail.confidence + '%)') : c.sub, size: 9.5, gap: 16 },
      ])),
      { text: ' ', gap: 12 },
      { text: 'Generated report — prototype stand-in for the actual scan.', size: 8.5 },
    ]))
    this.store.logAudit({ actor: 'Document Intelligence Agent', kind: 'ai', action: 'Full report downloaded for ' + doc.name, entity: d.ext.source })
  }

  // Ask AI Copilot — scripted, deterministic replies (no live model here), same convention as
  // the rest of this prototype's mock chat threads.
  private summaryBulletsFor(issues: CheckItem[]): string[] {
    return issues.length
      ? issues.map((c) => c.detail ? c.label + ': ' + c.detail.issue + ' (' + c.detail.location + ', ' + c.detail.confidence + '% confidence)' : c.label + ': ' + c.sub)
      : ['All six checks passed — no signs of tampering, inconsistent fonts, or seal/signature issues.']
  }

  protected askCopilot(q: string): void {
    if (!q.trim()) return
    const summaryBullets = this.summaryBulletsFor(this.detailIssues())
    this.copilotMsgs.update((m) => [...m, { who: 'user', text: q.trim() }, { who: 'bot', text: 'Based on the checks run on this document:', bullets: summaryBullets }])
    this.copilotDraft.set('')
  }

  protected askExplainIssue(): void {
    const label = this.detailIssues()[0]?.label ?? 'Text Layer Analysis'
    this.askCopilot('Explain the ' + label + ' issue')
  }

  protected askQrValid(): void {
    this.askCopilot('Is the QR code valid?')
  }

  protected onCopilotSubmit(): void {
    this.askCopilot(this.copilotDraft())
  }
}
