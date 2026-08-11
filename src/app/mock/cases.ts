import type { Candidate, CaseMessage, CaseRecord, Partner, SubmittedDocument } from '../types'
import { GTM_GENERATED_PARTNERS } from './gtmPartners'

// The candidate set the ASE/ASM submits for the demo Distributor case (Nashik).
export const DEMO_CANDIDATES: Candidate[] = [
  { slot: 1, name: 'DB 1 — Malhotra Distributors', town: 'Nashik', turnoverMonthly: 200, coverageOutlets: 420, infraScore: 8.6, financialScore: 8.2, isRecommended: true, confidencePct: 92 },
  { slot: 2, name: 'DB 2 — Sai Traders', town: 'Nashik', turnoverMonthly: 168, coverageOutlets: 360, infraScore: 7.4, financialScore: 7.8, isRecommended: false, confidencePct: 74 },
  { slot: 3, name: 'DB 3 — Gokul Enterprises', town: 'Nashik', turnoverMonthly: 140, coverageOutlets: 300, infraScore: 6.8, financialScore: 6.5, isRecommended: false, confidencePct: 61 },
]

// Approvals queue — ingested from the Onboarding_Pipeline sheet (RCPL_Distributor_Onboarding_Dataset.xlsx),
// 10 in-flight/closed onboarding cases across the pipeline's auto-clear, review and terminal stages.
// confidencePct means "likelihood to auto-clear" everywhere in the app (see New Application's
// outcome prediction) — derived here from each row's Financial_Evaluation_Pct and
// Channel_Mgmt_Evaluation_Score, penalized for SLA risk; auto-cleared/closed cases sit high,
// flagged cases sit below the auto-clear bar, further down the worse their SLA position.
export const QUEUE_CASES: CaseRecord[] = [
  { code: 'CMP-2265', partnerName: 'Ganga Traders', partnerType: 'distributor', town: 'Surat', state: 'GJ', subtype: 'additional', status: 'auto_cleared', ownerRole: 'ase_asm', slaLabel: '—', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 97, flagDetail: 'Clean case — both evaluations passed; no human review required.' },
  { code: 'CMP-2312', partnerName: 'Om Sai Distributors', partnerType: 'distributor', town: 'Pune', state: 'MH', subtype: 'new', status: 'auto_cleared', ownerRole: 'ase_asm', slaLabel: '—', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 98, flagDetail: 'Clean case — both evaluations passed; no human review required.' },
  { code: 'CMP-2291', partnerName: 'Suvarna Agencies', partnerType: 'distributor', town: 'Nashik', state: 'MH', subtype: 'replacement', status: 'flagged', ownerRole: 'finance', slaLabel: '6h left', isOverdue: false, hasDiscontinuationForm: true, confidencePct: 45, flagDetail: 'Financial Evaluation 82% vs. 100% required — combined funds fall short of coverage-plan investment; Channel Management Evaluation passed.' },
  { code: 'CMP-2299', partnerName: 'Deccan Distributors', partnerType: 'distributor', town: 'Aurangabad', state: 'MH', subtype: 'new', status: 'flagged', ownerRole: 'channel_dev', slaLabel: '5h left', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 45, flagDetail: 'Channel Management Evaluation 6.4/10 vs. 7.0 benchmark — infrastructure/coverage below town requirement; Financial Evaluation passed.' },
  { code: 'CMP-2270', partnerName: 'Vindhya Traders', partnerType: 'distributor', town: 'Indore', state: 'MP', subtype: 'new', status: 'flagged', ownerRole: 'finance', slaLabel: 'Overdue', isOverdue: true, hasDiscontinuationForm: false, confidencePct: 25, flagDetail: 'Both evaluations failed — routes to Finance first, then Trade Marketing, per the sequential dual-fail rule.' },
  { code: 'CMP-2240', partnerName: 'Purbanchal Enterprises', partnerType: 'distributor', town: 'Siliguri', state: 'WB', subtype: 'new', status: 'rejected', ownerRole: 'leadership', slaLabel: '—', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 18, flagDetail: 'Rejected — funds shortfall exceeded acceptable variance and infrastructure did not meet minimum viable threshold on re-assessment.' },
  { code: 'CMP-2318', partnerName: 'Coastal Marketing Co.', partnerType: 'distributor', town: 'Visakhapatnam', state: 'AP', subtype: 'new', status: 'flagged', ownerRole: 'ase_asm', slaLabel: '—', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 50, flagDetail: 'ASM has not yet submitted the Recommendation Form for system evaluation.' },
  { code: 'CMP-2320', partnerName: 'Malabar Trading Co.', partnerType: 'distributor', town: 'Kochi', state: 'KL', subtype: 'new', status: 'flagged', ownerRole: 'ase_asm', slaLabel: '—', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 50, flagDetail: 'Candidate shortlisted; field visit scheduled — has not reached Recommendation Form stage.' },
  { code: 'CMP-2288', partnerName: 'Himalaya Distributors', partnerType: 'distributor', town: 'Ludhiana', state: 'PB', subtype: 'new', status: 'flagged', ownerRole: 'mdm', slaLabel: '2h left', isOverdue: false, hasDiscontinuationForm: false, confidencePct: 57, flagDetail: 'Both evaluations auto-cleared; awaiting MDM document verification.' },
  { code: 'CMP-2306', partnerName: 'Sahyadri Traders', partnerType: 'distributor', town: 'Bengaluru', state: 'KA', subtype: 'additional', status: 'flagged', ownerRole: 'mdm', slaLabel: 'Overdue', isOverdue: true, hasDiscontinuationForm: false, confidencePct: 39, flagDetail: 'GST document mismatch flagged by MDM — awaiting ASM clarification, past the 8-hour SLA.' },
]

