// Rich data for the Distributor onboarding journey (New Application wizard).

export const REQUIRED_INVESTMENT = 144.6 // Rs L — Total Investment Required (from the workbook)

// REQUIRED_INVESTMENT carries a decimal, so subtracting a whole-number capital figure from it in
// plain JS floating point can land on e.g. 14.599999999999994 instead of 14.6 — every funding-gap
// calculation against it should round through this, not just its display.
export const round1 = (n: number) => Math.round(n * 10) / 10
export const INFRA_THRESHOLD = 7.0 // Channel Management Evaluation pass bar (avg infra score)
export const FIN_EVAL_PASS = 100 // % — Financial Evaluation passes when (own+CC)/required ≥ 100%
export const EXPECTED_ACME_TURNOVER = 41 // Rs L/month (DB1)
export const RBL_APPROVAL_THRESHOLD = 50 // Rs L — > this ⇒ RBL approval, else SM approval

// Actual DB-type taxonomy from the workbook dropdown (resolves GT/GM/Trader).
export const DB_TYPES = ['GT DB (with CSO/DSM)', 'GM Excl DB', 'Traders'] as const
export type DbCategory = typeof DB_TYPES[number]

export const approvalAuthority = (expectedAcmeTurnover: number) =>
  expectedAcmeTurnover > RBL_APPROVAL_THRESHOLD ? 'RBL' : 'SM'

export interface BackgroundRow { field: string; db1: string; db2: string; db3: string }
export const BACKGROUND: BackgroundRow[] = [
  { field: 'Agency / Firm name', db1: 'Suvarna Agencies', db2: 'Om Sai Distributors', db3: 'Krishna Trading Co.' },
  { field: 'Companies handled', db1: 'Britannia, Marico, ITC', db2: 'Dabur, Emami', db3: 'Parle, Nestlé' },
  { field: 'Agency since (years)', db1: '8', db2: '5', db3: '3' },
  { field: 'Total monthly turnover (₹L)', db1: '200', db2: '168', db3: '140' },
  { field: 'Expected Acme turnover/mo (₹L)', db1: '41', db2: '32', db3: '28' },
  { field: 'Acme contribution to business', db1: '21%', db2: '19%', db3: '20%' },
  { field: 'Overall coverage (total OL)', db1: '2,400', db2: '1,800', db3: '1,500' },
  { field: 'WS contribution % to business', db1: '50%', db2: '42%', db3: '38%' },
  { field: 'Acme planned coverage', db1: '1,200', db2: '960', db3: '800' },
]

// The 8 infrastructure factors scored per candidate, in the workbook's order.
export const INFRA_FACTORS: { key: string; label: string }[] = [
  { key: 'salesmen', label: 'Salesmen & delivery' },
  { key: 'delivery', label: 'Delivery units' },
  { key: 'godown', label: 'Godown with required space' },
  { key: 'computer', label: 'Computer / operator availability' },
  { key: 'reputation', label: 'Reputation in the marketplace' },
  { key: 'coverage', label: 'Coverage of outlets regularly' },
  { key: 'credit', label: 'Extending credit to the market' },
  { key: 'involvement', label: 'Degree of personal involvement' },
]
export type InfraState = Record<string, number>
export const DEFAULT_INFRA: InfraState = { salesmen: 8, delivery: 8, godown: 8, computer: 8, reputation: 8, coverage: 8, credit: 8, involvement: 8 }
export const meanInfra = (o: InfraState) => {
  const vals = Object.values(o)
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}

export interface RecRow { criteria: string; db1: string; db2: string; db3: string; ideal: string }
export const REC_COMPARISON: RecRow[] = [
  { criteria: 'Monthly turnover (₹L)', db1: '200', db2: '168', db3: '140', ideal: '220' },
  { criteria: 'Coverage (outlets)', db1: '1,200', db2: '960', db3: '800', ideal: '1,200' },
  { criteria: 'Infrastructure score', db1: '8.0', db2: '6.5', db3: '7.0', ideal: '10.0' },
]

// Reference-only figures for the non-selected candidates.
export const DB2_REF = { infra: 6.5, ownFunds: 85, ccLimit: 55, finEval: 97 }
export const DB3_REF = { infra: 7.0, ownFunds: 70, ccLimit: 50, finEval: 83 }

export interface DiscRow { label: string; value: string }
// Mirrors the workbook's "DB Discontinuation Form".
export const DISCONTINUATION: DiscRow[] = [
  { label: 'Name, address & DB code', value: 'Ramesh Distributors · DB-1187 · Nashik' },
  { label: 'Date of appointment', value: '14 Mar 2022' },
  { label: 'Major towns covered', value: 'Nashik, Chalisgaon' },
  { label: 'Handles other companies?', value: 'Yes — Britannia, Adani Wilmar (competes in edible oil)' },
  { label: 'Sales history — FY24 avg/mo (₹L)', value: '1.6' },
  { label: 'Sales history — FY25 avg/mo (₹L)', value: '0.9  ▼ declining' },
  { label: 'Reason for discontinuation', value: 'Poor coverage & poor retailer relations' },
  { label: 'Stock value as on date (₹L)', value: '2.1' },
  { label: 'Action planned', value: 'Transferred to new distributor' },
  { label: 'NDC submitted?', value: 'Yes — till Jun 2026' },
]

// Termination / discontinuation reason dropdown (workbook "Do not delete" sheet).
export const DISC_REASONS = ['Insufficient funds', 'Poor coverage', 'Poor relation with retailers & poor service', 'Area split & appointment of additional DB', 'Others (please specify)']

export const CANDIDATE = { name: 'Suvarna Agencies', town: 'Nashik', outletsPlanned: 1200 }
