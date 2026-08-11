// Wraps GET/POST /api/cases/** (backend-springboot's CaseController) — the Approvals queue and case
// workflow actions. Field names match com.rcpl.platform.caseflow.dto.CaseDtos.CaseDto exactly (note:
// CaseDtos lives in the caseflow.dto subpackage, unlike most other modules — see that file for the
// authoritative shape). financeSnapshot/channelSnapshot reuse the frontend's own CaseFinanceSnapshot/
// CaseChannelSnapshot (types.ts) since those already mirror FinanceSnapshotDto/ChannelSnapshotDto
// field-for-field. Plain functions (not an Angular service class) so store.ts, which already holds
// the auth token, can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'
import type { CaseFinanceSnapshot, CaseChannelSnapshot } from '../types'

export interface BackendCase {
  code: string
  partnerName: string
  partnerType: string
  town: string | null
  state: string | null
  subtype: string
  status: string
  ownerRole: string
  involvedRoles: string[]
  slaLabel: string
  isOverdue: boolean
  hasDiscontinuationForm: boolean
  discontinuationForm: unknown | null
  confidencePct: number | null
  candidateId: string | null
  flagDetail: string | null
  signoffAuthority: string | null
  onboardingNotified: boolean
  financeSnapshot: CaseFinanceSnapshot | null
  channelSnapshot: CaseChannelSnapshot | null
  financeDocsUploaded: Record<string, { name: string; dataUrl: string | null }> | null
  channelDocUploaded: string | null
  notesForLeadership: { author: string; body: string; when: string }[] | null
}

export interface RaiseCaseRequest {
  partnerName: string
  partnerType: string
  ownerRole: string
  town?: string
  state?: string
  subtype?: string
  candidateId?: string
  flagDetail?: string
  signoffAuthority?: string
  confidencePct?: number
  slaHours?: number
  hasDiscontinuationForm?: boolean
  discontinuationForm?: unknown
  financeSnapshot?: CaseFinanceSnapshot
  channelSnapshot?: CaseChannelSnapshot
}

export interface ScoreRequest {
  ownFunds?: number
  ccLimit?: number
  requiredInvestment?: number
  infraScore?: number
  infraThreshold?: number
}

export interface BackendScoreResponse {
  finance: CaseFinanceSnapshot
  channel: CaseChannelSnapshot
}

const base = '/api/cases'

export function listCases(token: string | null, mine?: boolean): Promise<BackendCase[]> {
  return apiGet(`${base}${mine ? '?mine=true' : ''}`, token)
}

export function getCase(token: string | null, code: string): Promise<BackendCase> {
  return apiGet(`${base}/${encodeURIComponent(code)}`, token)
}

export function raiseCase(token: string | null, req: RaiseCaseRequest): Promise<BackendCase> {
  return apiPost(base, token, req)
}

export function decideCase(token: string | null, code: string, decision: 'approved' | 'rejected'): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/decision`, token, { decision })
}

export function attachCaseFinanceDoc(
  token: string | null,
  code: string,
  key: string,
  fileName: string,
  dataUrl?: string,
): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/finance-doc`, token, { key, fileName, dataUrl })
}

export function attachCaseChannelDoc(token: string | null, code: string, fileName: string): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/channel-doc`, token, { fileName })
}

export function linkCaseDiscontinuation(token: string | null, code: string, form: unknown): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/discontinuation`, token, { form })
}

export function addCaseNote(token: string | null, code: string, author: string, body: string): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/note`, token, { author, body })
}

export function markCaseOnboardingNotified(token: string | null, code: string): Promise<BackendCase> {
  return apiPost(`${base}/${encodeURIComponent(code)}/onboarding-notified`, token)
}

/** Deterministic finance/channel scoring for the New Application wizard (stateless — no case yet). */
export function scoreCase(token: string | null, req: ScoreRequest): Promise<BackendScoreResponse> {
  return apiPost(`${base}/score`, token, req)
}
