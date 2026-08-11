import type { PartnerType, PartnerTypeCode } from '../types'

// Template Engine config: partner type -> required documents -> approval workflow.
// Adding a partner type is a new entry here, not a code change.
export const PARTNER_TYPES: PartnerType[] = [
  {
    code: 'distributor',
    label: 'Distributor (DB)',
    isActive: true,
    documents: ['GST Certificate', 'FSSAI License', 'Godown Proof', 'DB Onboarding Form'],
    workflow: [
      'Evaluation Agent',
      'Finance (if flagged)',
      'Channel Development (if flagged)',
      'Document Intelligence (optional)',
    ],
  },
  {
    code: 'vendor',
    label: 'Vendor / Service Partner',
    isActive: true, // configured & visible, but wizard deferred to Phase 2
    documents: ['GST', 'PAN', 'Cancelled Cheque', 'MSME', 'ISO 9001', 'Factory Audit Report'],
    workflow: ['Quality Review', 'Regulatory Check', 'Procurement ARC Match', 'MDM Document Check'],
  },
  {
    code: 'logistics',
    label: 'Logistics Partner',
    isActive: false, // "Coming soon"
    documents: ['GST', 'Fleet Registration', 'Insurance'],
    workflow: ['To be configured — reuses the same template engine'],
  },
  {
    code: 'copacker',
    label: 'Co-packer',
    isActive: false, // "Coming soon"
    documents: ['GST', 'ISO', 'Factory Audit', 'Manufacturing License'],
    workflow: ['Reuses the Vendor quality-audit workflow'],
  },
]

export const PARTNER_TYPE_BY_CODE: Record<PartnerTypeCode, PartnerType> = PARTNER_TYPES.reduce(
  (acc, t) => { acc[t.code] = t; return acc },
  {} as Record<PartnerTypeCode, PartnerType>,
)

/** Only Distributor has a fully-built wizard in this prototype. */
export const WIZARD_BUILT: Record<PartnerTypeCode, boolean> = {
  distributor: true,
  vendor: false,
  logistics: false,
  copacker: false,
}

/** Accent color per partner type (CSS values), reused across modules. */
export const PARTNER_TYPE_COLOR: Record<PartnerTypeCode, string> = {
  distributor: 'var(--p-finance)',
  vendor: 'var(--p-ase)',
  logistics: 'var(--p-channel)',
  copacker: 'var(--p-mdm)',
}

export const partnerTypeLabel = (code: PartnerTypeCode) => PARTNER_TYPE_BY_CODE[code].label
