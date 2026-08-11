// Intake data — shared by the Intake Inbox list and the standalone Intake Review page,
// so opening a mail in a new tab (its own /intake/:id route) can reconstruct from the id.
import type { ApplicationSubtype, DisengagementForm } from '../types'

export type IntakeChannel = 'email' | 'document'

export interface ExtractedField { label: string; value: string; ok: boolean }
// dataUrl is the real uploaded file's own bytes (base64) — set when someone actually attaches
// or replaces a document from Intake Review, so it survives a page reload (see
// store.ts's intakeDocOverrides) instead of only living in that component's local state.
export interface RequiredDoc { name: string; received: boolean; file?: string; detail?: string; dataUrl?: string }

export type IntakePriority = 'high' | 'normal' | 'low'

export interface Extraction {
  id: string
  channel: IntakeChannel
  source: string          // from-email or file name
  title: string           // subject / description
  receivedAt: string      // "2 min ago"
  receivedFull?: string   // absolute timestamp, e.g. "5 Jul 2026, 11:58 AM"
  confidencePct?: number  // extraction confidence
  fields: ExtractedField[]
  candidates?: { name: string; town: string }[]
  documents?: RequiredDoc[]
  duplicate?: string       // possible-duplicate note
  flags?: string[]
  partnerType?: 'distributor' | 'vendor'
  raw?: string             // raw email/file body
  // richer intake metadata surfaced in the inbox + review
  priority?: IntakePriority
  region?: string          // "Nashik, MH"
  assignedTo?: string      // owning ASE, e.g. "R. Malhotra (ASE)"
  attachments?: string[]   // file names that came in with the intake
  summary?: string         // Intake Agent's one-line read of the item
  // fields Document Intelligence recovered from an attached document that the email itself was missing
  docExtracted?: { label: string; value: string; from: string }[]
  // Set directly (not parsed back out of `fields`) by the Create Lead form's New DB Type
  // dropdown — 'replacement'/'additional' carry oldDbCode/additionalReason alongside them.
  subtype?: ApplicationSubtype
  oldDbCode?: string
  oldDbName?: string
  additionalReason?: string
  // Filled in at Create Lead time when subtype is 'replacement' — see CandidateCard's own doc
  // comment for why this pre-clears the Discontinuation Form gate downstream.
  discontinuationForm?: DisengagementForm
}

// EXTRACTIONS resets to its base seed on every full page reload — this re-applies whatever
// documents were actually uploaded/replaced in a prior visit (persisted in the zustand store's
// intakeDocOverrides) so a refresh doesn't silently discard them. Mutates ext.documents in place.
export function applyDocOverrides(ext: Extraction, overridesForExt: Record<string, RequiredDoc> | undefined): void {
  if (!overridesForExt || !ext.documents) return
  ext.documents = ext.documents.map((d) => overridesForExt[d.name] ?? d)
}

export const DOC_DETAIL: Record<string, string> = {
  'GST Certificate': 'GSTIN registration certificate, issued by the GST department.',
  'FSSAI License': 'Food safety license for the warehouse/premises.',
  'Godown Proof': 'Warehouse lease or ownership proof.',
  'DB Onboarding Form': 'Signed distributor onboarding form.',
  'ISO 9001': 'Quality management system certification.',
  'Factory Audit Report': 'Third-party factory audit report.',
  GST: 'GSTIN registration certificate.',
  PAN: 'PAN card copy.',
  MSME: 'MSME (Udyam) registration certificate.',
}

export const REQUIRED_DOCS = ['GST Certificate', 'FSSAI License', 'Godown Proof', 'DB Onboarding Form']
export const TEMPLATE_HEADERS = ['Firm / Agency Name', 'Contact Person', 'Phone Number', 'Email Address', 'Town', 'State', 'DB Type Requested', 'Turnover Claim (Rs L/mo)', 'GST Number']
export const TEMPLATE_SAMPLE = ['Suvarna Agencies', 'Mr. R. Suvarnkar', '+91 98230 12345', 'suvarna.agencies@example.com', 'Nashik', 'Maharashtra', 'GT DB (with CSO/DSM)', '200', '27ABCPD1234K1Z5']

