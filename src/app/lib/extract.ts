// Rules/regex intake extractor — the "Intake Agent" with no AI. Given raw email text it
// pulls the standard fields, infers partner type/priority/region, and writes a summary
// composed entirely from what it extracted. Deterministic; swap for a Claude call later.
import type { ExtractedField } from '../mock/intake'

export interface ExtractResult {
  fields: ExtractedField[]
  summary: string
  partnerType: 'distributor' | 'vendor'
  priority: 'high' | 'normal' | 'low'
  region?: string
  confidencePct: number
  captured: number
}

const RX = {
  gst: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/,
  phone: /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  turnover: /₹?\s*(\d{2,4})\s*L\b/i,
}

const DB_KEYWORDS: [RegExp, string][] = [
  [/replacement/i, 'Replacement DB'],
  [/additional/i, 'Additional DB'],
  [/gm\s*excl/i, 'GM Excl DB'],
  [/\bgt\s*db\b|general trade/i, 'GT DB (with CSO/DSM)'],
  [/\btraders?\b/i, 'Traders'],
]
const STATES: [RegExp, string, string][] = [
  [/maharashtra|\bMH\b/i, 'Maharashtra', 'MH'],
  [/gujarat|\bGJ\b/i, 'Gujarat', 'GJ'],
  [/\bgoa\b|\bGA\b/i, 'Goa', 'GA'],
]
const TOWNS: [string, string][] = [
  ['Nashik Rural', 'MH'], ['Nashik', 'MH'], ['Pune', 'MH'], ['Mumbai', 'MH'], ['Nagpur', 'MH'],
  ['Aurangabad', 'MH'], ['Kolhapur', 'MH'], ['Chalisgaon', 'MH'], ['Andheri', 'MH'], ['Bhiwandi', 'MH'],
  ['Surat', 'GJ'], ['Vadodara', 'GJ'], ['Ahmedabad', 'GJ'], ['Panaji', 'GA'],
]
const VENDOR_RE = /\bvendor\b|packaging|supplier|supply|iso ?9001|factory audit|manufactur|corrugat/i

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

// Firm/agency name — try a few phrasings, then fall back to the email's domain/local part.
function firmName(body: string, source: string, subject: string): string | undefined {
  const pats = [
    /\bwe are ([A-Z][\w&.'\- ]{2,44}?)[,.]/,
    /\b([A-Z][\w&.'\- ]{2,44}?) (?:would like|services?|covers|is an|is a|handling|distributes|has )/,
    /\bfrom ([A-Z][\w&.'\- ]{2,44}?)[,.]/,
  ]
  for (const p of pats) {
    const m = body.match(p)
    if (m) return m[1].trim().replace(/\s+/g, ' ')
  }
  const em = (source.match(RX.email)?.[0] ?? source).split('@')[0]
  if (em && /[a-z]/i.test(em)) return titleCase(em.replace(/[._-]+/g, ' ').trim())
  const subj = subject.replace(/^(re|fwd):\s*/i, '').split(/[—\-–|:]/)[0].trim()
  return subj || undefined
}

function contactPerson(body: string): string | undefined {
  const honorific = body.match(/\b(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*[A-Z][.\s]*[A-Za-z]+/)
  if (honorific) return honorific[0].replace(/\s+/g, ' ').trim()
  const signoff = body.match(/(?:regards|thanks|sincerely|—|--)\s*,?\s*((?:[A-Z]\.\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[.!]?\s*$/im)
  if (signoff) return signoff[1].trim()
  return undefined
}

const SHORT: Record<string, string> = {
  'Firm / Agency Name': 'firm name', 'Contact Person': 'contact', 'Phone Number': 'phone',
  'Email Address': 'email', 'Town / City': 'town', State: 'state',
  'DB Type Requested': 'DB type', 'Turnover Claim (₹/mo)': 'turnover', 'GST Number': 'GST',
}

export function extractEmail(input: { source: string; title: string; body: string }): ExtractResult {
  const source = input.source ?? ''
  const subject = input.title ?? ''
  const body = `${subject}\n${input.body ?? ''}`
  const partnerType: 'distributor' | 'vendor' = VENDOR_RE.test(body) ? 'vendor' : 'distributor'

  // town + state
  const town = TOWNS.find(([t]) => new RegExp(`\\b${t}\\b`, 'i').test(body))
  const stateHit = STATES.find(([re]) => re.test(body)) ?? (town ? STATES.find(([, , c]) => c === town[1]) : undefined)

  const gst = body.match(RX.gst)?.[0]
  const phone = (input.body.match(RX.phone) ?? body.match(RX.phone))?.[0]
  const email = source.match(RX.email)?.[0] ?? body.match(RX.email)?.[0]
  const turnoverN = body.match(RX.turnover)?.[1]
  const dbType = DB_KEYWORDS.find(([re]) => re.test(body))?.[1]
  const firm = firmName(input.body ?? '', source, subject)
  const contact = contactPerson(input.body ?? '')

  const f = (label: string, value?: string): ExtractedField =>
    value ? { label, value, ok: true } : { label, value: 'Not found in the email', ok: false }

  const fields: ExtractedField[] = [
    f('Firm / Agency Name', firm),
    f('Contact Person', contact),
    f('Phone Number', phone?.replace(/\s+/g, ' ').trim()),
    f('Email Address', email),
    f('Town / City', town?.[0]),
    f('State', stateHit?.[1]),
    f('DB Type Requested', partnerType === 'vendor' ? 'Not applicable (Vendor)' : dbType),
    f('Turnover Claim (₹/mo)', turnoverN ? `₹${turnoverN}L` : undefined),
    f('GST Number', gst),
  ]

  const captured = fields.filter((x) => x.ok).length
  const confidencePct = Math.round((captured / fields.length) * 100)
  const missing = fields.filter((x) => !x.ok).map((x) => SHORT[x.label] ?? x.label.toLowerCase())

  const tnum = turnoverN ? parseInt(turnoverN, 10) : 0
  const priority: 'high' | 'normal' | 'low' =
    (dbType === 'Replacement DB' || tnum >= 200) ? 'high' : captured < 4 ? 'low' : 'normal'
  const region = town ? `${town[0]}, ${town[1]}` : stateHit ? stateHit[1] : undefined

  // Summary built entirely from the extracted data.
  let summary = firm ?? `A prospective ${partnerType}`
  if (town) summary += ` in ${town[0]}`
  if (partnerType === 'vendor') summary += ' (vendor enquiry)'
  else if (dbType) summary += ` — ${dbType}`
  if (turnoverN) summary += `, ~₹${turnoverN}L/mo`
  summary += `. ${captured}/${fields.length} fields extracted`
  summary += missing.length ? `; still missing ${missing.join(', ')}.` : ' — complete.'

  return { fields, summary, partnerType, priority, region, confidencePct, captured }
}
