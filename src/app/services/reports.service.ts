// Wraps GET/POST /api/reports (backend-springboot's ReportController). Field names match
// com.rcpl.platform.report.ReportDtos.ReportDto exactly — see that file for the authoritative
// shape. Plain functions (not an Angular service class) so store.ts, which already holds the auth
// token, can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'

export interface BackendReport {
  id: string
  name: string
  date: string | null
  format: string | null
}

// ReportDtos.CreateReportRequest — name/format are @NotBlank; the server stamps `date` itself
// (DateLabels.dateStamp()) so it isn't part of the create payload.
export interface CreateReportRequest {
  name: string
  format: string
}

const base = '/api/reports'

export function listReports(token: string | null): Promise<BackendReport[]> {
  return apiGet(base, token)
}

export function createReport(token: string | null, req: CreateReportRequest): Promise<BackendReport> {
  return apiPost(base, token, req)
}
