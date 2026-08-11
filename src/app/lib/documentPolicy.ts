// Acme Distribution's documented policy (Distributor Appointment process, Key Business Rules & Gates):
// "No verification of business-capacity claims. Turnover, godown size, vehicle count and
// similar fields are deliberately left as subjective, ASE/ASM-attested judgment calls —
// not a target for document verification, even where technically possible."
//
// Godown Proof is the one required document that exists purely to evidence a business-capacity
// claim (godown size) rather than a regulatory/compliance fact — so neither the Document
// Intelligence tamper scan nor MDM's manual verification should treat it as something to check.
// (Factory Audit Report is a different case — it's the vendor track's own QC deliverable per
// the Vendor Appointment process, not an unverified capacity claim, so it stays in scope.)
export const isBusinessCapacityDoc = (name: string) => /godown/i.test(name)

export const BUSINESS_CAPACITY_NOTE =
  'Not verified by policy — godown size is an ASE/ASM-attested business-capacity claim, not a document-check target.'
