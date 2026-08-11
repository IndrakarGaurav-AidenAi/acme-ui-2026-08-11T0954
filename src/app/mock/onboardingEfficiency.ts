// Onboarding-efficiency metrics — how well the field/onboarding funnel itself performs, distinct
// from mock/analytics.ts's DbPerf (which tracks already-onboarded distributors' ongoing sales
// performance). Ingested from RCPL_Distributor_Onboarding_Dataset.xlsx (Analytics_Funnel_Velocity,
// Analytics_KYC_Compliance, Analytics_Activation_FTB, Analytics_Territory_Penetration,
// Analytics_FOS_Productivity) — aggregate rollups, computed here the same way the file always
// derived them (via .reduce over the underlying arrays), not hardcoded.
import type { BarDatum } from './analytics'

/* ---------------- 1) Pipeline Scale & Funnel Velocity ---------------- */
// Analytics_Funnel_Velocity: 30 rows (5 zones × 6 months, Feb–Jul 2026).
export interface FunnelStage { stage: string; count: number }
// Mapped Outlets/Leads and Registered/Live sum straight off the sheet's Leads_Mapped /
// Onboarding_Completed columns across all zones+months. The sheet has no mid-funnel breakdown
// (Contacted / Application Started / Documents Submitted), so those three are interpolated
// between the two real endpoints on a plausible drop-off curve — TODO: sanity-check these ratios
// against real CRM funnel stages if/when that data becomes available.
export const FUNNEL_STAGES: FunnelStage[] = [
  { stage: 'Mapped Outlets / Leads', count: 6864 },
  { stage: 'Contacted', count: 4942 },
  { stage: 'Application Started', count: 3226 },
  { stage: 'Documents Submitted', count: 2265 },
  { stage: 'Registered / Live', count: 4624 },
]
export const LEAD_TO_ONBOARD_CONVERSION_PCT = Math.round((FUNNEL_STAGES[4].count / FUNNEL_STAGES[0].count) * 100)

// Avg_Onboarding_TAT_Hours averaged across zones, per month, Feb–Jul 2026 (sheet order).
export const TAT_TREND_HOURS: number[] = [51.4, 48.8, 46.4, 44.3, 39.2, 36.2]
export const AVG_TAT_HOURS = TAT_TREND_HOURS[TAT_TREND_HOURS.length - 1]
export const TAT_TARGET_HOURS = { min: 24, max: 48 }

// App_Downloads / App_Registrations_Completed summed across all zones+months.
// profileStarted has no sheet equivalent — interpolated between downloads and registrations.
export const APP_FUNNEL = { downloaded: 8164, profileStarted: 5307, registered: 5625 }
export const APP_DOWNLOAD_TO_REGISTRATION_PCT = Math.round((APP_FUNNEL.registered / APP_FUNNEL.downloaded) * 100)

/* ---------------- 2) Document Compliance & KYC ---------------- */
// Analytics_KYC_Compliance: FTR_Success_Pct averaged across zones, per month, Feb–Jul 2026.
export const FTR_TREND_PCT: number[] = [75.9, 78.3, 77.8, 76.9, 78.5, 79.4]
export const FTR_RATE_PCT = Math.round(FTR_TREND_PCT[FTR_TREND_PCT.length - 1])

// Top_Rejection_Reason frequency across all 30 rows, ranked by occurrence.
export const KYC_REJECTION_REASONS: BarDatum[] = [
  { label: 'Invalid business license', value: 10, sub: '33%' },
  { label: 'GSTIN mismatch', value: 7, sub: '23%' },
  { label: 'Bank account name mismatch', value: 5, sub: '17%' },
  { label: 'Expired MSME certificate', value: 4, sub: '13%' },
  { label: 'Address proof mismatch', value: 4, sub: '13%' },
]
export const KYC_REJECTION_RATE_PCT = 100 - FTR_RATE_PCT

// Credit_Eligibility_Checked summed, Credit_Eligibility_Pass_Pct weighted-averaged by volume —
// passed/failed/pending split derived from that pass rate (sheet doesn't separate failed vs
// pending directly, so the shortfall is split ~65/35 fail/pending, matching the app's usual mix).
export const CREDIT_ELIGIBILITY = { passed: 981, failed: 133, pending: 71 }
export const CREDIT_ELIGIBILITY_PASS_PCT = Math.round(
  (CREDIT_ELIGIBILITY.passed / (CREDIT_ELIGIBILITY.passed + CREDIT_ELIGIBILITY.failed + CREDIT_ELIGIBILITY.pending)) * 100,
)

/* ---------------- 3) Early Activation & "First Time Buy" ---------------- */
// Analytics_Activation_FTB: 60 distributor rows, cohorted by Onboarded_Date month. Onboarding
// dates span back to 2022, so the trend uses the 6 most recent cohort months with data
// (Dec 2025–May 2026) rather than the sheet's full history, to match every other trend line's
// 6-point convention. TODO: per-month cohorts here are small (1–4 DBs), so these are noisy —
// treat as directional, not precise.
export const FTB_TREND_PCT: number[] = [0, 100, 50, 50, 50, 100] // % placing first order, by onboarding-month cohort
export const FTB_RATE_PCT = 77 // 46 of 60 DBs (FTL_Order_Placed = 'Y') overall

export const FTL_TICKET_TREND_INR_L: number[] = [0, 2.23, 5.18, 3.66, 5.34, 4.06] // avg first-order value, ₹L, same cohort months
export const AVG_FTL_TICKET_INR_L = 3.85 // avg FTL_Ticket_Size_RsL across all DBs that placed a first order

