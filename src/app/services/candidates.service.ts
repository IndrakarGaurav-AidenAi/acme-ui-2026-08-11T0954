// Wraps GET/POST/PATCH /api/candidates/** (backend-springboot's CandidateController). Field names
// match com.rcpl.platform.candidate.CandidateDtos.CandidateDto exactly — see that file for the
// authoritative shape. Plain functions (not an Angular service class) so store.ts, which already
// holds the auth token, can call these directly without DI plumbing.
import { apiGet, apiPatch, apiPost } from '../lib/api'

export interface BackendCandidate {
  id: string
  name: string
  town: string | null
  dbCategory: string | null
  turnoverMonthly: number | null
  expectedAcmeTurnover: number | null
  coverageOutlets: number | null
  infraScore: number | null
  finEvalPct: number | null
  stage: string
  confidencePct: number | null
  isBestMatch: boolean
  shortlisted: boolean
  userCreated: boolean
  createdBy: string | null
  createdAt: number | null
  sourceIntakeId: string | null
  subtype: string | null
  oldDbCode: string | null
  oldDbName: string | null
  additionalReason: string | null
  discontinuationForm: unknown | null
}

export interface CreateCandidateRequest {
  name: string
  town?: string
  dbCategory?: string
  turnoverMonthly?: number
  expectedAcmeTurnover?: number
  coverageOutlets?: number
  infraScore?: number
  finEvalPct?: number
  stage?: string
  confidencePct?: number
  sourceIntakeId?: string
  subtype?: string
  oldDbCode?: string
  oldDbName?: string
  additionalReason?: string
  discontinuationForm?: unknown
}

export type UpdateCandidateRequest = Partial<Omit<CreateCandidateRequest, 'name'>> & { name?: string }

export interface ActivateCandidateRequest {
  partnerName: string
  partnerType: string
  town?: string
  state?: string
}

const base = '/api/candidates'

export function listCandidates(token: string | null): Promise<BackendCandidate[]> {
  return apiGet(base, token)
}

export function getCandidate(token: string | null, id: string): Promise<BackendCandidate> {
  return apiGet(`${base}/${encodeURIComponent(id)}`, token)
}

export function createCandidate(token: string | null, req: CreateCandidateRequest): Promise<BackendCandidate> {
  return apiPost(base, token, req)
}

export function updateCandidate(token: string | null, id: string, req: UpdateCandidateRequest): Promise<BackendCandidate> {
  return apiPatch(`${base}/${encodeURIComponent(id)}`, token, req)
}

export function moveCandidateStage(token: string | null, id: string, stage: string): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/stage`, token, { stage })
}

export function activateCandidate(token: string | null, id: string, req: ActivateCandidateRequest): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/activate`, token, req)
}

export function setCandidateShortlisted(token: string | null, id: string, on: boolean): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/shortlist?on=${on}`, token)
}

export function rejectCandidate(token: string | null, id: string): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/reject`, token)
}

export function reinstateCandidate(token: string | null, id: string): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/reinstate`, token)
}

export function evaluateCandidate(token: string | null, id: string): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/evaluate`, token)
}

export function setCandidateDiscontinuationForm(token: string | null, id: string, form: unknown): Promise<BackendCandidate> {
  return apiPost(`${base}/${encodeURIComponent(id)}/discontinuation-form`, token, { form })
}
