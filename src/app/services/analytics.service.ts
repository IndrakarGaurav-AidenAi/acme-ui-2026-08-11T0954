// Wraps GET /api/analytics/{section} (backend-springboot's AnalyticsController, which delegates to
// AnalyticsService.section()). The controller returns an ad-hoc Map<String,Object> per section —
// see AnalyticsService for the authoritative shape. Only three sections exist server-side (any
// other value hits the `default -> throw new ApiException.NotFound(...)` branch, a 404), and each
// returns a different fixed set of keys computed live from PartnerRepository/CaseRepository/
// CandidateRepository, so they're typed individually below instead of as one blob.
//
// Mismatch vs the current UI mocks (mock/analytics.ts, mock/onboardingEfficiency.ts) — the real
// aggregates are much flatter than what those files model:
//   - 'overview' here is just partner/lead/case headline counts. There's no KPI-with-delta/
//     sparkline-trend shape like mock/analytics.ts's ANALYTICS_KPIS/TREND/OUTCOMES.
//   - 'detail' here is partner counts by state/status plus onboarded/deboarded-by-year cohorts.
//     There's no per-partner scorecard (turnover vs target, fill rate, growth %, ws contribution)
//     or REGION_PERFORMANCE-style breakdown like mock/analytics.ts's DB_PERFORMANCE table.
//   - 'efficiency' here is case approval-rate + lead-to-active conversion ONLY. It does not cover
//     any of mock/onboardingEfficiency.ts's funnel-velocity/TAT/KYC-compliance/FTB/white-space/FOS-
//     productivity metrics — AnalyticsService has no repositories backing that data at all, so
//     those mock shapes have no real endpoint yet.
// Wrapping the real shape here as-is; not inventing fields the backend doesn't send.
import { apiGet } from '../lib/api'

export type AnalyticsSectionName = 'overview' | 'detail' | 'efficiency'

/** Mirrors AnalyticsService.overview(). */
export interface AnalyticsOverview {
  totalPartners: number
  activePartners: number
  inReviewPartners: number
  discontinuedPartners: number
  partnersByType: Record<string, number>
  totalLeads: number
  leadsByStage: Record<string, number>
  totalCases: number
  casesByStatus: Record<string, number>
}

/** Mirrors AnalyticsService.detail(). */
export interface AnalyticsDetail {
  partnersByState: Record<string, number>
  activePartnersByState: Record<string, number>
  partnersByStatus: Record<string, number>
  onboardedByYear: Record<string, number>
  deboardedByYear: Record<string, number>
}

/** Mirrors AnalyticsService.efficiency(). */
export interface AnalyticsEfficiency {
  totalCases: number
  approved: number
  rejected: number
  flagged: number
  overdue: number
  approvalRatePct: number
  totalLeads: number
  activeLeads: number
  conversionRatePct: number
}

interface AnalyticsSectionMap {
  overview: AnalyticsOverview
  detail: AnalyticsDetail
  efficiency: AnalyticsEfficiency
}

const base = '/api/analytics'

export function getAnalyticsSection<S extends AnalyticsSectionName>(
  token: string | null,
  section: S,
): Promise<AnalyticsSectionMap[S]> {
  return apiGet(`${base}/${encodeURIComponent(section)}`, token)
}
