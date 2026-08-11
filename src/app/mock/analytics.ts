export interface TrendPoint { month: string; total: number; autoCleared: number; rejected: number }

export const TREND: TrendPoint[] = [
  { month: 'Jan', total: 62, autoCleared: 41, rejected: 7 },
  { month: 'Feb', total: 74, autoCleared: 52, rejected: 6 },
  { month: 'Mar', total: 88, autoCleared: 63, rejected: 9 },
  { month: 'Apr', total: 97, autoCleared: 74, rejected: 8 },
  { month: 'May', total: 112, autoCleared: 88, rejected: 9 },
  { month: 'Jun', total: 128, autoCleared: 104, rejected: 9 },
]

export interface OutcomeSlice { label: string; value: number; pct: number; colorVar: string }
export const OUTCOME_TOTAL = 128
export const OUTCOMES: OutcomeSlice[] = [
  { label: 'Auto Cleared', value: 104, pct: 81, colorVar: '--chart-2' },
  { label: 'Approved', value: 15, pct: 12, colorVar: '--chart-1' },
  { label: 'Rejected', value: 9, pct: 7, colorVar: '--chart-3' },
]

export interface BarDatum { label: string; value: number; sub?: string }
export const REJECTION_REASONS: BarDatum[] = [
  { label: 'Credit Exposure', value: 24, sub: '43%' },
  { label: 'Low Infrastructure', value: 16, sub: '29%' },
  { label: 'GST Issues', value: 10, sub: '18%' },
  { label: 'Others', value: 6, sub: '10%' },
]

export const BY_PARTNER_TYPE: BarDatum[] = [
  { label: 'Distributor', value: 98 },
  { label: 'Vendor', value: 18 },
  { label: 'Logistics', value: 8 },
  { label: 'Co-packer', value: 4 },
]

// DB category taxonomy from the workbook dropdown (GT DB / GM Excl DB / Traders).
export const DB_CATEGORY_MIX: BarDatum[] = [
  { label: 'GT DB (with CSO/DSM)', value: 24 },
  { label: 'GM Excl DB', value: 14 },
  { label: 'Traders', value: 9 },
]

export interface Kpi { label: string; value: string; delta: string; deltaGood: boolean; trend: number[]; colorVar: string }
export const ANALYTICS_KPIS: Kpi[] = [
  { label: 'Applications', value: '128', delta: '+58.5% vs last month', deltaGood: true, trend: TREND.map((t) => t.total), colorVar: '--chart-1' },
  { label: 'Auto Cleared', value: '81%', delta: '+6.2% vs last month', deltaGood: true, trend: [62, 66, 70, 74, 78, 81], colorVar: '--chart-2' },
  { label: 'Avg Onboarding Time', value: '2.4 Days', delta: '-0.8 day vs last month', deltaGood: true, trend: [4.1, 3.7, 3.3, 3.0, 2.7, 2.4], colorVar: '--chart-5' },
  { label: 'Rejection Rate', value: '7.2%', delta: '-3.5% vs last month', deltaGood: true, trend: [12, 11, 10, 9, 8, 7.2], colorVar: '--chart-3' },
]

export const ANALYTICS_INSIGHT = {
  headline: 'Rejections due to credit exposure increased by 24% this month.',
  detail: 'Major contribution from the DB2 candidate category, concentrated in Maharashtra.',
  suggested: 'Review the credit-exposure policy for DB2 candidates before the next appointment cycle.',
  impact: 'Potential auto-clear rate increase of ~9% if the CC-limit threshold is revisited.',
}

/* ---------------- Distributor performance ----------------
   Post-onboarding view: how active DBs track against their Acme turnover and coverage
   plans, and — derived from the same numbers — exactly where each one is falling short. */
export interface DbPerf {
  id: string
  name: string
  town: string
  category: string        // GT DB / GM Excl DB / Traders
  acmeTurnover: number    // ₹L/mo actual Acme business
  acmeTarget: number      // ₹L/mo plan
  outlets: number         // outlets actively served
  outletTarget: number    // planned coverage
  growthMoM: number       // % change vs last month
  fillRate: number        // order fill / service level %
  wsContribution: number  // Acme as % of the DB's total business
  trend: number[]         // last 6 months Acme turnover
  /** date this DB was onboarded/appointed, e.g. '18 Jun 2022' — drives the Analytics tenure/aging metric. */
  onboardedAt: string
}