export const EXTRACTIONS: Record<string, Extraction> = {
  // Flagship demo partner — a complete enquiry: every field captured, all documents received.
  'email-konkan': {
    id: 'email-konkan', channel: 'email', source: 'konkan.trade@gmail.com', receivedAt: '5 min ago', receivedFull: '6 Jul 2026, 10:12 AM', confidencePct: 100,
    title: 'Distributor appointment request — Konkan Trade Agencies, Pune',
    priority: 'high', region: 'Pune, MH', assignedTo: 'R. Malhotra (ASE)',
    attachments: ['GST_Konkan.pdf', 'FSSAI_Konkan.pdf', 'Godown_Konkan.pdf', 'DB_Form_Konkan.pdf'],
    summary: 'Established Pune distributor (₹210L/mo, 1,800 outlets) requesting the Acme Distribution Staples GT DB — all four required documents attached, every field captured.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Konkan Trade Agencies', ok: true },
      { label: 'Contact Person', value: 'Mr. S. Kadam', ok: true },
      { label: 'Phone Number', value: '+91 98765 43210', ok: true },
      { label: 'Email Address', value: 'konkan.trade@gmail.com', ok: true },
      { label: 'Town / City', value: 'Pune', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹210L', ok: true },
      { label: 'GST Number', value: '27ABCPK5678R1Z3', ok: true },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Konkan.pdf' },
      { name: 'FSSAI License', received: true, file: 'FSSAI_Konkan.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Konkan.pdf' },
      { name: 'DB Onboarding Form', received: true, file: 'DB_Form_Konkan.pdf' },
    ],
    raw: 'Dear Acme Distribution Channel team, Konkan Trade Agencies has distributed FMCG brands (Britannia, Parle, Dabur) across Pune for 11 years, servicing ~1,800 outlets with ₹210L monthly turnover. We would like to be appointed as the Acme Distribution Staples distributor for Pune city (GT DB with CSO/DSM). GST 27ABCPK5678R1Z3. All documents — GST, FSSAI, godown proof and the signed onboarding form — are attached. Regards, S. Kadam.',
  },
  'email-suvarna': {
    id: 'email-suvarna', channel: 'email', source: 'suvarna.agencies@gmail.com', receivedAt: '2 min ago', receivedFull: '5 Jul 2026, 11:58 AM', confidencePct: 91,
    title: 'Interested in becoming an Acme Distribution distributor — Nashik',
    priority: 'high', region: 'Nashik, MH', assignedTo: 'R. Malhotra (ASE)', attachments: ['GST_Suvarna_Agencies.pdf', 'DB_Form_Suvarna_Agencies.pdf'],
    summary: 'Established Nashik FMCG distributor (₹200L/mo, handles Britannia/Marico/ITC) wants the Staples portfolio — GST + onboarding form attached, godown proof still missing.',
    docExtracted: [{ label: 'GST Number', value: '27ABCPD1234K1Z5', from: 'GST Certificate' }],
    fields: [
      { label: 'Firm / Agency Name', value: 'Suvarna Agencies', ok: true },
      { label: 'Contact Person', value: 'Mr. R. Suvarnkar', ok: true },
      { label: 'Phone Number', value: '+91 98230 XXXXX', ok: true },
      { label: 'Email Address', value: 'suvarna.agencies@gmail.com', ok: true },
      { label: 'Town / City', value: 'Nashik', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹200L', ok: true },
      { label: 'GST Number', value: 'Not provided', ok: false },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Suvarna_Agencies.pdf' },
      { name: 'DB Onboarding Form', received: true, file: 'DB_Form_Suvarna_Agencies.pdf' },
      { name: 'Godown Proof', received: false },
      { name: 'FSSAI License', received: false },
    ],
    duplicate: 'An existing DB record with a similar name is already active in Nashik.',
    raw: 'Dear Acme Distribution team, We are Suvarna Agencies, an established FMCG distributor in Nashik handling Britannia, Marico and ITC. We are keen to take on the Acme Distribution Staples portfolio for Nashik city. Our monthly turnover is ~₹200L. Please find our GST certificate and onboarding form attached. Regards, R. Suvarnkar.',
  },
  'email-chalisgaon': {
    id: 'email-chalisgaon', channel: 'email', source: 'rmalhotra@acme-field.in', receivedAt: '15 min ago', receivedFull: '5 Jul 2026, 11:45 AM', confidencePct: 64,
    title: 'Fwd: New distributor lead — Chalisgaon',
    priority: 'normal', region: 'Chalisgaon, MH', assignedTo: 'R. Malhotra (ASE)', attachments: ['Chalisgaon_note.pdf'],
    summary: 'Forwarded field lead — a prospective Chalisgaon distributor, but the firm name, phone, turnover and GST are all missing from the original mail.',
    docExtracted: [
      { label: 'Firm / Agency Name', value: 'Deshpande Traders', from: 'DB Onboarding Form' },
      { label: 'Phone Number', value: '+91 94210 55231', from: 'DB Onboarding Form' },
      { label: 'Turnover Claim (₹/mo)', value: '₹95L', from: 'DB Onboarding Form' },
    ],
    fields: [
      { label: 'Firm / Agency Name', value: 'Not stated in the email', ok: false },
      { label: 'Contact Person', value: 'R. Malhotra (ASM, forwarding)', ok: true },
      { label: 'Phone Number', value: 'Not provided', ok: false },
      { label: 'Email Address', value: 'rmalhotra@acme-field.in', ok: true },
      { label: 'Town / City', value: 'Chalisgaon', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'General Trade (inferred)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: 'Not provided', ok: false },
      { label: 'GST Number', value: 'Not provided', ok: false },
    ],
    documents: [
      { name: 'DB Onboarding Form', received: true, file: 'Chalisgaon_note.pdf' },
      { name: 'GST Certificate', received: false },
      { name: 'Godown Proof', received: false },
      { name: 'FSSAI License', received: false },
    ],
    flags: ['Low-confidence extraction — this is a forwarded email, several fields are missing from the original.'],
    raw: 'Forwarding a lead from the field — a prospective distributor in Chalisgaon interested in Acme Distribution. Details to follow. — R. Malhotra',
  },
  'email-godavari': {
    id: 'email-godavari', channel: 'email', source: 'godavari.traders@gmail.com', receivedAt: '32 min ago', receivedFull: '5 Jul 2026, 11:28 AM', confidencePct: 100,
    title: 'Godavari Traders — expanding beat coverage in Nashik Rural',
    priority: 'normal', region: 'Nashik Rural, MH', assignedTo: 'R. Malhotra (ASE)', attachments: ['GST_Godavari.pdf', 'FSSAI_Godavari.pdf', 'Godown_Godavari.pdf', 'DB_Form_Godavari.pdf'],
    summary: 'Existing beat partner wants to expand into Nashik Rural — every required field and all four documents are present, clean auto-extract.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Godavari Traders', ok: true },
      { label: 'Contact Person', value: 'Mr. V. Godavari', ok: true },
      { label: 'Phone Number', value: '+91 98220 55410', ok: true },
      { label: 'Email Address', value: 'godavari.traders@gmail.com', ok: true },
      { label: 'Town / City', value: 'Nashik Rural', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GM Excl DB', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹130L', ok: true },
      { label: 'GST Number', value: '27AABCG4321L1Z8', ok: true },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Godavari.pdf' },
      { name: 'FSSAI License', received: true, file: 'FSSAI_Godavari.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Godavari.pdf' },
      { name: 'DB Onboarding Form', received: true, file: 'DB_Form_Godavari.pdf' },
    ],
    raw: 'Hello, Godavari Traders would like to expand our Acme Distribution beat into Nashik Rural. All documents attached. Turnover ₹130L/mo. — V. Godavari',
  },
  'email-deccan': {
    id: 'email-deccan', channel: 'email', source: 'contact@deccantradelinks.com', receivedAt: '2 hr ago', receivedFull: '5 Jul 2026, 09:40 AM', confidencePct: 88,
    title: 'Distributor application — Deccan Trade Links, Nagpur',
    priority: 'high', region: 'Nagpur, MH', assignedTo: 'K. Bhosale (ASE)', attachments: ['GST_Deccan.pdf', 'PAN_Deccan.pdf', 'Godown_Deccan_Nagpur.pdf'],
    summary: 'Multi-brand Nagpur distributor (₹175L/mo, 1,900 outlets) applying for a new GT DB — strong docs, FSSAI license still to come.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Deccan Trade Links', ok: true },
      { label: 'Contact Person', value: 'Mr. A. Deshpande', ok: true },
      { label: 'Phone Number', value: '+91 91300 22841', ok: true },
      { label: 'Email Address', value: 'contact@deccantradelinks.com', ok: true },
      { label: 'Town / City', value: 'Nagpur', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹175L', ok: true },
      { label: 'GST Number', value: '27AADCD7890Q1Z4', ok: true },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Deccan.pdf' },
      { name: 'DB Onboarding Form', received: true, file: 'PAN_Deccan.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Deccan_Nagpur.pdf' },
      { name: 'FSSAI License', received: false },
    ],
    raw: 'Dear Acme Distribution, Deccan Trade Links has distributed for 3 FMCG majors across Vidarbha for 12 years. We would like to be appointed for Acme Distribution Staples in Nagpur. Turnover ₹175L/mo across 1,900 outlets. GST, PAN and godown papers attached. Regards, A. Deshpande.',
  },
  'email-sunrise': {
    id: 'email-sunrise', channel: 'email', source: 'sunrise.agencies@rediffmail.com', receivedAt: '3 hr ago', receivedFull: '5 Jul 2026, 08:30 AM', confidencePct: 82,
    title: 'Acme Distribution distributorship enquiry — Pune West',
    priority: 'normal', region: 'Pune, MH', assignedTo: 'Unassigned', attachments: ['GST_Sunrise.pdf'],
    summary: 'Pune West grocery distributor keen on Acme Distribution; turnover claim looks solid but contact phone and godown proof are missing.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Sunrise Agencies', ok: true },
      { label: 'Contact Person', value: 'Mr. P. Joshi', ok: true },
      { label: 'Phone Number', value: 'Not provided', ok: false },
      { label: 'Email Address', value: 'sunrise.agencies@rediffmail.com', ok: true },
      { label: 'Town / City', value: 'Pune', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹160L', ok: true },
      { label: 'GST Number', value: '27AAFCS3456P1Z9', ok: true },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Sunrise.pdf' },
      { name: 'DB Onboarding Form', received: false },
      { name: 'Godown Proof', received: false },
      { name: 'FSSAI License', received: false },
    ],
    raw: 'Hi, Sunrise Agencies covers Pune West with ~1,200 outlets and ₹160L monthly turnover. We are interested in Acme Distribution Staples. GST attached; onboarding form to follow. — P. Joshi',
  },
  'email-metro': {
    id: 'email-metro', channel: 'email', source: 'md@metrotradecombines.in', receivedAt: '5 hr ago', receivedFull: '5 Jul 2026, 06:50 AM', confidencePct: 95,
    title: 'Appointment request — Metro Trade Combines, Mumbai',
    priority: 'high', region: 'Mumbai, MH', assignedTo: 'K. Bhosale (ASE)', attachments: ['GST_Metro.pdf', 'FSSAI_Metro.pdf', 'Godown_Metro.pdf', 'DB_Form_Metro.pdf'],
    summary: 'Large Mumbai distributor (₹240L/mo, 2,600 outlets) with a complete, high-confidence submission — strong candidate to fast-track.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Metro Trade Combines', ok: true },
      { label: 'Contact Person', value: 'Ms. N. Shetty', ok: true },
      { label: 'Phone Number', value: '+91 98200 71145', ok: true },
      { label: 'Email Address', value: 'md@metrotradecombines.in', ok: true },
      { label: 'Town / City', value: 'Mumbai', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹240L', ok: true },
      { label: 'GST Number', value: '27AALCJ8901U1Z2', ok: true },
    ],
    documents: [
      { name: 'GST Certificate', received: true, file: 'GST_Metro.pdf' },
      { name: 'FSSAI License', received: true, file: 'FSSAI_Metro.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Metro.pdf' },
      { name: 'DB Onboarding Form', received: true, file: 'DB_Form_Metro.pdf' },
    ],
    raw: 'Dear Acme Distribution Channel team, Metro Trade Combines services 2,600 outlets across Mumbai suburbs with ₹240L monthly turnover. We request appointment as Acme Distribution Staples distributor. Full documentation attached. Regards, N. Shetty, MD.',
  },
  'email-precisionpack': {
    id: 'email-precisionpack', channel: 'email', source: 'sales@precisionpack.co.in', receivedAt: '1 hr ago', receivedFull: '5 Jul 2026, 10:55 AM', confidencePct: 71, partnerType: 'vendor',
    title: 'Vendor inquiry — packaging materials supplier',
    priority: 'normal', region: 'Vadodara, GJ', assignedTo: 'Unassigned', attachments: ['ISO9001_PrecisionPack.pdf'],
    summary: 'Corrugated-packaging supplier wants vendor empanelment — routes to the Vendor template; GST and PAN not yet provided.',
    fields: [
      { label: 'Firm / Agency Name', value: 'PrecisionPack Industries', ok: true },
      { label: 'Contact Person', value: 'A. Kulkarni', ok: true },
      { label: 'Phone Number', value: '+91 99870 XXXXX', ok: true },
      { label: 'Email Address', value: 'sales@precisionpack.co.in', ok: true },
      { label: 'Town / City', value: 'Vadodara', ok: true },
      { label: 'State', value: 'Gujarat', ok: true },
      { label: 'DB Type Requested', value: 'Not applicable (Vendor)', ok: false },
      { label: 'Turnover Claim (₹/mo)', value: 'Not provided', ok: false },
      { label: 'GST Number', value: 'Not provided', ok: false },
    ],
    documents: [
      { name: 'ISO 9001', received: true, file: 'ISO9001_PrecisionPack.pdf' },
      { name: 'GST', received: false },
      { name: 'PAN', received: false },
    ],
    flags: ['Vendor-type inquiry — routes to the Vendor template, not Distributor. Quality Review + Procurement ARC match apply.'],
    raw: 'We supply corrugated packaging and would like to be an Acme Distribution vendor. ISO 9001 attached. — PrecisionPack Sales',
  },
  'email-ganesh': {
    id: 'email-ganesh', channel: 'email', source: 'ganesh.distributors@gmail.com', receivedAt: 'Yesterday', receivedFull: '4 Jul 2026, 05:10 PM', confidencePct: 76,
    title: 'Replacement distributor proposal — Kolhapur',
    priority: 'normal', region: 'Kolhapur, MH', assignedTo: 'K. Bhosale (ASE)', attachments: ['GST_Ganesh.pdf', 'DB_Form_Ganesh.pdf'],
    summary: 'Kolhapur firm offering to take over a discontinued beat — replacement case, so the outgoing DB discontinuation form will be required downstream.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Ganpati Distributors', ok: true },
      { label: 'Contact Person', value: 'Mr. S. Patil', ok: true },
      { label: 'Phone Number', value: '+91 90110 33420', ok: true },
      { label: 'Email Address', value: 'ganesh.distributors@gmail.com', ok: true },
      { label: 'Town / City', value: 'Kolhapur', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'Replacement DB', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹110L', ok: true },
      { label: 'GST Number', value: 'Not provided', ok: false },
    ],
    documents: [
      { name: 'GST Certificate', received: false },
      { name: 'DB Onboarding Form', received: true, file: 'DB_Form_Ganesh.pdf' },
      { name: 'Godown Proof', received: false },
      { name: 'FSSAI License', received: false },
    ],
    flags: ['Replacement DB — the outgoing distributor\'s Discontinuation Form is required before this can clear.'],
    raw: 'Respected sir, We understand the current Acme Distribution distributor in Kolhapur is being discontinued. Ganpati Distributors would like to be considered as the replacement. Turnover ₹110L/mo. Onboarding form attached, GST to follow. — S. Patil',
  },
  'email-andheri': {
    id: 'email-andheri', channel: 'email', source: 'andheri.genstores@gmail.com', receivedAt: 'Yesterday', receivedFull: '4 Jul 2026, 02:20 PM', confidencePct: 58,
    title: 'Additional beat request — Andheri, Mumbai',
    priority: 'low', region: 'Mumbai, MH', assignedTo: 'Unassigned',
    summary: 'Very short enquiry with almost no detail — only firm name and town could be read; needs a full information request before it can progress.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Andheri General Stores', ok: true },
      { label: 'Contact Person', value: 'Not provided', ok: false },
      { label: 'Phone Number', value: 'Not provided', ok: false },
      { label: 'Email Address', value: 'andheri.genstores@gmail.com', ok: true },
      { label: 'Town / City', value: 'Andheri, Mumbai', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'Additional DB (inferred)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: 'Not provided', ok: false },
      { label: 'GST Number', value: 'Not provided', ok: false },
    ],
    documents: [
      { name: 'GST Certificate', received: false },
      { name: 'DB Onboarding Form', received: false },
      { name: 'Godown Proof', received: false },
      { name: 'FSSAI License', received: false },
    ],
    flags: ['Low-confidence — most fields missing. Request full details before creating a lead.'],
    raw: 'we want acme products for andheri area pls send details — thanks',
  },
  'doc-nashik': {
    id: 'doc-nashik', channel: 'document', source: 'Nashik_Candidates.xlsx', receivedAt: 'Today', receivedFull: '5 Jul 2026, 09:00 AM', title: 'Uploaded by R. Malhotra (ASM)',
    priority: 'normal', region: 'Nashik, MH', assignedTo: 'R. Malhotra (ASE)', attachments: ['Nashik_Candidates.xlsx'],
    summary: 'Bulk ASE upload — 3 Nashik candidates detected in the spreadsheet, ready to split into individual leads.',
    fields: [],
    candidates: [
      { name: 'Suvarna Agencies', town: 'Nashik City, MH' },
      { name: 'Godavari Traders (additional beat)', town: 'Nashik City, MH' },
      { name: 'Chandwad Distributors', town: 'Nashik Rural, MH' },
    ],
  },
  'doc-pune-batch': {
    id: 'doc-pune-batch', channel: 'document', source: 'Pune_Prospects.csv', receivedAt: '2 days ago', receivedFull: '3 Jul 2026, 10:00 AM', title: 'Uploaded by K. Bhosale (ASE)',
    priority: 'normal', region: 'Pune, MH', assignedTo: 'K. Bhosale (ASE)', attachments: ['Pune_Prospects.csv'],
    summary: 'Bulk upload from the Pune territory review — 3 prospects detected, one already exists as a lead (possible duplicate).',
    fields: [],
    candidates: [
      { name: 'Sunrise Agencies', town: 'Pune West, MH' },
      { name: 'Shivneri Traders', town: 'Pune City, MH' },
      { name: 'Sahyadri Distributors', town: 'Pimpri-Chinchwad, MH' },
    ],
    duplicate: 'Sunrise Agencies also arrived as an email enquiry — link the two before creating leads.',
  },
  'doc-recommendation': {
    id: 'doc-recommendation', channel: 'document', source: 'Recommendation_Form_signed.pdf', receivedAt: 'Yesterday', receivedFull: '4 Jul 2026, 04:15 PM', confidencePct: 71,
    title: 'ASE field submission (scanned form)',
    priority: 'normal', region: 'Chalisgaon, MH', assignedTo: 'R. Malhotra (ASE)', attachments: ['Recommendation_Form_signed.pdf', 'Godown_Deccan.pdf'],
    summary: 'Scanned handwritten recommendation form — most fields read, but DB type and GST number are illegible and need ASE confirmation.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Deccan General Stores', ok: true },
      { label: 'Contact Person', value: 'S. Deshpande', ok: true },
      { label: 'Phone Number', value: '+91 94220 XXXXX', ok: true },
      { label: 'Email Address', value: 'Not on form', ok: false },
      { label: 'Town / City', value: 'Chalisgaon', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'Illegible on scan', ok: false },
      { label: 'Turnover Claim (₹/mo)', value: '₹85L (handwritten)', ok: true },
      { label: 'GST Number', value: 'Illegible on scan', ok: false },
    ],
    documents: [
      { name: 'DB Onboarding Form', received: true, file: 'Recommendation_Form_signed.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Deccan.pdf' },
      { name: 'GST Certificate', received: false },
      { name: 'FSSAI License', received: false },
    ],
    flags: ['Scan quality is poor in two fields — confirm DB type and GST number with the ASE before proceeding.'],
  },
  'doc-vendor-audit': {
    id: 'doc-vendor-audit', channel: 'document', source: 'Factory_Audit_PrecisionPack.pdf', receivedAt: '2 days ago', receivedFull: '3 Jul 2026, 12:30 PM', confidencePct: 78, partnerType: 'vendor',
    title: 'Vendor factory audit — field submission',
    priority: 'high', region: 'Vadodara, GJ', assignedTo: 'Unassigned', attachments: ['ISO9001_PrecisionPack.pdf', 'Factory_Audit_PrecisionPack.pdf'],
    summary: 'Factory audit for PrecisionPack — same vendor as the earlier email inquiry; link the two to avoid a duplicate vendor record.',
    fields: [
      { label: 'Firm / Agency Name', value: 'PrecisionPack Industries', ok: true },
      { label: 'Contact Person', value: 'A. Kulkarni', ok: true },
      { label: 'Phone Number', value: '+91 99870 41200', ok: true },
      { label: 'Email Address', value: 'sales@precisionpack.co.in', ok: true },
      { label: 'Town / City', value: 'Vadodara', ok: true },
      { label: 'State', value: 'Gujarat', ok: true },
      { label: 'DB Type Requested', value: 'Not applicable (Vendor)', ok: false },
      { label: 'Turnover Claim (₹/mo)', value: '₹22L', ok: true },
      { label: 'GST Number', value: '24AABCP7890M1Z3', ok: true },
    ],
    documents: [
      { name: 'ISO 9001', received: true, file: 'ISO9001_PrecisionPack.pdf' },
      { name: 'Factory Audit Report', received: true, file: 'Factory_Audit_PrecisionPack.pdf' },
      { name: 'GST', received: false },
      { name: 'MSME', received: false },
    ],
    duplicate: 'Same vendor as the PrecisionPack email inquiry — link these before creating the lead.',
    flags: ['Same vendor as the PrecisionPack email inquiry — link these before creating the lead to avoid a duplicate.'],
  },
  'doc-deshmukh': {
    id: 'doc-deshmukh', channel: 'document', source: 'Deshmukh_Enterprises_form.pdf', receivedAt: '3 days ago', receivedFull: '2 Jul 2026, 03:45 PM', confidencePct: 84,
    title: 'Distributor onboarding form — Aurangabad',
    priority: 'normal', region: 'Aurangabad, MH', assignedTo: 'K. Bhosale (ASE)', attachments: ['Deshmukh_Enterprises_form.pdf', 'GST_Deshmukh.pdf'],
    summary: 'Cleanly-scanned onboarding form for an Aurangabad distributor — good extraction; FSSAI license is the only pending document.',
    fields: [
      { label: 'Firm / Agency Name', value: 'Deshmukh Enterprises', ok: true },
      { label: 'Contact Person', value: 'Mr. R. Deshmukh', ok: true },
      { label: 'Phone Number', value: '+91 93250 88120', ok: true },
      { label: 'Email Address', value: 'deshmukh.ent@gmail.com', ok: true },
      { label: 'Town / City', value: 'Aurangabad', ok: true },
      { label: 'State', value: 'Maharashtra', ok: true },
      { label: 'DB Type Requested', value: 'GT DB (with CSO/DSM)', ok: true },
      { label: 'Turnover Claim (₹/mo)', value: '₹145L', ok: true },
      { label: 'GST Number', value: '27AAHCD6789S1Z1', ok: true },
    ],
    documents: [
      { name: 'DB Onboarding Form', received: true, file: 'Deshmukh_Enterprises_form.pdf' },
      { name: 'GST Certificate', received: true, file: 'GST_Deshmukh.pdf' },
      { name: 'Godown Proof', received: true, file: 'Godown_Deshmukh.pdf' },
      { name: 'FSSAI License', received: false },
    ],
  },
}

