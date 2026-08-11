// Lead Generation Agent — coverage / turnover opportunities by area, grounded in
// the workbook's actual fields (Acme planned coverage, expected Acme turnover,
// WS contribution %, DB category, outlet counts). No invented product SKUs.

export interface MatchedDistributor {
  agency: string
  dbCategory: 'GT DB (with CSO/DSM)' | 'GM Excl DB' | 'Traders'
  status: 'Active' | 'In review'
  monthlyTurnover: string   // ₹L (total firm)
  acmeTurnover: string      // ₹L/mo to Acme
  coverage: string          // outlets covered
  wsContribution: string    // wholesale contribution %
  headroom: 'high' | 'some' | 'none'
  note: string
}

export type GapType = 'Coverage gap' | 'Turnover gap' | 'Whitespace'

export interface Lead {
  id: string
  town: string
  state: string
  gapType: GapType
  signal: string            // planned vs actual, from workbook fields
  gapPct: number
  confidence: number
  matched: MatchedDistributor[]
  action: string
}

export const LEADS: Lead[] = [
  {
    id: 'LD-108', town: 'Nashik City', state: 'MH', gapType: 'Coverage gap',
    signal: 'Acme planned coverage 1,200 outlets; only ~620 active (−48%). WS contribution here below the 50% benchmark.',
    gapPct: 48, confidence: 88,
    matched: [
      { agency: 'Godavari Traders', dbCategory: 'Traders', status: 'Active', monthlyTurnover: '₹150L', acmeTurnover: '₹22L', coverage: '900 OL', wsContribution: '42%', headroom: 'high', note: 'Strong Nashik reach, coverage below its outlet base — headroom to extend the beat.' },
      { agency: 'Suvarna Agencies', dbCategory: 'GT DB (with CSO/DSM)', status: 'In review', monthlyTurnover: '₹200L', acmeTurnover: '₹41L', coverage: '1,200 planned', wsContribution: '50%', headroom: 'high', note: 'Onboarding; planned coverage 1,200 OL — activates most of the gap once live.' },
    ],
    action: 'Fast-track Suvarna Agencies (covers 1,200 planned OL) and extend Godavari Traders\' beat to close the remaining Nashik City gap.',
  },
  {
    id: 'LD-112', town: 'Aurangabad', state: 'MH', gapType: 'Turnover gap',
    signal: 'Expected Acme turnover ₹32L/mo vs ₹18L actual at the sole active DB (−44%). Acme contribution to his business only 11%.',
    gapPct: 44, confidence: 79,
    matched: [
      { agency: 'Deshmukh Enterprises', dbCategory: 'GM Excl DB', status: 'Active', monthlyTurnover: '₹120L', acmeTurnover: '₹18L', coverage: '780 OL', wsContribution: '38%', headroom: 'some', note: 'Under-indexing on Acme vs his overall turnover — a share-of-business opportunity.' },
    ],
    action: 'Raise Acme share-of-business with Deshmukh Enterprises via a coverage & credit plan; consider an additional DB if turnover stays flat.',
  },
  {
    id: 'LD-119', town: 'West Mumbai', state: 'MH', gapType: 'Whitespace',
    signal: 'Acme planned 6 DBs, 5 active; one sub-area has 0 Acme-covered outlets though 3 GT DBs operate there.',
    gapPct: 100, confidence: 74,
    matched: [
      { agency: 'Andheri General Stores', dbCategory: 'GT DB (with CSO/DSM)', status: 'Active', monthlyTurnover: '₹260L', acmeTurnover: '₹36L', coverage: '1,400 OL', wsContribution: '48%', headroom: 'high', note: 'Widest outlet reach in West Mumbai — best anchor for the whitespace sub-area.' },
      { agency: 'Juhu Distributors', dbCategory: 'GT DB (with CSO/DSM)', status: 'Active', monthlyTurnover: '₹200L', acmeTurnover: '₹28L', coverage: '1,050 OL', wsContribution: '45%', headroom: 'some', note: 'Good modern-trade links; can absorb the adjacent beat.' },
    ],
    action: 'Extend Andheri General Stores into the uncovered sub-area as the anchor DB before appointing an additional one.',
  },
]

export const LEADS_INSIGHT =
  'Lead Generation Agent surfaced 3 coverage & turnover opportunities this week — biggest is Nashik City (48% below its 1,200-outlet plan). All map to distributors already active in the area.'
