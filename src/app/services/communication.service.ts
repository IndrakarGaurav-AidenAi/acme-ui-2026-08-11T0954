// Wraps GET/POST /api/communication/** (backend-springboot's CommunicationController). Field names
// match com.rcpl.platform.communication.CommunicationDtos.ThreadDto exactly — see that file for the
// authoritative shape. Plain functions (not an Angular service class) so store.ts, which already
// holds the auth token, can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'

export interface BackendCaseMessage {
  id: string
  authorRole: string
  authorName: string
  body: string
  isNextReplier: boolean
}

export interface BackendThread {
  code: string
  town: string
  partnerName: string
  audience: string
  last: string
  participants: BackendCaseMessage[]
}

export interface EnsureThreadRequest {
  code: string
  town?: string
  partnerName?: string
  audience?: string
}

export interface PostMessageRequest {
  authorRole: string
  authorName: string
  body: string
}

export interface NudgeRequest {
  town: string
  partnerName: string
  reason: string
}

export interface RequestInfoRequest {
  town: string
  partnerName: string
  reviewerRole: string
  reviewerName: string
  note: string
}

const base = '/api/communication'

export function listThreads(token: string | null): Promise<BackendThread[]> {
  return apiGet(`${base}/threads`, token)
}

export function getThread(token: string | null, code: string): Promise<BackendThread> {
  return apiGet(`${base}/threads/${encodeURIComponent(code)}`, token)
}

export function ensureThread(token: string | null, req: EnsureThreadRequest): Promise<BackendThread> {
  return apiPost(`${base}/threads`, token, req)
}

export function postThreadMessage(token: string | null, code: string, req: PostMessageRequest): Promise<BackendThread> {
  return apiPost(`${base}/threads/${encodeURIComponent(code)}/messages`, token, req)
}

export function nudgeThread(token: string | null, code: string, req: NudgeRequest): Promise<BackendThread> {
  return apiPost(`${base}/threads/${encodeURIComponent(code)}/nudge`, token, req)
}

export function requestInfoOnThread(token: string | null, code: string, req: RequestInfoRequest): Promise<BackendThread> {
  return apiPost(`${base}/threads/${encodeURIComponent(code)}/request-info`, token, req)
}