export interface RecoveredField { label: string; value: string; from: string }

// Missing email fields that Document Intelligence recovered from an attached document.
export function recoveredFields(e: Extraction): RecoveredField[] {
  if (!e.docExtracted) return []
  const missing = new Set(e.fields.filter((f) => !f.ok).map((f) => f.label))
  return e.docExtracted.filter((d) => missing.has(d.label))
}

// The field list with recovered values merged in (now ok, tagged with where they came from).
export function mergedFields(e: Extraction): (ExtractedField & { recoveredFrom?: string })[] {
  const rec = new Map(recoveredFields(e).map((r) => [r.label, r]))
  return e.fields.map((f) => {
    const r = rec.get(f.label)
    return r ? { ...f, value: r.value, ok: true, recoveredFrom: r.from } : f
  })
}

// Counts are recovery-aware: a field pulled from a document counts as captured everywhere.
export const capturedCount = (e: Extraction) => mergedFields(e).filter((f) => f.ok).length
export const missingFieldLabels = (e: Extraction) => mergedFields(e).filter((f) => !f.ok).map((f) => f.label)

// Which firm/agency name an intake item resolves to — used to drop it from the inbox once a
// lead already exists under that name, even for an item never explicitly marked processed.
export const firmOfExtraction = (e: Extraction) =>
  (e.fields.find((f) => /firm|agency/i.test(f.label) && f.ok)?.value ?? e.source).toLowerCase()

// Live "still in the inbox" count — same two exclusions IntakeInbox.tsx applies (explicitly
// processed, or a lead already created under the same firm name) — shared so the sidebar badge
// (Shell.tsx) can never drift from what the screen itself actually lists.
export function unprocessedIntakeCount(processedIntakeIds: string[], createdLeadNames: Set<string>): number {
  return Object.values(EXTRACTIONS).filter(
    (e) => !processedIntakeIds.includes(e.id) && !createdLeadNames.has(firmOfExtraction(e)),
  ).length
}

export function downloadSampleTemplate() {
  const csv = [TEMPLATE_HEADERS.join(','), TEMPLATE_SAMPLE.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Acme_Candidate_Upload_Template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