// Every submitted document across all onboarding cases. Verification status reflects
// whether Document Intelligence is on for that case. Totals here drive the Documents
// screen's stat cards (42 total · 18 verified · 18 pending · 6 not-checked · 12 this week).
export const DEMO_DOCUMENTS: SubmittedDocument[] = [
  // CMP-2291 — Malhotra Distributors, Nashik (DI off — all optional/not checked)
  { id: 'd1', caseCode: 'CMP-2291', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2291.pdf', claimed: '27ABCPD1234K1Z5', status: 'not_checked', optional: true, uploadedOn: '12 May 2025', uploadedAt: '11:20 AM', thisWeek: true },
  { id: 'd2', caseCode: 'CMP-2291', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2291.pdf', claimed: 'ABCPD1234K', status: 'not_checked', optional: true, uploadedOn: '12 May 2025', uploadedAt: '11:20 AM', thisWeek: true },
  { id: 'd3', caseCode: 'CMP-2291', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2291.pdf', claimed: '4,500 sq ft — Nashik MIDC', status: 'not_checked', optional: true, uploadedOn: '12 May 2025', uploadedAt: '11:20 AM', thisWeek: true },
  // CMP-2265 — Surat Stockists, Surat
  { id: 'd4', caseCode: 'CMP-2265', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2265.pdf', claimed: '24AAECS5678H1Z2', extracted: '24AAECS5678H1Z2', status: 'verified', verifiedOn: '10 May 2025', uploadedOn: '10 May 2025', uploadedAt: '04:15 PM' },
  // VND-0417 — Krishna Packaging, Vadodara
  { id: 'd5', caseCode: 'VND-0417', partnerType: 'vendor', docName: 'ISO 9001', fileName: 'iso_9001_vnd0417.pdf', claimed: 'Valid to 2027', extracted: 'Valid to 2027', status: 'verified', verifiedOn: '08 May 2025', uploadedOn: '08 May 2025', uploadedAt: '09:30 AM' },
  // CMP-2288 — Sunrise Agencies, Pune
  { id: 'd6', caseCode: 'CMP-2288', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2288.pdf', claimed: '27AAFCS3456P1Z9', status: 'pending', uploadedOn: '13 May 2025', uploadedAt: '10:05 AM', thisWeek: true },
  { id: 'd7', caseCode: 'CMP-2288', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2288.pdf', claimed: '11522004000456', status: 'pending', uploadedOn: '13 May 2025', uploadedAt: '10:05 AM', thisWeek: true },
  { id: 'd8', caseCode: 'CMP-2288', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2288.pdf', claimed: '5,200 sq ft — Chakan MIDC', extracted: '5,200 sq ft — Chakan MIDC', status: 'verified', verifiedOn: '14 May 2025', uploadedOn: '13 May 2025', uploadedAt: '10:05 AM', thisWeek: true },
  // CMP-2280 — Deccan Trade Links, Nagpur
  { id: 'd9', caseCode: 'CMP-2280', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2280.pdf', claimed: '27AADCD7890Q1Z4', extracted: '27AADCD7890Q1Z4', status: 'verified', verifiedOn: '07 May 2025', uploadedOn: '06 May 2025', uploadedAt: '02:40 PM' },
  { id: 'd10', caseCode: 'CMP-2280', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2280.pdf', claimed: 'AADCD7890Q', extracted: 'AADCD7890Q', status: 'verified', verifiedOn: '07 May 2025', uploadedOn: '06 May 2025', uploadedAt: '02:40 PM' },
  { id: 'd11', caseCode: 'CMP-2280', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2280.pdf', claimed: 'Signed — 4 pp', status: 'pending', uploadedOn: '06 May 2025', uploadedAt: '02:40 PM' },
  // VND-0417 — Krishna Packaging (more)
  { id: 'd12', caseCode: 'VND-0417', partnerType: 'vendor', docName: 'GST', fileName: 'gst_vnd0417.pdf', claimed: '24AABCK9012L1Z3', extracted: '24AABCK9012L1Z3', status: 'verified', verifiedOn: '08 May 2025', uploadedOn: '08 May 2025', uploadedAt: '09:30 AM' },
  { id: 'd13', caseCode: 'VND-0417', partnerType: 'vendor', docName: 'Factory Audit Report', fileName: 'factory_audit_report_vnd0417.pdf', claimed: 'Grade A — 2024', status: 'pending', uploadedOn: '08 May 2025', uploadedAt: '09:30 AM' },
  { id: 'd14', caseCode: 'VND-0417', partnerType: 'vendor', docName: 'MSME', fileName: 'msme_vnd0417.pdf', claimed: 'UDYAM-GJ-06-0031892', status: 'pending', uploadedOn: '08 May 2025', uploadedAt: '09:30 AM' },
  // CMP-2265 — Surat Stockists (more)
  { id: 'd15', caseCode: 'CMP-2265', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2265.pdf', claimed: 'AAECS5678H', extracted: 'AAECS5678H', status: 'verified', verifiedOn: '10 May 2025', uploadedOn: '10 May 2025', uploadedAt: '04:15 PM' },
  { id: 'd16', caseCode: 'CMP-2265', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2265.pdf', claimed: '3,800 sq ft — Sachin GIDC', status: 'not_checked', optional: true, uploadedOn: '10 May 2025', uploadedAt: '04:15 PM' },
  // CMP-2312 — Godavari Traders, Nashik
  { id: 'd17', caseCode: 'CMP-2312', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2312.pdf', claimed: '27AAGCG2345R1Z7', status: 'pending', uploadedOn: '13 May 2025', uploadedAt: '09:15 AM', thisWeek: true },
  { id: 'd18', caseCode: 'CMP-2312', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2312.pdf', claimed: '10521998000123', extracted: '10521998000123', status: 'verified', verifiedOn: '14 May 2025', uploadedOn: '13 May 2025', uploadedAt: '09:15 AM', thisWeek: true },
  { id: 'd19', caseCode: 'CMP-2312', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2312.pdf', claimed: '2,900 sq ft — Ambad MIDC', status: 'pending', uploadedOn: '13 May 2025', uploadedAt: '09:15 AM', thisWeek: true },
  // CMP-2301 — Deshmukh Enterprises, Aurangabad
  { id: 'd20', caseCode: 'CMP-2301', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2301.pdf', claimed: '27AAHCD6789S1Z1', extracted: '27AAHCD6789S1Z1', status: 'verified', verifiedOn: '06 May 2025', uploadedOn: '05 May 2025', uploadedAt: '03:20 PM' },
  { id: 'd21', caseCode: 'CMP-2301', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2301.pdf', claimed: 'AAHCD6789S', status: 'pending', uploadedOn: '05 May 2025', uploadedAt: '03:20 PM' },
  { id: 'd22', caseCode: 'CMP-2301', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2301.pdf', claimed: 'Signed — 4 pp', status: 'pending', uploadedOn: '05 May 2025', uploadedAt: '03:20 PM' },
  // VND-0431 — Coastal Packaging, Panaji
  { id: 'd23', caseCode: 'VND-0431', partnerType: 'vendor', docName: 'GST', fileName: 'gst_vnd0431.pdf', claimed: '30AACCC1234M1Z6', extracted: '30AACCC1234M1Z6', status: 'verified', verifiedOn: '08 May 2025', uploadedOn: '07 May 2025', uploadedAt: '11:50 AM' },
  { id: 'd24', caseCode: 'VND-0431', partnerType: 'vendor', docName: 'MSME', fileName: 'msme_vnd0431.pdf', claimed: 'UDYAM-GA-01-0009123', status: 'pending', uploadedOn: '07 May 2025', uploadedAt: '11:50 AM' },
  { id: 'd25', caseCode: 'VND-0431', partnerType: 'vendor', docName: 'ISO 9001', fileName: 'iso_9001_vnd0431.pdf', claimed: 'Valid to 2026', status: 'pending', uploadedOn: '07 May 2025', uploadedAt: '11:50 AM' },
  // CMP-2276 — Suvarna Agencies, Nashik
  { id: 'd26', caseCode: 'CMP-2276', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2276.pdf', claimed: '27AAKCS4567T1Z8', extracted: '27AAKCS4567T1Z8', status: 'verified', verifiedOn: '05 May 2025', uploadedOn: '04 May 2025', uploadedAt: '10:30 AM' },
  { id: 'd27', caseCode: 'CMP-2276', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2276.pdf', claimed: 'AAKCS4567T', extracted: 'AAKCS4567T', status: 'verified', verifiedOn: '05 May 2025', uploadedOn: '04 May 2025', uploadedAt: '10:30 AM' },
  { id: 'd28', caseCode: 'CMP-2276', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2276.pdf', claimed: '3,300 sq ft — Sinnar MIDC', status: 'not_checked', optional: true, uploadedOn: '04 May 2025', uploadedAt: '10:30 AM' },
  // CMP-2259 — Juhu Distributors, Mumbai (fully verified)
  { id: 'd29', caseCode: 'CMP-2259', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2259.pdf', claimed: '27AALCJ8901U1Z2', extracted: '27AALCJ8901U1Z2', status: 'verified', verifiedOn: '04 May 2025', uploadedOn: '03 May 2025', uploadedAt: '04:45 PM' },
  { id: 'd30', caseCode: 'CMP-2259', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2259.pdf', claimed: '11523009000789', extracted: '11523009000789', status: 'verified', verifiedOn: '04 May 2025', uploadedOn: '03 May 2025', uploadedAt: '04:45 PM' },
  { id: 'd31', caseCode: 'CMP-2259', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2259.pdf', claimed: 'Signed — 5 pp', extracted: 'Signed — 5 pp', status: 'verified', verifiedOn: '04 May 2025', uploadedOn: '03 May 2025', uploadedAt: '04:45 PM' },
  // VND-0409 — Ganesh Supplies, Kolhapur
  { id: 'd32', caseCode: 'VND-0409', partnerType: 'vendor', docName: 'GST', fileName: 'gst_vnd0409.pdf', claimed: '27AAMCG5678V1Z5', status: 'pending', uploadedOn: '09 May 2025', uploadedAt: '01:10 PM' },
  { id: 'd33', caseCode: 'VND-0409', partnerType: 'vendor', docName: 'PAN', fileName: 'pan_vnd0409.pdf', claimed: 'AAMCG5678V', status: 'pending', uploadedOn: '09 May 2025', uploadedAt: '01:10 PM' },
  { id: 'd34', caseCode: 'VND-0409', partnerType: 'vendor', docName: 'Cancelled Cheque', fileName: 'cancelled_cheque_vnd0409.pdf', claimed: 'A/C ••6 4821', extracted: 'A/C ••6 4821', status: 'verified', verifiedOn: '10 May 2025', uploadedOn: '09 May 2025', uploadedAt: '01:10 PM' },
  // CMP-2333 — Andheri General Stores, Mumbai (fresh, awaiting)
  { id: 'd35', caseCode: 'CMP-2333', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2333.pdf', claimed: '27AANCA2109W1Z9', status: 'pending', uploadedOn: '14 May 2025', uploadedAt: '09:00 AM', thisWeek: true },
  { id: 'd36', caseCode: 'CMP-2333', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2333.pdf', claimed: '11524001000234', status: 'pending', uploadedOn: '14 May 2025', uploadedAt: '09:00 AM', thisWeek: true },
  { id: 'd37', caseCode: 'CMP-2333', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2333.pdf', claimed: '6,100 sq ft — Bhiwandi', status: 'pending', uploadedOn: '14 May 2025', uploadedAt: '09:00 AM', thisWeek: true },
  // CMP-2318 — Pune Metro Traders, Pune
  { id: 'd38', caseCode: 'CMP-2318', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2318.pdf', claimed: '27AAOCP3456X1Z3', extracted: '27AAOCP3456X1Z3', status: 'verified', verifiedOn: '03 May 2025', uploadedOn: '02 May 2025', uploadedAt: '12:25 PM' },
  { id: 'd39', caseCode: 'CMP-2318', partnerType: 'distributor', docName: 'PAN', fileName: 'pan_cmp2318.pdf', claimed: 'AAOCP3456X', extracted: 'AAOCP3456X', status: 'verified', verifiedOn: '03 May 2025', uploadedOn: '02 May 2025', uploadedAt: '12:25 PM' },
  { id: 'd40', caseCode: 'CMP-2318', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2318.pdf', claimed: 'Signed — 4 pp', status: 'not_checked', optional: true, uploadedOn: '02 May 2025', uploadedAt: '12:25 PM' },
  // VND-0422 — Nagpur Traders, Nagpur
  { id: 'd41', caseCode: 'VND-0422', partnerType: 'vendor', docName: 'GST', fileName: 'gst_vnd0422.pdf', claimed: '27AAPCN6789Y1Z6', status: 'pending', uploadedOn: '11 May 2025', uploadedAt: '05:05 PM' },
  { id: 'd42', caseCode: 'VND-0422', partnerType: 'vendor', docName: 'ISO 9001', fileName: 'iso_9001_vnd0422.pdf', claimed: 'Valid to 2028', status: 'pending', uploadedOn: '11 May 2025', uploadedAt: '05:05 PM' },
  // CMP-2340 — Bhavani Distributors, Nashik — happy path, every required doc verified
  { id: 'd43', caseCode: 'CMP-2340', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2340.pdf', claimed: '27AARCB6012Z1Z4', extracted: '27AARCB6012Z1Z4', status: 'verified', verifiedOn: '09 Jul 2026', uploadedOn: '08 Jul 2026', uploadedAt: '10:10 AM' },
  { id: 'd44', caseCode: 'CMP-2340', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2340.pdf', claimed: '11526007000456', extracted: '11526007000456', status: 'verified', verifiedOn: '09 Jul 2026', uploadedOn: '08 Jul 2026', uploadedAt: '10:10 AM' },
  { id: 'd45', caseCode: 'CMP-2340', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2340.pdf', claimed: '3,600 sq ft — Ambad MIDC', extracted: '3,600 sq ft — Ambad MIDC', status: 'verified', verifiedOn: '09 Jul 2026', uploadedOn: '08 Jul 2026', uploadedAt: '10:10 AM' },
  { id: 'd46', caseCode: 'CMP-2340', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2340.pdf', claimed: 'Signed — 4 pp', extracted: 'Signed — 4 pp', status: 'verified', verifiedOn: '09 Jul 2026', uploadedOn: '08 Jul 2026', uploadedAt: '10:10 AM' },
  // CMP-2341 — Ekta Sales Corp., Pune — only 2 of 4 required docs on file, the rest genuinely missing
  { id: 'd47', caseCode: 'CMP-2341', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2341.pdf', claimed: '27AASCE7123A1Z9', extracted: '27AASCE7123A1Z9', status: 'verified', verifiedOn: '07 Jul 2026', uploadedOn: '06 Jul 2026', uploadedAt: '03:40 PM' },
  { id: 'd48', caseCode: 'CMP-2341', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2341.pdf', claimed: '11526009000789', status: 'pending', uploadedOn: '06 Jul 2026', uploadedAt: '03:40 PM' },
  // CMP-2344 — Vishwas Traders, Nagpur — MDM's document flaw is now resolved, all 4 on file
  { id: 'd49', caseCode: 'CMP-2344', partnerType: 'distributor', docName: 'GST Certificate', fileName: 'gst_certificate_cmp2344.pdf', claimed: '27AATCV8901B1Z2', extracted: '27AATCV8901B1Z2', status: 'verified', verifiedOn: '03 Jul 2026', uploadedOn: '01 Jul 2026', uploadedAt: '11:05 AM' },
  { id: 'd50', caseCode: 'CMP-2344', partnerType: 'distributor', docName: 'FSSAI License', fileName: 'fssai_license_cmp2344.pdf', claimed: '11526003000912', extracted: '11526003000912', status: 'verified', verifiedOn: '03 Jul 2026', uploadedOn: '02 Jul 2026', uploadedAt: '04:15 PM' },
  { id: 'd51', caseCode: 'CMP-2344', partnerType: 'distributor', docName: 'Godown Proof', fileName: 'godown_proof_cmp2344.pdf', claimed: '2,700 sq ft — MIDC Hingna', extracted: '2,700 sq ft — MIDC Hingna', status: 'verified', verifiedOn: '03 Jul 2026', uploadedOn: '02 Jul 2026', uploadedAt: '04:15 PM' },
  { id: 'd52', caseCode: 'CMP-2344', partnerType: 'distributor', docName: 'DB Onboarding Form', fileName: 'db_onboarding_form_cmp2344.pdf', claimed: 'Signed — 5 pp', extracted: 'Signed — 5 pp', status: 'verified', verifiedOn: '03 Jul 2026', uploadedOn: '02 Jul 2026', uploadedAt: '04:15 PM' },
]

// Partner (firm) behind each onboarding case — so a document row can show *whose* it is,
// not just the case code. Keyed by case code across every case in DEMO_DOCUMENTS.
export const CASE_PARTNER: Record<string, string> = {
  // Reconciled to the Onboarding_Pipeline-ingested QUEUE_CASES above — case codes that are
  // reused from the old seeded narrative now point at their real workbook partner name.
  'CMP-2291': 'Suvarna Agencies',
  'CMP-2265': 'Ganga Traders',
  'CMP-2288': 'Himalaya Distributors',
  'CMP-2312': 'Om Sai Distributors',
  'CMP-2318': 'Coastal Marketing Co.',
  'CMP-2299': 'Deccan Distributors',
  'CMP-2270': 'Vindhya Traders',
  'CMP-2240': 'Purbanchal Enterprises',
  'CMP-2320': 'Malabar Trading Co.',
  'CMP-2306': 'Sahyadri Traders',
  // Legacy demo entries — no longer referenced by QUEUE_CASES but kept so DEMO_DOCUMENTS rows
  // for these old case codes still resolve to a partner name (harmless if unused).
  'VND-0417': 'Krishna Packaging',
  'CMP-2280': 'Deccan Trade Links',
  'CMP-2301': 'Deshmukh Enterprises',
  'VND-0431': 'Coastal Packaging',
  'CMP-2276': 'Suvarna Agencies',
  'CMP-2259': 'Juhu Distributors',
  'VND-0409': 'Ganesh Supplies',
  'CMP-2333': 'Andheri General Stores',
  'VND-0422': 'Nagpur Traders',
  'CMP-2340': 'Bhavani Distributors',
  'CMP-2341': 'Ekta Sales Corp.',
  'CMP-2342': 'Vishwas Traders',
  'CMP-2343': 'Vishwas Traders',
  'CMP-2344': 'Vishwas Traders',
  'CMP-2345': 'Vishwas Traders',
}

export const DEMO_MESSAGES: CaseMessage[] = [
  { id: 'm1', authorRole: 'ase_asm', authorName: 'R. Malhotra', body: '3 other FMCG majors nearby, strong references from existing DBs.' },
  { id: 'm2', authorRole: 'finance', authorName: 'S. Iyer', body: 'CC limit is short of the ₹100L threshold. Need a top-up commitment in writing.', isNextReplier: true },
]

const DEMO_PARTNERS_BASE: Partner[] = [
  { id: 'p1', legalName: 'Surat Stockists Pvt Ltd', partnerType: 'distributor', state: 'GJ', town: 'Surat', status: 'active', onboardedAt: '15 Aug 2019' },
  { id: 'p2', legalName: 'Deccan Trade Links', partnerType: 'distributor', state: 'MH', town: 'Nagpur', status: 'in_review', onboardedAt: '12 Sep 2024' },
  { id: 'p3', legalName: 'Krishna Packaging', partnerType: 'vendor', state: 'GJ', town: 'Vadodara', status: 'in_review', onboardedAt: '02 Feb 2026' },
  // Discontinued 20 Jun 2026 — the vacated Kolhapur beat is exactly what Ganpati Distributors'
  // replacement application (see mock/intake.ts email-ganesh) is proposing to take over.
  { id: 'p4', legalName: 'Ganesh Distributors', partnerType: 'distributor', state: 'MH', town: 'Kolhapur', status: 'discontinued', onboardedAt: '20 Jan 2016', discontinuedAt: '20 Jun 2026' },
  { id: 'p5', legalName: 'Coastal Logistics Co', partnerType: 'logistics', state: 'GA', town: 'Panaji', status: 'active', onboardedAt: '07 Mar 2021' },
  // No longer tied to an open case — CMP-2291 (the Nashik replacement case) now belongs to
  // Suvarna Agencies (p10) per the ingested Onboarding_Pipeline data.
  { id: 'p6', legalName: 'Malhotra Distributors', partnerType: 'distributor', state: 'MH', town: 'Nashik', status: 'active', onboardedAt: '01 Dec 2023' },
  // Active DBs that also appear in the Grievances queue — kept here so every grievance's
  // distributor exists in the directory (grievances are matched to partners by name).
  { id: 'p7', legalName: 'Godavari Traders', partnerType: 'distributor', state: 'MH', town: 'Nashik', status: 'active', onboardedAt: '14 Nov 2022' },
  { id: 'p8', legalName: 'Deshmukh Enterprises', partnerType: 'distributor', state: 'MH', town: 'Aurangabad', status: 'active', onboardedAt: '05 Jun 2018' },
  { id: 'p9', legalName: 'Andheri General Stores', partnerType: 'distributor', state: 'MH', town: 'Mumbai', status: 'active', onboardedAt: '20 Oct 2025' },
  // Status updated to in_review — Suvarna Agencies is also the subject of the live CMP-2291
  // replacement case above (Onboarding_Pipeline), currently sitting with Finance.
  { id: 'p10', legalName: 'Suvarna Agencies', partnerType: 'distributor', state: 'MH', town: 'Nashik', status: 'in_review', onboardedAt: '25 Mar 2019' },
  { id: 'p11', legalName: 'Juhu Distributors', partnerType: 'distributor', state: 'MH', town: 'Mumbai', status: 'active', onboardedAt: '22 Apr 2021' },
  // Three demo onboarding scenarios — happy path, missing documents, and many flaws (see the
  // matching QUEUE_CASES entries above for the full case history behind each).
  { id: 'p12', legalName: 'Bhavani Distributors', partnerType: 'distributor', state: 'MH', town: 'Nashik', status: 'active', onboardedAt: '09 Jul 2026' },
  { id: 'p13', legalName: 'Ekta Sales Corp.', partnerType: 'distributor', state: 'MH', town: 'Pune', status: 'in_review', onboardedAt: '06 Jul 2026' },
  { id: 'p14', legalName: 'Vishwas Traders', partnerType: 'distributor', state: 'MH', town: 'Nagpur', status: 'in_review', onboardedAt: '25 Jun 2026' },
  // Ingested from Onboarding_Pipeline (RCPL_Distributor_Onboarding_Dataset.xlsx) — one partner
  // row per new distributor candidate/DB in the replaced QUEUE_CASES above (Suvarna Agencies
  // already exists as p10, updated above, rather than duplicated here).
  { id: 'p15', legalName: 'Ganga Traders', partnerType: 'distributor', state: 'GJ', town: 'Surat', status: 'active', onboardedAt: '01 Jul 2026' },
  { id: 'p16', legalName: 'Om Sai Distributors', partnerType: 'distributor', state: 'MH', town: 'Pune', status: 'active', onboardedAt: '06 Jul 2026' },
  { id: 'p17', legalName: 'Deccan Distributors', partnerType: 'distributor', state: 'MH', town: 'Aurangabad', status: 'in_review', onboardedAt: '08 Jul 2026' },
  { id: 'p18', legalName: 'Vindhya Traders', partnerType: 'distributor', state: 'MP', town: 'Indore', status: 'in_review', onboardedAt: '04 Jul 2026' },
  // Rejected application — never went live; 'discontinued' is the closest existing status for
  // a candidate that didn't clear onboarding (Partner has no dedicated "rejected" status).
  { id: 'p19', legalName: 'Purbanchal Enterprises', partnerType: 'distributor', state: 'WB', town: 'Siliguri', status: 'discontinued', onboardedAt: '28 Jun 2026', discontinuedAt: '06 Jul 2026' },
  { id: 'p20', legalName: 'Coastal Marketing Co.', partnerType: 'distributor', state: 'AP', town: 'Visakhapatnam', status: 'in_review', onboardedAt: '09 Jul 2026' },
  { id: 'p21', legalName: 'Malabar Trading Co.', partnerType: 'distributor', state: 'KL', town: 'Kochi', status: 'in_review', onboardedAt: '11 Jul 2026' },
  { id: 'p22', legalName: 'Himalaya Distributors', partnerType: 'distributor', state: 'PB', town: 'Ludhiana', status: 'in_review', onboardedAt: '08 Jul 2026' },
  { id: 'p23', legalName: 'Sahyadri Traders', partnerType: 'distributor', state: 'KA', town: 'Bengaluru', status: 'in_review', onboardedAt: '07 Jul 2026' },
  // GTM Coverage's own full distributor roster (see gtmPartners.ts) — folded into the same
  // live Partners directory so the two screens' totals can't drift apart; GtmCoverage.tsx's
  // "actual" counts are computed from this array too (see actualDistributorsIn in gtm.ts).
  ...GTM_GENERATED_PARTNERS,
]

// DB Code — the stable business identifier Create Lead's "Replacement DB" picker looks existing
// distributors up by (see IntakeInbox.tsx). Assigned deterministically by position so it's
// stable across reloads; only distributors carry one (vendors/logistics don't have a "DB").
export const DEMO_PARTNERS: Partner[] = DEMO_PARTNERS_BASE.map((p, i) =>
  p.partnerType === 'distributor' ? { ...p, dbCode: `DB-${1001 + i}` } : p)
