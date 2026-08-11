// Wraps GET /api/partners/** (backend-springboot's PartnerController). Field names match
// com.rcpl.platform.partner.PartnerDto exactly — see that file for the authoritative shape.
// BackendPartner corresponds 1:1 by field name to the frontend's own Partner (../types), but is
// kept as a separate interface: partnerType/status are plain string here (the DTO carries them as
// Java String, not the frontend's narrower PartnerTypeCode/status literal unions) and
// onboardedAt/discontinuedAt/dbCode are `| null` rather than optional (Jackson serializes absent
// values as explicit JSON nulls here, not omitted keys — same convention as BackendCandidate).
// Plain functions (not an Angular service class) so store.ts, which already holds the auth token,
// can call these directly without DI plumbing.
import { apiGet } from '../lib/api'

export interface BackendPartner {
  id: string
  legalName: string
  partnerType: string
  state: string
  town: string
  status: string
  onboardedAt: string | null
  discontinuedAt: string | null
  dbCode: string | null
}

const base = '/api/partners'

export function listPartners(token: string | null): Promise<BackendPartner[]> {
  return apiGet(base, token)
}

export function getPartner(token: string | null, id: string): Promise<BackendPartner> {
  return apiGet(`${base}/${encodeURIComponent(id)}`, token)
}
