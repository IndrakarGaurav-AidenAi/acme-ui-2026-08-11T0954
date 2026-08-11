// Candidate pipeline for New Application — replaces the old fixed DB1/DB2/DB3 slots.
import type { CandidateCard, CandidateStage } from '../types'
import { DEMO_PARTNERS } from './cases'

export const CANDIDATE_STAGES: { id: CandidateStage; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'approval_1', label: 'Approval 1' },
  { id: 'approval_2', label: 'Approval 2' },
  { id: 'active', label: 'Active' },
  { id: 'rejected', label: 'Rejected' },
]

// Ideal DB is the benchmark for the territory's coverage plan, not a real candidate.
// infraScore kept at 8.0 (not a perfect 10) — even the benchmark reflects a realistic, achievable
// distributor profile rather than a theoretical max. expectedAcmeTurnover follows the ~20.5%
// Acme-contribution ratio observed in real candidates (e.g. Suvarna: 41/200).
export const IDEAL_DB = { turnoverMonthly: 220, expectedAcmeTurnover: 45, coverageOutlets: 1200, infraScore: 8.0 }

// All candidates start life at "Open" — nothing has been evaluated yet when a case is first opened.
// Stage only moves forward when a human explicitly advances it from the Candidates step, after scoring.
export const INITIAL_CANDIDATES: CandidateCard[] = [
  {
    id: 'c1', name: 'Suvarna Agencies', town: 'Nashik', dbCategory: 'GT DB (with CSO/DSM)',
    turnoverMonthly: 200, expectedAcmeTurnover: 41, coverageOutlets: 1200,
    infraScore: 8.0, finEvalPct: 138, stage: 'open', confidencePct: 92, isBestMatch: true,
  },
  {
    id: 'c2', name: 'Om Sai Distributors', town: 'Nashik', dbCategory: 'GT DB (with CSO/DSM)',
    turnoverMonthly: 168, expectedAcmeTurnover: 32, coverageOutlets: 960,
    infraScore: 6.5, finEvalPct: 97, stage: 'open', confidencePct: 74,
  },
  {
    id: 'c3', name: 'Krishna Trading Co.', town: 'Nashik', dbCategory: 'Traders',
    turnoverMonthly: 140, expectedAcmeTurnover: 28, coverageOutlets: 800,
    infraScore: 7.0, finEvalPct: 83, stage: 'open', confidencePct: 61,
  },
]

// Business figures for the directory distributors, so the "Add a lead" picker can offer the
// SAME partners that appear in the Partner directory (keyed by their legal name).
export const LEAD_FIN: Record<string, { dbCategory: string; turnoverMonthly: number; expectedAcmeTurnover: number; coverageOutlets: number; infraScore: number; finEvalPct: number; confidencePct: number }> = {
  'Surat Stockists Pvt Ltd': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 190, expectedAcmeTurnover: 38, coverageOutlets: 1850, infraScore: 8, finEvalPct: 120, confidencePct: 90 },
  'Deccan Trade Links': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 168, expectedAcmeTurnover: 32, coverageOutlets: 960, infraScore: 6.5, finEvalPct: 97, confidencePct: 74 },
  'Malhotra Distributors': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 200, expectedAcmeTurnover: 41, coverageOutlets: 1200, infraScore: 8, finEvalPct: 138, confidencePct: 92 },
  'Godavari Traders': { dbCategory: 'Traders', turnoverMonthly: 150, expectedAcmeTurnover: 30, coverageOutlets: 900, infraScore: 7, finEvalPct: 100, confidencePct: 80 },
  'Deshmukh Enterprises': { dbCategory: 'GM Excl DB', turnoverMonthly: 120, expectedAcmeTurnover: 24, coverageOutlets: 780, infraScore: 6.5, finEvalPct: 90, confidencePct: 66 },
  'Andheri General Stores': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 260, expectedAcmeTurnover: 52, coverageOutlets: 1400, infraScore: 8.5, finEvalPct: 145, confidencePct: 94 },
  'Suvarna Agencies': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 200, expectedAcmeTurnover: 41, coverageOutlets: 1200, infraScore: 8, finEvalPct: 138, confidencePct: 92 },
  'Juhu Distributors': { dbCategory: 'GT DB (with CSO/DSM)', turnoverMonthly: 200, expectedAcmeTurnover: 40, coverageOutlets: 1050, infraScore: 7.5, finEvalPct: 120, confidencePct: 82 },
}
const leadSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// The "Add a lead" pool = distributor partners from the directory still awaiting onboarding.
// Excludes 'active' (already onboarded — appointing them again would be a duplicate application)
// and 'discontinued', so the picker and the Partner directory stay one and the same.
export const DIRECTORY_LEADS: CandidateCard[] = DEMO_PARTNERS
  .filter((p) => p.partnerType === 'distributor' && p.status === 'in_review' && LEAD_FIN[p.legalName])
  .map((p) => {
    const f = LEAD_FIN[p.legalName]
    return {
      id: `dist-${leadSlug(p.legalName)}`, name: p.legalName, town: p.town, dbCategory: f.dbCategory,
      turnoverMonthly: f.turnoverMonthly, expectedAcmeTurnover: f.expectedAcmeTurnover, coverageOutlets: f.coverageOutlets,
      infraScore: f.infraScore, finEvalPct: f.finEvalPct, stage: 'open' as const, confidencePct: f.confidencePct,
    }
  })
