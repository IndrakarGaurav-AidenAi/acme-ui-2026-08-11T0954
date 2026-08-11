// Field-for-field reproduction of Acme Distribution's "New DB Appointment Recommendation Form" workbook
// (New DB Appointment Module - RCPL v1.xlsb → "Appointment Recommendation Form" sheet),
// so the New Application intake mirrors the sheet exactly. Values are DB1's from the workbook.

export interface FormField {
  key: string
  label: string
  value: string
  kind?: 'text' | 'number'
  suffix?: string
  showWhen?: 'replacement' | 'additional' // conditional rows from the sheet
}

// § Basic Information  (rows 4–14)
export const BASIC_INFORMATION: FormField[] = [
  { key: 'sm_name', label: 'SM Name', value: 'D. Kulkarni' },
  { key: 'asm_name', label: 'ASM Name', value: 'R. Malhotra' },
  { key: 'ase_name', label: 'ASE Name', value: 'S. Pawar' },
  { key: 'state', label: 'State', value: 'Maharashtra' },
  { key: 'town', label: 'Town', value: 'Nashik' },
  // New DB Type + Application Type are rendered as the wired dropdowns (drive downstream logic).
  { key: 'additional_reason', label: 'If Additional DB, mention reason', value: 'New beat — GM Excl DB', showWhen: 'additional' },
  { key: 'old_db_code', label: 'If Replacement, mention OLD DB Code', value: 'DB-1187', showWhen: 'replacement' },
  { key: 'working_capital', label: 'Working Capital required for business', value: '144.6', kind: 'number', suffix: '₹L' },
]

// § Background Information  (rows 17–23)
export const BACKGROUND_INFORMATION: FormField[] = [
  { key: 'agency_name', label: 'Agency / Firm name', value: 'Suvarna Agencies' },
  { key: 'companies_handled', label: 'Companies Handled (name of companies)', value: 'Britannia, Marico, ITC' },
  { key: 'agency_since', label: 'Agency since (no. of years)', value: '8', kind: 'number' },
  { key: 'total_turnover', label: 'Total Monthly Turnover of the Firm', value: '200', kind: 'number', suffix: '₹L' },
  { key: 'expected_acme_turnover', label: 'Expected Acme Distribution turnover per month', value: '41', kind: 'number', suffix: '₹L' },
  { key: 'acme_contribution', label: 'Acme Distribution contribution to overall business', value: '20.5', kind: 'number', suffix: '%' },
  { key: 'phone', label: 'Phone Number', value: '+91 98230 12345' },
]

// § Coverage Data  (rows 25–27)
export const COVERAGE_DATA: FormField[] = [
  { key: 'overall_coverage', label: "Overall firm's coverage (all companies — total OL count)", value: '2400', kind: 'number' },
  { key: 'ws_contribution', label: 'WS contribution % to his business', value: '50', kind: 'number', suffix: '%' },
  { key: 'acme_planned_coverage', label: 'Acme Distribution Planned Coverage', value: '1200', kind: 'number' },
]

// § Financials — investment build-up  (rows 45–49). Own Funds & CC Limit are the scored
// sliders on the Evaluate step; these three roll up into Total Investment Required (₹144.6L).
export const FINANCIAL_BREAKDOWN: FormField[] = [
  { key: 'inventory_days', label: 'Inventory Days', value: '10', kind: 'number' },
  { key: 'mkt_credit', label: 'Mkt Credit', value: '7', kind: 'number' },
  { key: 'claims', label: 'Claims', value: '1', kind: 'number' },
]
export const TOTAL_INVESTMENT_REQUIRED = 144.6 // ₹L — matches REQUIRED_INVESTMENT in mock/onboarding