export const DB_PERFORMANCE: DbPerf[] = [
  { id: 'db-metro', name: 'Metro Trade Combines', town: 'Mumbai', category: 'GT DB (with CSO/DSM)', acmeTurnover: 58, acmeTarget: 55, outlets: 2450, outletTarget: 2600, growthMoM: 8.2, fillRate: 97, wsContribution: 34, trend: [47, 50, 52, 55, 56, 58], onboardedAt: '10 Feb 2015' },
  { id: 'db-juhu', name: 'Juhu Distributors', town: 'Mumbai', category: 'GT DB (with CSO/DSM)', acmeTurnover: 40, acmeTarget: 42, outlets: 1900, outletTarget: 2000, growthMoM: 3.4, fillRate: 96, wsContribution: 33, trend: [36, 37, 38, 39, 39, 40], onboardedAt: '22 Apr 2021' },
  { id: 'db-godavari', name: 'Godavari Traders', town: 'Nashik Rural', category: 'GM Excl DB', acmeTurnover: 22, acmeTarget: 24, outlets: 1180, outletTarget: 1200, growthMoM: 5.1, fillRate: 95, wsContribution: 31, trend: [18, 19, 20, 21, 21, 22], onboardedAt: '14 Nov 2022' },
  { id: 'db-sunrise', name: 'Sunrise Agencies', town: 'Pune', category: 'GT DB (with CSO/DSM)', acmeTurnover: 30, acmeTarget: 32, outlets: 1150, outletTarget: 1300, growthMoM: 6.8, fillRate: 94, wsContribution: 33, trend: [24, 26, 27, 28, 29, 30], onboardedAt: '30 Jan 2020' },
  { id: 'db-deshmukh', name: 'Deshmukh Enterprises', town: 'Aurangabad', category: 'Traders', acmeTurnover: 25, acmeTarget: 29, outlets: 1050, outletTarget: 1200, growthMoM: 2.0, fillRate: 88, wsContribution: 30, trend: [23, 24, 24, 25, 25, 25], onboardedAt: '05 Jun 2018' },
  { id: 'db-surat', name: 'Surat Stockists', town: 'Surat', category: 'GT DB (with CSO/DSM)', acmeTurnover: 34, acmeTarget: 38, outlets: 1500, outletTarget: 2100, growthMoM: 1.2, fillRate: 92, wsContribution: 30, trend: [30, 31, 32, 33, 33, 34], onboardedAt: '18 Jun 2022' },
  { id: 'db-deccan', name: 'Deccan Trade Links', town: 'Nagpur', category: 'GT DB (with CSO/DSM)', acmeTurnover: 30, acmeTarget: 34, outlets: 1620, outletTarget: 1850, growthMoM: 0.9, fillRate: 91, wsContribution: 30, trend: [27, 28, 29, 29, 30, 30], onboardedAt: '12 Sep 2024' },
  { id: 'db-suvarna', name: 'Suvarna Agencies', town: 'Nashik', category: 'GT DB (with CSO/DSM)', acmeTurnover: 20, acmeTarget: 32, outlets: 900, outletTarget: 1400, growthMoM: -4.0, fillRate: 86, wsContribution: 22, trend: [26, 24, 23, 22, 21, 20], onboardedAt: '25 Mar 2019' },
  { id: 'db-malhotra', name: 'Malhotra Distributors', town: 'Nashik', category: 'GT DB (with CSO/DSM)', acmeTurnover: 24, acmeTarget: 40, outlets: 1200, outletTarget: 2000, growthMoM: -6.5, fillRate: 84, wsContribution: 20, trend: [32, 30, 28, 26, 25, 24], onboardedAt: '01 Dec 2023' },
  { id: 'db-andheri', name: 'Andheri General Stores', town: 'Mumbai', category: 'Traders', acmeTurnover: 12, acmeTarget: 22, outlets: 600, outletTarget: 1100, growthMoM: 12.0, fillRate: 82, wsContribution: 24, trend: [7, 8, 9, 10, 11, 12], onboardedAt: '20 Oct 2025' },
]

