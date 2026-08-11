// Shared date-tenure helpers — how long a partner/distributor has been (or was) tied up with
// Acme Distribution, computed from an onboarding date against either now (still active) or a given end date
// (e.g. when they deboarded), so a discontinued partner's tenure reflects when they actually left.
export function tenureYears(startStr: string, endStr?: string): number {
  const end = endStr ? new Date(endStr).getTime() : Date.now()
  const ms = end - new Date(startStr).getTime()
  return ms / (365.25 * 24 * 3600 * 1000)
}

export function tenureLabel(startStr: string, endStr?: string): string {
  const yrs = tenureYears(startStr, endStr)
  return yrs < 1 ? `${Math.max(1, Math.round(yrs * 12))} mo` : `${yrs.toFixed(1)} yrs`
}

export type TenureBucket = '<1yr' | '1-3yr' | '3-5yr' | '5yr+'
export function tenureBucket(startStr: string, endStr?: string): TenureBucket {
  const yrs = tenureYears(startStr, endStr)
  if (yrs < 1) return '<1yr'
  if (yrs < 3) return '1-3yr'
  if (yrs < 5) return '3-5yr'
  return '5yr+'
}
