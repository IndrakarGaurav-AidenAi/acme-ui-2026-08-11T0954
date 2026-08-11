// Wraps GET/POST/PATCH /api/grievances/** (backend-springboot's GrievanceController). Field names
// match com.rcpl.platform.grievance.GrievanceDtos.GrievanceDto exactly — see that file for the
// authoritative shape. Plain functions (not an Angular service class) so store.ts, which already
// holds the auth token, can call these directly without DI plumbing.
import { apiGet, apiPatch, apiPost } from '../lib/api'

export interface BackendGrievanceUpdate {
  id: number
  on: string
  by: string
  note: string
}

export interface BackendGrievance {
  id: string
  distributor: string
  town: string
  channel: string
  category: string
  priority: string
  status: string
  subject: string
  detail: string
  raisedOn: string
  ageDays: number
  ownerRole: string
  slaLabel: string
  isOverdue: boolean
  updates: BackendGrievanceUpdate[]
}

export interface CreateGrievanceRequest {
  distributor: string
  town?: string
  channel?: string
  category?: string
  priority?: string
  subject: string
  detail?: string
  ownerRole?: string
  slaLabel?: string
}

const base = '/api/grievances'

export function listGrievances(token: string | null): Promise<BackendGrievance[]> {
  return apiGet(base, token)
}

export function getGrievance(token: string | null, id: string): Promise<BackendGrievance> {
  return apiGet(`${base}/${encodeURIComponent(id)}`, token)
}

export function createGrievance(token: string | null, req: CreateGrievanceRequest): Promise<BackendGrievance> {
  return apiPost(base, token, req)
}

export function setGrievanceStatus(token: string | null, id: string, status: string): Promise<BackendGrievance> {
  return apiPatch(`${base}/${encodeURIComponent(id)}`, token, { status })
}

export function sendGrievanceUpdate(token: string | null, id: string): Promise<BackendGrievance> {
  return apiPost(`${base}/${encodeURIComponent(id)}/update`, token)
}
