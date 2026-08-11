import type { CaseMessage } from '../types'

export interface Thread {
  code: string
  town: string
  partnerName: string
  audience: 'internal' | 'partner' // internal team discussion vs an outbound nudge/email to the partner
  participants: CaseMessage[]
  last: string
}

// Ties back into the same demo cases used in Approvals, so opening a thread here tells
// a consistent story with the case it belongs to.
export const INITIAL_THREADS: Thread[] = [
  { // CMP-2291 — Malhotra Distributors, flagged to Finance, overdue
    code: 'CMP-2291', town: 'Nashik', partnerName: 'Malhotra Distributors', audience: 'internal',
    participants: [
      { id: 'm1', authorRole: 'ase_asm', authorName: 'R. Malhotra', body: '3 other FMCG majors nearby, strong references from existing DBs.' },
      { id: 'm2', authorRole: 'finance', authorName: 'S. Iyer', body: 'CC limit is short of the ₹100L threshold. Need a top-up commitment in writing.', isNextReplier: true },
    ],
    last: 'CC limit is short of the ₹100L threshold. Need a top-up commitment in writing.',
  },
  { // CMP-2280 — Deccan Trade Links, flagged to Channel Development
    code: 'CMP-2280', town: 'Nagpur', partnerName: 'Deccan Trade Links', audience: 'internal',
    participants: [
      { id: 'x1', authorRole: 'ase_asm', authorName: 'R. Malhotra', body: 'Uploaded the revised godown proof — 5,200 sq ft now.' },
      { id: 'x2', authorRole: 'channel_dev', authorName: 'A. Deshpande', body: 'Thanks, reviewing infra score now — still short of the 7.0 threshold as things stand.', isNextReplier: true },
    ],
    last: 'Thanks, reviewing infra score now — still short of the 7.0 threshold as things stand.',
  },
  { // VND-0417 — Krishna Packaging, flagged to MDM for missing documents
    code: 'VND-0417', town: 'Vadodara', partnerName: 'Krishna Packaging', audience: 'internal',
    participants: [
      { id: 'y1', authorRole: 'ase_asm', authorName: 'R. Malhotra', body: 'Vendor confirms ISO 9001 is current — chasing them for the PAN copy and cancelled cheque now.' },
      { id: 'y2', authorRole: 'mdm', authorName: 'K. Nair', body: '2 of 6 required documents are still missing — can\'t clear the document check until PAN and Cancelled Cheque are in.', isNextReplier: true },
    ],
    last: '2 of 6 required documents are still missing — can\'t clear the document check until PAN and Cancelled Cheque are in.',
  },
  { // CMP-2265 — Surat Stockists, auto-cleared, quiet renewal-admin thread
    code: 'CMP-2265', town: 'Surat', partnerName: 'Surat Stockists', audience: 'internal',
    participants: [
      { id: 'z1', authorRole: 'ase_asm', authorName: 'R. Malhotra', body: 'Renewal packet sent for e-signature — auto-cleared case, just admin follow-up.' },
    ],
    last: 'Renewal packet sent for e-signature — auto-cleared case, just admin follow-up.',
  },
]