export const dbAttainment = (d: DbPerf) => Math.round((d.acmeTurnover / d.acmeTarget) * 100)
export const dbCoverage = (d: DbPerf) => Math.round((d.outlets / d.outletTarget) * 100)

// Where a DB is lacking — derived from the same numbers shown in the scorecard, so the
// callouts always agree with the metrics.
export function dbGaps(d: DbPerf): string[] {
  const g: string[] = []
  if (dbAttainment(d) < 90) g.push(`Turnover ${dbAttainment(d)}% of target`)
  if (dbCoverage(d) < 85) g.push(`Coverage ${dbCoverage(d)}% of plan`)
  if (d.growthMoM < 0) g.push(`Declining ${d.growthMoM}% MoM`)
  if (d.fillRate < 90) g.push(`Fill rate ${d.fillRate}%`)
  if (d.wsContribution < 30) g.push(`Acme share ${d.wsContribution}%`)
  return g
}

export type DbStatus = 'on_track' | 'watch' | 'at_risk'
export function dbStatus(d: DbPerf): DbStatus {
  const gaps = dbGaps(d)
  if (dbAttainment(d) < 75 || dbCoverage(d) < 70 || gaps.length >= 3) return 'at_risk'
  if (gaps.length >= 1) return 'watch'
  return 'on_track'
}

// The recurring gap types, for the "Where distributors are lacking" breakdown.
export const DB_GAP_CATEGORIES: { key: string; label: string; test: (d: DbPerf) => boolean }[] = [
  { key: 'turnover', label: 'Turnover below target', test: (d) => dbAttainment(d) < 90 },
  { key: 'coverage', label: 'Coverage below plan', test: (d) => dbCoverage(d) < 85 },
  { key: 'fill', label: 'Low fill rate', test: (d) => d.fillRate < 90 },
  { key: 'share', label: 'Low Acme share', test: (d) => d.wsContribution < 30 },
  { key: 'decline', label: 'Declining month-on-month', test: (d) => d.growthMoM < 0 },
]

// 6-month history of at-risk / watch counts — the same two tiers dbStatus() buckets DBs into,
// tracked over time so Analytics can show whether the risk pile is growing or draining.
export interface RiskPoint { month: string; atRisk: number; watch: number }
export const RISK_TREND: RiskPoint[] = [
  { month: 'Jan', atRisk: 6, watch: 2 },
  { month: 'Feb', atRisk: 7, watch: 2 },
  { month: 'Mar', atRisk: 7, watch: 3 },
  { month: 'Apr', atRisk: 6, watch: 3 },
  { month: 'May', atRisk: 7, watch: 2 },
  { month: 'Jun', atRisk: 3, watch: 3 },
]

// Macro-region rollups for the Analytics "By region" heatmap. Coverage is read live from GTM in
// the component (so it matches Coverage by Region); these are the region-level service/health
// figures that don't otherwise exist per-region in the curated DB_PERFORMANCE sample. West is
// aligned with the real West distributor aggregate so the two never contradict each other.
export interface RegionPerf { fillRate: number; attainmentPct: number; growthMoM: number; atRiskPct: number }
export const REGION_PERFORMANCE: Record<string, RegionPerf> = {
  West: { fillRate: 91, attainmentPct: 83, growthMoM: 2.9, atRiskPct: 30 },
  South: { fillRate: 93, attainmentPct: 90, growthMoM: 4.1, atRiskPct: 12 },
  North: { fillRate: 88, attainmentPct: 79, growthMoM: 1.5, atRiskPct: 22 },
  Central: { fillRate: 86, attainmentPct: 80, growthMoM: 0.8, atRiskPct: 26 },
  East: { fillRate: 84, attainmentPct: 73, growthMoM: -0.6, atRiskPct: 35 },
}

export const DB_PERF_INSIGHT = {
  headline: '6 of 10 distributors are tracking below their turnover plan — but coverage is the real drag.',
  detail: 'Suvarna, Malhotra and Andheri each run below 65% of their outlet plan; together they are ~1,800 outlets short.',
  suggested: 'Launch a beat-expansion push for the 3 at-risk DBs before the next quarter, and revisit Malhotra\'s replacement.',
}