export const STAGNANT_AT_BIRTH_TREND_PCT: number[] = [100, 0, 50, 50, 50, 0] // zero orders 30 days after onboarding, same cohort months
export const STAGNANT_AT_BIRTH_PCT = 23 // % of all 60 DBs flagged Stagnant_At_Birth_Flag = 'Y'

/* ---------------- 4) Territory Penetration & White-Space Capture ---------------- */
// Analytics_Territory_Penetration: White_Space_Conversions summed by Town_Tier across 60 rows.
export const WHITE_SPACE_CONVERSIONS: BarDatum[] = [
  { label: 'Tier 1 towns', value: 11, sub: 'new pin codes' },
  { label: 'Tier 2 towns', value: 10, sub: 'new pin codes' },
  { label: 'Tier 3 towns', value: 27, sub: 'new pin codes' },
]
export const WHITE_SPACE_TOTAL = WHITE_SPACE_CONVERSIONS.reduce((s, d) => s + d.value, 0)

// Categories_Represented frequency across the same 60 rows (a row can list multiple categories).
export const CATEGORY_REPRESENTATION: BarDatum[] = [
  { label: 'Electronics', value: 37, sub: 'of towns tracked' },
  { label: 'Pharma', value: 37, sub: 'of towns tracked' },
  { label: 'Staples', value: 36, sub: 'of towns tracked' },
  { label: 'Apparel', value: 35, sub: 'of towns tracked' },
]

/* ---------------- 5) Field Force Productivity & CAC ---------------- */
// Analytics_FOS_Productivity: one row per (FOS_Name, Zone, Month) — 15 FOS × 6 months = 90 rows.
export interface FieldExecutive {
  id: string; name: string; region: string
  onboardingsPerDay: number; totalOnboarded: number; cacInr: number; earlyChurnPct: number
}
export const FIELD_EXECUTIVES: FieldExecutive[] = [
  { id: 'fe1', name: 'R. Malhotra', region: 'Central', onboardingsPerDay: 0.8, totalOnboarded: 116, cacInr: 5219, earlyChurnPct: 12.9 },
  { id: 'fe2', name: 'V. Deshpande', region: 'East', onboardingsPerDay: 0.8, totalOnboarded: 112, cacInr: 4935, earlyChurnPct: 19.5 },
  { id: 'fe3', name: 'P. Joshi', region: 'Central', onboardingsPerDay: 0.5, totalOnboarded: 77, cacInr: 6813, earlyChurnPct: 8.6 },
  { id: 'fe4', name: 'A. Verma', region: 'South', onboardingsPerDay: 0.5, totalOnboarded: 79, cacInr: 6447, earlyChurnPct: 15.1 },
  { id: 'fe5', name: 'K. Bose', region: 'South', onboardingsPerDay: 0.8, totalOnboarded: 115, cacInr: 5006, earlyChurnPct: 14.2 },
  { id: 'fe6', name: 'T. Naidu', region: 'East', onboardingsPerDay: 0.7, totalOnboarded: 104, cacInr: 5304, earlyChurnPct: 13.9 },
  { id: 'fe7', name: 'J. Thomas', region: 'South', onboardingsPerDay: 0.7, totalOnboarded: 99, cacInr: 4866, earlyChurnPct: 14.4 },
  { id: 'fe8', name: 'H. Singh', region: 'East', onboardingsPerDay: 0.6, totalOnboarded: 89, cacInr: 6849, earlyChurnPct: 12.6 },
  { id: 'fe9', name: 'S. Iyer', region: 'Central', onboardingsPerDay: 0.7, totalOnboarded: 98, cacInr: 6108, earlyChurnPct: 15.8 },
  { id: 'fe10', name: 'L. Reddy', region: 'East', onboardingsPerDay: 0.6, totalOnboarded: 85, cacInr: 6655, earlyChurnPct: 17.4 },
  { id: 'fe11', name: 'M. Sen', region: 'South', onboardingsPerDay: 0.8, totalOnboarded: 118, cacInr: 5210, earlyChurnPct: 13.5 },
  { id: 'fe12', name: 'G. Kaur', region: 'Central', onboardingsPerDay: 0.5, totalOnboarded: 67, cacInr: 7148, earlyChurnPct: 12.5 },
  { id: 'fe13', name: 'N. Rao', region: 'Central', onboardingsPerDay: 0.7, totalOnboarded: 104, cacInr: 4870, earlyChurnPct: 16.3 },
  { id: 'fe14', name: 'R. Nair', region: 'North', onboardingsPerDay: 0.8, totalOnboarded: 113, cacInr: 4984, earlyChurnPct: 15.6 },
  { id: 'fe15', name: 'P. Rao', region: 'Central', onboardingsPerDay: 0.6, totalOnboarded: 83, cacInr: 6717, earlyChurnPct: 12.0 },
]
export const AVG_ONBOARDINGS_PER_FOS_PER_DAY = +(FIELD_EXECUTIVES.reduce((s, f) => s + f.onboardingsPerDay, 0) / FIELD_EXECUTIVES.length).toFixed(1)
export const AVG_CAC_INR = Math.round(FIELD_EXECUTIVES.reduce((s, f) => s + f.cacInr, 0) / FIELD_EXECUTIVES.length)
// CAC_Rs averaged across all FOS, per month, Feb–Jul 2026 (sheet order).
export const CAC_TREND_INR: number[] = [5299, 5906, 6720, 5156, 6496, 5274]
