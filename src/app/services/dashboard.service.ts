// Wraps GET /api/dashboard (backend-springboot's DashboardController). The controller builds an
// ad-hoc Map<String,Object> rather than a typed record — see DashboardController.summary() for the
// authoritative shape. leadsByStage/casesByStatus are live group-counts (Map<String,Long>) keyed by
// whatever stage/status strings actually occur in the data (e.g. 'open', 'flagged'), not a fixed
// enum, so they're typed as open string-keyed maps rather than a specific union. Plain functions
// (not an Angular service class) so store.ts, which already holds the auth token, can call these
// directly without DI plumbing.
import { apiGet } from '../lib/api'

/** Mirrors the Map<String,Object> built by DashboardController.summary(). */
export interface DashboardSummary {
  leadsTotal: number
  leadsByStage: Record<string, number>
  myCasesTotal: number
  myCasesFlagged: number
  myCasesOverdue: number
  casesByStatus: Record<string, number>
  unreadNotifications: number
  openGrievances: number
  activePartners: number
}

const base = '/api/dashboard'

export function getDashboard(token: string | null): Promise<DashboardSummary> {
  return apiGet(base, token)
}
