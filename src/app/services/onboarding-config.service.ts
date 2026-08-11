// Wraps GET /api/config/onboarding (backend-springboot's OnboardingConfigController). Field names
// match OnboardingConfigService.OnboardingConfigDto exactly — see that file for the authoritative
// shape. Plain functions (not an Angular service class) so store.ts, which already holds the auth
// token, can call these directly without DI plumbing.
import { apiGet } from '../lib/api'

export interface BackendInfraItem {
  key: string
  label: string
}

export interface BackendOnboardingConfig {
  // e.g. REQUIRED_INVESTMENT (₹L, ~144.6), INFRA_THRESHOLD (~7.0) — see CaseController's /score
  // endpoint for the keys actually read; the map is open-ended server-side config, not a fixed set.
  thresholds: Record<string, number>
  dbCategories: string[]
  infraItems: BackendInfraItem[]
}

const base = '/api/config/onboarding'

export function getOnboardingConfig(token: string | null): Promise<BackendOnboardingConfig> {
  return apiGet(base, token)
}
