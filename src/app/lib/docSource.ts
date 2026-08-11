// Shared "Source" logic — lets any screen showing an extracted field (Intake Inbox, Intake
// Review) point back at the document that field's value actually came from, with a brief,
// document-type-aware preview instead of just opening the raw PDF blind.
import type { Extraction, ExtractedField, RequiredDoc } from '../mock/intake'
import { mergedFields } from '../mock/intake'
import { buildPdf, openPdfInNewTab, wrapText } from './pdf'
import type { PdfLine } from './pdf'

export type SourceRow = { k: string; v: string; tone?: 'good' | 'warn' | 'crit' }

// Which Source-preview row to highlight for a given extracted field — lets the preview point
// straight at the exact value that came from the document (e.g. GST Number → the GSTIN row),
// instead of leaving the reader to scan every row for it.
const FOCUS_ROW_BY_FIELD: Record<string, string> = {
  'GST Number': 'GSTIN',
  'Contact Person': 'Contact person',
  'Phone Number': 'Phone',
  'Email Address': 'Email',
  'Town / City': 'Location',
}
export const focusRowKey = (fieldLabel?: string): string | undefined =>
  fieldLabel ? FOCUS_ROW_BY_FIELD[fieldLabel] : undefined

// The issuing authority line shown at the top of a document preview.
export function docIssuer(name: string): string {
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

const fieldOf = (ext: Extraction, re: RegExp) => ext.fields.find((f) => re.test(f.label) && f.ok)?.value
// Same lookup but over the merged fields (email + doc-recovered) — needed for anything a
// document supplied that the email itself was missing, e.g. a GSTIN only found on the
// attached certificate.
const mergedFieldOf = (ext: Extraction, re: RegExp) => mergedFields(ext).find((f) => re.test(f.label) && f.ok)?.value

// GST-specific check fields — mirrors what a GSTN "Search Taxpayer" lookup returns, so the
// Source preview for a GST Certificate reads like a real registration check, not a generic
// document summary.
export function gstCheckRows(ext: Extraction, doc: RequiredDoc): SourceRow[] {
  const firm = fieldOf(ext, /firm|agency/i) ?? ext.source
  const town = fieldOf(ext, /town/i) ?? '—'
  const state = fieldOf(ext, /^state/i) ?? 'Maharashtra'
  return [
    { k: 'GSTIN', v: mergedFieldOf(ext, /gst/i) ?? doc.file ?? '—' },
    { k: 'Registration Status', v: 'Active', tone: 'good' },
    { k: 'Legal Name', v: firm },
    { k: 'Trade Name', v: firm },
    { k: 'Principal Place of Business', v: `${town}, ${state}` },
    { k: 'Taxpayer Type', v: 'Regular' },
  ]
}

// Key details shown on a non-GST document's preview, built from the extracted fields.
export function docPreviewRows(ext: Extraction, doc: RequiredDoc): SourceRow[] {
  const firm = fieldOf(ext, /firm|agency/i) ?? ext.source
  const rows: SourceRow[] = [{ k: 'Firm / Agency', v: firm }]
  const n = doc.name.toLowerCase()
  if (n.includes('fssai')) rows.push({ k: 'License type', v: 'Food Business Operator' }, { k: 'Premises', v: fieldOf(ext, /town/i) ?? '—' })
  else if (n.includes('godown')) rows.push({ k: 'Location', v: fieldOf(ext, /town/i) ?? '—' }, { k: 'Proof type', v: 'Warehouse lease / ownership' })
  else if (n.includes('pan')) rows.push({ k: 'PAN', v: mergedFieldOf(ext, /gst/i)?.slice(2, 12) ?? '—' })
  else if (n.includes('iso')) rows.push({ k: 'Standard', v: 'ISO 9001:2015' })
  else if (n.includes('factory')) rows.push({ k: 'Audit result', v: 'Grade A' })
  else if (n.includes('msme')) rows.push({ k: 'Registration', v: 'UDYAM (MSME)' })
  else if (n.includes('cheque')) rows.push({ k: 'Purpose', v: 'Bank account proof' })
  else if (n.includes('form') || n.includes('onboarding')) rows.push({ k: 'DB type', v: fieldOf(ext, /db type/i) ?? '—' })
  const contact = fieldOf(ext, /contact/i), phone = fieldOf(ext, /phone/i), email = fieldOf(ext, /email/i)
  if (contact && !rows.some((r) => r.k === 'Contact')) rows.push({ k: 'Contact person', v: contact })
  if (phone && !rows.some((r) => r.k === 'Phone')) rows.push({ k: 'Phone', v: phone })
  if (email) rows.push({ k: 'Email', v: email })
  rows.push({ k: 'Status', v: 'Valid · on file' })
  return rows
}

// The rows to show for a document's Source preview — GST gets the registration-check layout,
// everything else gets the generic key-details summary.
export const sourceRowsFor = (ext: Extraction, doc: RequiredDoc): SourceRow[] =>
  doc.name.toLowerCase().includes('gst') ? gstCheckRows(ext, doc) : docPreviewRows(ext, doc)

// A realistic document body built from the extraction.
export function docBodyText(ext: Extraction, doc: RequiredDoc): string {
  const firm = fieldOf(ext, /firm|agency/i) ?? ext.source
  const town = fieldOf(ext, /town/i) ?? '—'
  const state = fieldOf(ext, /^state/i) ?? 'Maharashtra'
  const n = doc.name.toLowerCase()
  if (n.includes('gst')) return `Registration certificate issued under the GST Act to ${firm}, GSTIN ${mergedFieldOf(ext, /gst/i) ?? '—'}, ${state}. Classified as a regular taxpayer, valid from the date of registration.`
  if (n.includes('fssai')) return `This is to certify that ${firm} is licensed as a Food Business Operator for its premises at ${town}, ${state}, under the Food Safety and Standards Act, 2006. Valid for the current registration period.`
  if (n.includes('godown')) return `Warehouse lease / ownership proof for ${firm} — covered storage premises at ${town} suitable for Acme Distribution Staples distribution.`
  if (n.includes('pan')) return `Permanent Account Number card for ${firm}, issued by the Income Tax Department, Government of India.`
  if (n.includes('iso')) return `${firm} holds ISO 9001:2015 certification for its quality management system, verified by an accredited certification body.`
  if (n.includes('factory')) return `Third-party factory audit report for ${firm}. Overall assessment: Grade A — facility and process controls meet the required standard.`
  if (n.includes('msme')) return `Udyam (MSME) registration certificate for ${firm}, issued by the Ministry of Micro, Small and Medium Enterprises.`
  if (n.includes('cheque')) return `Cancelled cheque submitted by ${firm} as proof of bank account details for payment set-up.`
  if (n.includes('form') || n.includes('onboarding')) return `Distributor onboarding form submitted by ${firm} — contact ${fieldOf(ext, /contact/i) ?? '—'}, ${fieldOf(ext, /phone/i) ?? '—'} — requesting appointment for ${town}, ${state}.`
  return `Uploaded document on file for ${firm}.`
}

// Builds a real single-page PDF from the document's extracted data — rows that were actually
// extracted for a lead field (e.g. GSTIN) are drawn with a highlight box behind them, so opening
// the raw document itself shows what was pulled from it, not just the on-screen Source panel.
export function docPdf(ext: Extraction, doc: RequiredDoc): Blob {
  const highlightKeys = new Set(fieldsFromDoc(ext, doc).map((label) => focusRowKey(label)).filter((k): k is string => !!k))
  return buildPdf([
    { text: 'Acme Distribution Partner Platform - Document on file', size: 9, gap: 18 },
    { text: doc.name, size: 18, bold: true, gap: 30 },
    { text: docIssuer(doc.name), size: 10.5, gap: 18 },
    ...sourceRowsFor(ext, doc).map((r): PdfLine => ({ text: `${r.k}:   ${r.v}`, size: 11, gap: 20, highlight: highlightKeys.has(r.k) })),
    { text: ' ', gap: 12 },
    ...wrapText(docBodyText(ext, doc)).map((t): PdfLine => ({ text: t, size: 10.5, gap: 16 })),
    { text: ' ', gap: 20 },
    { text: 'Generated preview PDF - prototype stand-in for the actual scan.', size: 8.5 },
  ])
}

export function downloadDoc(ext: Extraction, doc: RequiredDoc) {
  const url = URL.createObjectURL(docPdf(ext, doc))
  const a = document.createElement('a')
  a.href = url
  a.download = doc.file ?? `${doc.name.replace(/\s+/g, '_')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// "View" opens the generated PDF in a new browser tab (native PDF viewer).
export const openDocPreview = (ext: Extraction, doc: RequiredDoc) => openPdfInNewTab(docPdf(ext, doc))

export const findDoc = (docs: RequiredDoc[], name: string) => docs.find((d) => d.name === name && d.received)

// Which document (if any) backs a field's value — the recovered-from doc first, and for GST
// Number specifically, the GST Certificate whenever it's on file (even if the number itself
// came from the email, it's still checkable against the attached certificate).
export function sourceDocFor(docs: RequiredDoc[], f: ExtractedField & { recoveredFrom?: string }) {
  return (f.recoveredFrom && findDoc(docs, f.recoveredFrom)) || (f.label === 'GST Number' ? findDoc(docs, 'GST Certificate') : undefined)
}

// The reverse lookup — every field label actually extracted from a given document, so that
// document's own "View" action can highlight exactly what was pulled from it (e.g. the GST
// Certificate highlights "GSTIN" because GST Number was recovered from it), instead of only
// highlighting when the user got there by clicking the field first.
export function fieldsFromDoc(ext: Extraction, doc: RequiredDoc): string[] {
  const docs = ext.documents ?? []
  return mergedFields(ext)
    .filter((f) => f.ok && sourceDocFor(docs, f)?.name === doc.name)
    .map((f) => f.label)
}
