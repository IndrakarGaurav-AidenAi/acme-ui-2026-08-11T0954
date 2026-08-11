// Wraps GET/POST /api/documents/** (backend-springboot's DocumentController). Field names match
// com.rcpl.platform.document.DocumentDtos.DocumentDto exactly — see that file for the authoritative
// shape. Plain functions (not an Angular service class) so store.ts, which already holds the auth
// token, can call these directly without DI plumbing.
import { apiGet, apiPost } from '../lib/api'

export interface BackendDocument {
  id: string
  caseCode: string | null
  partnerType: string | null
  docName: string
  claimed: string | null
  extracted: string | null
  status: string
  fileName: string | null
  uploadedOn: string | null
  uploadedAt: string | null
  verifiedOn: string | null
  optional: boolean
  thisWeek: boolean
}

export interface CreateDocumentRequest {
  docName: string
  caseCode?: string
  partnerType?: string
  claimed?: string
  extracted?: string
  fileName?: string
  optional?: boolean
}

const base = '/api/documents'

export function listDocuments(token: string | null, caseCode?: string): Promise<BackendDocument[]> {
  const qs = caseCode ? `?caseCode=${encodeURIComponent(caseCode)}` : ''
  return apiGet(`${base}${qs}`, token)
}

export function getDocument(token: string | null, id: string): Promise<BackendDocument> {
  return apiGet(`${base}/${encodeURIComponent(id)}`, token)
}

export function createDocument(token: string | null, req: CreateDocumentRequest): Promise<BackendDocument> {
  return apiPost(base, token, req)
}

// DocumentController.verify takes no request body — status is derived server-side by comparing
// the document's stored claimed/extracted text, not by anything the caller supplies.
export function verifyDocument(token: string | null, id: string): Promise<BackendDocument> {
  return apiPost(`${base}/${encodeURIComponent(id)}/verify`, token)
}
