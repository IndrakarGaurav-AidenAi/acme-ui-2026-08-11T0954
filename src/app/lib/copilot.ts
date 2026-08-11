import type { RoleCode, SubmittedDocument } from '../types'
import { CASE_PARTNER, DEMO_DOCUMENTS, DEMO_PARTNERS, QUEUE_CASES } from '../mock/cases'
import { PARTNER_TYPES, PARTNER_TYPE_BY_CODE, partnerTypeLabel } from '../mock/templates'
import { LEADS, LEADS_INSIGHT } from '../mock/leads'
import { INITIAL_GRIEVANCES } from '../mock/grievances'
import { INITIAL_THREADS } from '../mock/communication'
import { EXTRACTIONS } from '../mock/intake'
import { GTM_DATA } from '../mock/gtm'
import { AGENTS } from '../mock/agents'
import {
  ANALYTICS_INSIGHT, ANALYTICS_KPIS, DB_PERFORMANCE, DB_PERF_INSIGHT, OUTCOMES, OUTCOME_TOTAL,
  REJECTION_REASONS, TREND, dbAttainment, dbCoverage, dbGaps, dbStatus,
} from '../mock/analytics'
import { CANDIDATE_STAGES, IDEAL_DB, INITIAL_CANDIDATES, LEAD_FIN } from '../mock/candidates'
import { DISC_REASONS, INFRA_FACTORS, INFRA_THRESHOLD, RBL_APPROVAL_THRESHOLD, REQUIRED_INVESTMENT } from '../mock/onboarding'
import { ROLES } from '../mock/roles'

// Kept for backward compatibility with screens that "deep-link" into the copilot
// (Agents, Analytics, Approvals) — but the copilot itself is a single generalist now,
// not a set of named specialist agents the user has to pick between.
export type CopilotAgent = 'general' | 'recommendation' | 'evaluation' | 'document' | 'communication'

/* ------------------------------------------------------------------ */
/* Shared lookups & formatting                                         */
/* ------------------------------------------------------------------ */

const ROLE_LABEL = ROLES.reduce((acc, r) => { acc[r.code] = r.label; return acc }, {} as Record<RoleCode, string>)

const CASE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', auto_cleared: 'Auto-cleared', flagged: 'Flagged', approved: 'Approved', rejected: 'Rejected',
}
const SUBTYPE_LABEL: Record<string, string> = { new: 'new appointment', replacement: 'replacement', additional: 'additional DB' }

const bullets = (rows: string[]) => rows.map((r) => `• ${r}`).join('\n')
const cap = (s: string) => s.replace(/(^|\s)[a-z]/g, (ch) => ch.toUpperCase())
const num = (n: number) => n.toLocaleString('en-IN')

// Why each flagged case was flagged — the scripted demo narrative behind the queue.
const FLAG_REASON: Record<string, string> = {
  'CMP-2291': 'Financial Evaluation fell short — the CC limit (₹80L) is below the required ₹100L threshold, so (own funds + CC limit) ÷ required investment misses the 100% bar. Infra, coverage and references all cleared. Routed to Finance with an SLA timer.',
  'CMP-2288': 'Financial Evaluation shortfall — routed to Finance. GST and FSSAI verification are also still pending on the document side.',
  'CMP-2280': 'Channel Management Evaluation — the average infra score is still short of the 7.0 bar, even after the revised godown proof (5,200 sq ft). With Channel Development.',
  'VND-0417': 'MDM document check — 2 of 6 required vendor documents are missing (PAN and the Cancelled Cheque), so the case can\'t clear yet.',
}
const FLAG_SHORT: Record<string, string> = {
  'CMP-2291': 'CC limit below threshold',
  'CMP-2288': 'financial shortfall',
  'CMP-2280': 'infra score below 7.0',
  'VND-0417': 'missing documents',
}

const docLine = (d: SubmittedDocument) =>
  `${d.docName} — ${d.status === 'verified' ? `verified ${d.verifiedOn}` : d.status === 'pending' ? 'pending verification' : d.status === 'mismatch' ? 'MISMATCH: claimed vs extracted differ' : 'not checked (Document Intelligence off)'}`

const docsFor = (code: string) => DEMO_DOCUMENTS.filter((d) => d.caseCode === code)
const threadFor = (code: string) => INITIAL_THREADS.find((t) => t.code === code)
const stageLabel = (id: string) => CANDIDATE_STAGES.find((s) => s.id === id)?.label ?? id

// Light conversational memory so "why was it flagged?" after mentioning a case resolves.
let lastCase: string | null = null
let lastPartner: string | null = null

/* ------------------------------------------------------------------ */
/* Entity answers — case codes, grievances, leads, partners, towns     */
/* ------------------------------------------------------------------ */

function caseAnswer(code: string, q: string): string {
  lastCase = code
  const c = QUEUE_CASES.find((x) => x.code === code)
  const partner = c?.partnerName ?? CASE_PARTNER[code]
  const docs = docsFor(code)
  const thread = threadFor(code)
  if (!c && !partner) {
    const docOnly = Object.keys(CASE_PARTNER).filter((k) => !QUEUE_CASES.some((x) => x.code === k)).slice(0, 4)
    return `I can\'t find a case ${code}. Cases in the Approvals queue right now: ${QUEUE_CASES.map((x) => x.code).join(', ')} — plus document-stage records like ${docOnly.join(', ')}.`
  }

  const head = c
    ? `${code} — ${c.partnerName} · ${partnerTypeLabel(c.partnerType)} · ${c.town}, ${c.state} (${SUBTYPE_LABEL[c.subtype]})`
    : `${code} — ${partner}`

  const askDocs = /(doc|gst|pan|fssai|godown|iso|msme|cheque|upload|verif|paper|missing)/i.test(q)
  const askWhy = /(why|reason|flag|block|stuck|hold)/i.test(q)
  const askSla = /(sla|overdue|due|deadline|late|time left)/i.test(q)
  const askThread = /(thread|discuss|convers|message|repl|said|comm)/i.test(q)

  if (askWhy) {
    if (c?.financeSnapshot) {
      const fin = c.financeSnapshot
      return `${head}\nCapital available ₹${fin.capitalAvailable}L vs ₹${fin.requiredInvestment}L required (${fin.readinessPct}% readiness)${fin.fundingGap > 0 ? ` — ₹${fin.fundingGap}L short of the bar` : ''}.${c.flagDetail ? ` ${c.flagDetail}` : ''}${thread ? `\nLatest on the thread: "${thread.last}"` : ''}`
    }
    if (c?.flagDetail) return `${head}\n${c.flagDetail}${thread ? `\nLatest on the thread: "${thread.last}"` : ''}`
    if (FLAG_REASON[code]) return `${head}\n${FLAG_REASON[code]}${thread ? `\nLatest on the thread: "${thread.last}"` : ''}`
    if (c?.status === 'auto_cleared') return `${head}\nNothing is wrong — this case auto-cleared at ${c.confidencePct}% confidence. Both Financial and Channel Management evaluations passed, so no human review was needed.`
    if (c) return `${head}\nNo detailed flag reason is logged for this case — it\'s ${CASE_STATUS_LABEL[c.status].toLowerCase()}, with ${ROLE_LABEL[c.ownerRole]}.`
  }
  if (askDocs && docs.length) {
    const v = docs.filter((d) => d.status === 'verified').length
    const p = docs.filter((d) => d.status === 'pending').length
    const n = docs.filter((d) => d.status === 'not_checked').length
    // Compare uploads against the partner type's required-document template.
    const required = c ? PARTNER_TYPE_BY_CODE[c.partnerType].documents : []
    const notUploaded = required.filter((name) => !docs.some((d) => d.docName === name))
    const missing = notUploaded.length
      ? `\nRequired for this partner type but not yet uploaded: ${notUploaded.join(', ')}${FLAG_SHORT[code] === 'missing documents' ? ' — that\'s what\'s blocking the MDM document check' : ''}.`
      : ''
    return `${head}\n${docs.length} document${docs.length === 1 ? '' : 's'} on file — ${v} verified, ${p} pending, ${n} not checked:\n${bullets(docs.map(docLine))}${missing}${n ? '\nNot-checked items are optional because Document Intelligence is off for this case — it can be enabled on the Evaluate step.' : ''}`
  }
  if (askSla && c) {
    const next = thread?.participants.find((m) => m.isNextReplier)
    return c.isOverdue
      ? `${head}\nThis case is OVERDUE — it\'s with ${ROLE_LABEL[c.ownerRole]} and the SLA timer has expired.${next ? ` ${next.authorName} (${ROLE_LABEL[next.authorRole]}) owes the next reply.` : ''} Auto-notify on SLA breach can be toggled in Admin & Settings.`
      : `${head}\nSLA: ${c.slaLabel === '—' ? 'no timer — the case isn\'t waiting on anyone' : `${c.slaLabel}, currently with ${ROLE_LABEL[c.ownerRole]}`}.`
  }
  if (askThread && thread) {
    const next = thread.participants.find((m) => m.isNextReplier)
    return `${head}\nDiscussion so far:\n${bullets(thread.participants.map((m) => `${m.authorName} (${ROLE_LABEL[m.authorRole]}): "${m.body}"`))}\n${next ? `${next.authorName} (${ROLE_LABEL[next.authorRole]}) is next to reply — the Communication Agent has already notified them.` : 'Nobody is pending a reply on this thread.'}`
  }

  // Default: a compact brief across status, reason, documents, thread and confidence.
  const lines: string[] = []
  if (c) {
    lines.push(`Status: ${CASE_STATUS_LABEL[c.status]} — with ${ROLE_LABEL[c.ownerRole]} · SLA: ${c.slaLabel}`)
    const shortWhy = FLAG_SHORT[code] ?? c.flagDetail?.split(' — ')[0]
    if ((c.status === 'flagged' || c.status === 'approved') && shortWhy) lines.push(`Why: ${shortWhy} — ask "why" for the full picture`)
    lines.push(`Confidence to clear: ${c.confidencePct}%`)
    if (c.subtype === 'replacement') lines.push('Replacement case — the outgoing DB\'s Discontinuation Form (DB-1187, Ramesh Distributors) is on file')
  }
  if (docs.length) {
    const v = docs.filter((d) => d.status === 'verified').length
    const p = docs.filter((d) => d.status === 'pending').length
    lines.push(`Documents: ${docs.length} on file — ${v} verified, ${p} pending verification`)
  }
  const next = thread?.participants.find((m) => m.isNextReplier)
  if (next) lines.push(`Next to reply: ${next.authorName} (${ROLE_LABEL[next.authorRole]}) — "${thread!.last}"`)
  return `${head}\n${bullets(lines)}\nAsk me about its documents, SLA or discussion for the detail.`
}

function grievanceAnswer(id: string, q: string): string {
  const g = INITIAL_GRIEVANCES.find((x) => x.id === id)
  if (!g) {
    const open = INITIAL_GRIEVANCES.filter((x) => x.status !== 'resolved')
    return `I can\'t find ${id}. Grievances currently open or in progress: ${open.map((x) => `${x.id} (${x.distributor})`).join(', ')}.`
  }
  if (/resolve|close|fix/i.test(q) && g.status !== 'resolved') {
    return `${g.id} (${g.distributor} — "${g.subject}") is ${g.status === 'open' ? 'open' : 'in progress'} with ${ROLE_LABEL[g.ownerRole]}. To resolve it, open the Grievances queue, pick the item and set its status — the update is stamped onto the grievance timeline and reflected on the distributor\'s 360° profile.`
  }
  const last = g.updates[g.updates.length - 1]
  return `${g.id} — ${g.subject}\n${bullets([
    `Raised by ${g.distributor} (${g.town}) via ${g.channel.toLowerCase()} on ${g.raisedOn} — ${g.ageDays} days old`,
    `Category: ${g.category} · Priority: ${g.priority} · Status: ${g.status === 'in_progress' ? 'in progress' : g.status}${g.isOverdue ? ' · OVERDUE' : ` · SLA: ${g.slaLabel}`}`,
    `Owned by ${ROLE_LABEL[g.ownerRole]}`,
    `Detail: ${g.detail}`,
    ...(last ? [`Latest update (${last.on}): ${last.by} — ${last.note}`] : []),
  ])}`
}

function leadAnswer(id: string): string {
  const l = LEADS.find((x) => x.id === id)
  if (!l) return `I can\'t find ${id}. Live leads right now: ${LEADS.map((x) => `${x.id} (${x.town} — ${x.gapType.toLowerCase()})`).join(', ')}.`
  return `${l.id} — ${l.town}, ${l.state} · ${l.gapType} (${l.gapPct}% gap · ${l.confidence}% confidence)\n${l.signal}\nMatched distributors:\n${bullets(l.matched.map((m) => `${m.agency} (${m.status}) — ${m.acmeTurnover}/mo to Acme Distribution · ${m.coverage} · ${m.headroom} headroom. ${m.note}`))}\nSuggested action: ${l.action}`
}

// keyword → lookup key; ordered so the more specific firm wins ("pune metro" before "metro").
const PARTNER_KEYWORDS: { re: RegExp; key: string }[] = [
  { re: /suvarna/i, key: 'suvarna' },
  { re: /malhotra distributors|malhotra('s)? (case|firm)|\bmalhotra\b(?! \(as)/i, key: 'malhotra' },
  { re: /godavari/i, key: 'godavari' },
  { re: /deccan/i, key: 'deccan' },
  { re: /sunrise/i, key: 'sunrise' },
  { re: /surat stockists|stockists/i, key: 'surat stockists' },
  { re: /krishna packaging/i, key: 'krishna packaging' },
  { re: /krishna trading/i, key: 'krishna trading' },
  { re: /deshmukh/i, key: 'deshmukh' },
  { re: /andheri general|andheri stores/i, key: 'andheri general' },
  { re: /juhu/i, key: 'juhu' },
  { re: /pune metro/i, key: 'pune metro' },
  { re: /metro trade|metro combines/i, key: 'metro trade' },
  { re: /ganesh suppl/i, key: 'ganesh supplies' },
  { re: /ganesh/i, key: 'ganesh' },
  { re: /coastal packaging/i, key: 'coastal packaging' },
  { re: /coastal/i, key: 'coastal logistics' },
  { re: /nagpur traders/i, key: 'nagpur traders' },
  { re: /om sai/i, key: 'om sai' },
  { re: /bhavani/i, key: 'bhavani' },
  { re: /ekta/i, key: 'ekta' },
  { re: /vishwas/i, key: 'vishwas' },
]

function partnerAnswer(key: string, q: string): string {
  const has = (s: string) => s.toLowerCase().includes(key)
  const dir = DEMO_PARTNERS.find((p) => has(p.legalName))
  const perf = DB_PERFORMANCE.find((d) => has(d.name))
  const qc = QUEUE_CASES.find((c) => has(c.partnerName))
  const caseCode = qc?.code ?? Object.entries(CASE_PARTNER).find(([, n]) => has(n))?.[0]
  const grievances = INITIAL_GRIEVANCES.filter((g) => has(g.distributor))
  const cand = INITIAL_CANDIDATES.find((c) => has(c.name))
  const display = dir?.legalName ?? perf?.name ?? qc?.partnerName ?? cand?.name ?? (caseCode ? CASE_PARTNER[caseCode] : undefined)
  if (!display) return fallback(q)
  lastPartner = key

  // Financial questions about a partner must answer with THAT partner's own numbers —
  // never the generic Financial Evaluation walkthrough (which is scripted around CMP-2291).
  // A partner can have several cases over time, so search all of them for the financially-
  // relevant one rather than assuming the first (which may be about docs/infra instead).
  if (/(financ|own funds|cc limit|credit limit|capital|funding|investment required)/i.test(q)) {
    const partnerCases = QUEUE_CASES.filter((c) => has(c.partnerName))
    const finCase = partnerCases.find((c) => c.financeSnapshot) ?? partnerCases.find((c) => c.flagDetail && /financ|capital|fund/i.test(c.flagDetail))
    if (finCase?.financeSnapshot) {
      const fin = finCase.financeSnapshot
      return `${display} — Financial Evaluation (${finCase.code})\nCapital available ₹${fin.capitalAvailable}L vs ₹${fin.requiredInvestment}L required (${fin.readinessPct}% readiness)${fin.fundingGap > 0 ? ` — ₹${fin.fundingGap}L short of the bar` : ' — clears the bar'}.${finCase.flagDetail ? `\n${finCase.flagDetail}` : ''}`
    }
    if (finCase?.flagDetail) return `${display} — Financial Evaluation (${finCase.code})\n${finCase.flagDetail}`
    const legacyCase = partnerCases.find((c) => FLAG_REASON[c.code] && /financ/i.test(FLAG_REASON[c.code]))
    if (legacyCase) return `${display} — Financial Evaluation\n${FLAG_REASON[legacyCase.code]}`
    const finPct = cand?.finEvalPct ?? LEAD_FIN[display]?.finEvalPct
    if (finPct !== undefined) {
      return `${display}\'s Financial Evaluation score is ${finPct}% (pass bar is 100% — (own funds + CC limit) ÷ required investment).${finPct >= 100 ? ' It clears the bar.' : ' It\'s short of the bar.'}${qc ? `\nCurrent case ${qc.code}: ${CASE_STATUS_LABEL[qc.status]} with ${ROLE_LABEL[qc.ownerRole]}.` : ''}`
    }
    return `I don\'t have a Financial Evaluation on file for ${display} yet${qc ? ` — case ${qc.code} is still ${CASE_STATUS_LABEL[qc.status].toLowerCase()}` : ' — no case for them has reached the Evaluate step'}. Ask "how does Financial Evaluation work?" for the criteria.`
  }

  // Case-flavored questions about a partner route straight into their case.
  if (caseCode && /(case|flag|why|approv|sla|overdue|status|doc|verif|thread|discuss|repl)/i.test(q)) return caseAnswer(caseCode, q)
  if (grievances.length && /(grievance|complaint|issue|ticket)/i.test(q)) {
    return `${display} has ${grievances.length} grievance${grievances.length === 1 ? '' : 's'} on record:\n${bullets(grievances.map((g) => `${g.id} — "${g.subject}" · ${g.category} · ${g.status === 'in_progress' ? 'in progress' : g.status}${g.isOverdue ? ' · OVERDUE' : ''}`))}\nAsk me about any of them by ID for the timeline.`
  }

  const lines: string[] = []
  if (dir) lines.push(`Directory: ${partnerTypeLabel(dir.partnerType)} · ${dir.town}, ${dir.state} · ${dir.status === 'in_review' ? 'In review' : cap(dir.status)}`)
  if (cand) lines.push(`Pipeline: ${stageLabel(cand.stage)} candidate for ${cand.town} — ₹${cand.turnoverMonthly}L/mo turnover, ${num(cand.coverageOutlets)} outlets, infra ${cand.infraScore}/10, fin-eval ${cand.finEvalPct}%${cand.isBestMatch ? ` · the Recommendation Agent\'s best match at ${cand.confidencePct}% confidence` : ''}`)
  else if (LEAD_FIN[display]) lines.push(`Financials on file: ₹${LEAD_FIN[display].turnoverMonthly}L/mo turnover, ${num(LEAD_FIN[display].coverageOutlets)} outlets, infra ${LEAD_FIN[display].infraScore}/10, fin-eval ${LEAD_FIN[display].finEvalPct}%`)
  if (qc) lines.push(`Open case ${qc.code}: ${CASE_STATUS_LABEL[qc.status]} with ${ROLE_LABEL[qc.ownerRole]} · SLA ${qc.slaLabel}${FLAG_SHORT[qc.code] ? ` — ${FLAG_SHORT[qc.code]}` : ''}`)
  if (perf) {
    lines.push(`Performance: ₹${perf.acmeTurnover}L/mo vs ₹${perf.acmeTarget}L plan (${dbAttainment(perf)}%) · ${num(perf.outlets)} of ${num(perf.outletTarget)} outlets (${dbCoverage(perf)}%) · ${perf.growthMoM > 0 ? '+' : ''}${perf.growthMoM}% MoM · fill rate ${perf.fillRate}%`)
    const gaps = dbGaps(perf)
    const st = dbStatus(perf)
    lines.push(`Health: ${st === 'at_risk' ? 'At risk' : st === 'watch' ? 'Watch' : 'On track'}${gaps.length ? ` — ${gaps.join(' · ')}` : ''}`)
  }
  const openG = grievances.filter((g) => g.status !== 'resolved')
  if (grievances.length) lines.push(openG.length ? `Grievances: ${openG.map((g) => `${g.id} "${g.subject}"${g.isOverdue ? ' (OVERDUE)' : ''}`).join('; ')}` : 'Grievances: none open — past items resolved')
  const docs = caseCode ? docsFor(caseCode) : []
  if (docs.length) lines.push(`Documents on ${caseCode}: ${docs.length} on file — ${docs.filter((d) => d.status === 'verified').length} verified, ${docs.filter((d) => d.status === 'pending').length} pending`)
  return `${display} — the 360° view:\n${bullets(lines)}\nThe full profile (turnover trend, documents, history) is in the Partners directory.`
}

const TOWNS = ['nashik', 'mumbai', 'pune', 'nagpur', 'surat', 'aurangabad', 'kolhapur', 'vadodara', 'panaji', 'ahmedabad', 'indore', 'bhopal', 'jaipur', 'jodhpur', 'lucknow', 'kanpur', 'chalisgaon']

function townAnswer(townRaw: string): string {
  const town = townRaw.toLowerCase()
  const lines: string[] = []
  for (const s of Object.values(GTM_DATA)) {
    for (const [cityName, city] of Object.entries(s.cities)) {
      if (cityName.toLowerCase().includes(town)) {
        lines.push(`GTM: ${cityName} is at ${city.actual}/${city.target} DBs vs plan${city.areas ? ` — ${Object.entries(city.areas).map(([a, ar]) => `${a} ${ar.actual}/${ar.target}`).join(', ')}` : ''}`)
      } else if (city.areas) {
        for (const [areaName, ar] of Object.entries(city.areas)) {
          if (areaName.toLowerCase().includes(town)) lines.push(`GTM: ${areaName} is at ${ar.actual}/${ar.target} DBs${ar.dbs.length ? ` — ${ar.dbs.map((d) => `${d.name} (${d.status})`).join(', ')}` : ' — no DBs appointed yet'}`)
        }
      }
    }
  }
  LEADS.filter((l) => l.town.toLowerCase().includes(town))
    .forEach((l) => lines.push(`Lead ${l.id}: ${l.gapType} — ${l.signal}`))
  QUEUE_CASES.filter((c) => c.town.toLowerCase().includes(town))
    .forEach((c) => lines.push(`Case ${c.code} (${c.partnerName}): ${CASE_STATUS_LABEL[c.status]} with ${ROLE_LABEL[c.ownerRole]} · SLA ${c.slaLabel}`))
  DB_PERFORMANCE.filter((d) => d.town.toLowerCase().includes(town))
    .forEach((d) => lines.push(`${d.name}: ₹${d.acmeTurnover}L/mo vs ₹${d.acmeTarget}L plan (${dbAttainment(d)}%)${dbGaps(d).length ? ` — ${dbGaps(d)[0]}` : ' — on track'}`))
  INITIAL_GRIEVANCES.filter((g) => g.status !== 'resolved' && g.town.toLowerCase().includes(town))
    .forEach((g) => lines.push(`Grievance ${g.id} (${g.distributor}): ${g.subject}${g.isOverdue ? ' — OVERDUE' : ''}`))
  if (!lines.length) return `Nothing live in ${cap(townRaw)} right now — no open cases, leads or grievances there. GTM Coverage has the full state → city → area drill-down if you want the plan numbers.`
  return `Here\'s what\'s live in ${cap(townRaw)}:\n${bullets(lines)}`
}

/* ------------------------------------------------------------------ */
/* Topic intents — scored, best match wins (ties go to the earlier)    */
/* ------------------------------------------------------------------ */

interface Intent {
  id: string
  strong: RegExp[]           // +3 each
  weak?: RegExp[]            // +1 each
  answer: (q: string) => string
}

const digest = (): string => {
  const flagged = QUEUE_CASES.filter((c) => c.status === 'flagged')
  const overdue = QUEUE_CASES.filter((c) => c.isOverdue)
  const intake = Object.values(EXTRACTIONS)
  const hi = intake.filter((e) => e.priority === 'high').length
  const unassigned = intake.filter((e) => !e.assignedTo || e.assignedTo === 'Unassigned').length
  const dups = intake.filter((e) => e.duplicate).length
  const openG = INITIAL_GRIEVANCES.filter((g) => g.status === 'open').length
  const progG = INITIAL_GRIEVANCES.filter((g) => g.status === 'in_progress').length
  const overdueG = INITIAL_GRIEVANCES.filter((g) => g.isOverdue && g.status !== 'resolved')
  const awaiting = INITIAL_THREADS.filter((t) => t.participants.some((m) => m.isNextReplier)).length
  const latest = TREND[TREND.length - 1]
  return `Here\'s your day at a glance:\n${bullets([
    `Approvals: ${flagged.length} flagged cases in the queue — ${overdue.map((c) => `${c.code} (${c.partnerName})`).join(', ')} ${overdue.length === 1 ? 'is' : 'are'} OVERDUE with Finance.`,
    `Intake: ${intake.length} items in the inbox — ${hi} high-priority, ${unassigned} unassigned, ${dups} possible duplicates to link.`,
    `Leads: ${LEADS.length} open — biggest is ${LEADS[0].town} (${LEADS[0].gapPct}% under its coverage plan).`,
    `Grievances: ${openG} open, ${progG} in progress — ${overdueG.map((g) => `${g.id} (${g.distributor})`).join(', ')} has breached SLA.`,
    `Threads: ${awaiting} case discussions are waiting on a reply.`,
    `Bigger picture: ${latest.total} applications in ${latest.month}, ${Math.round((latest.autoCleared / latest.total) * 100)}% auto-cleared, onboarding averaging 2.4 days.`,
  ])}\nAsk me about any of these by name or code and I\'ll go deeper.`
}

const INTENTS: Intent[] = [
  {
    id: 'thanks',
    strong: [/^(thanks|thank you|thx|ty|ok|okay|got it|great|cool|nice|awesome|perfect|super)[!. ]*$/i],
    answer: () => 'Anytime. If you want, I can catch you up on today, dig into a case, or check a territory next.',
  },
  {
    id: 'greeting',
    strong: [/^(hi|hello|hey|yo|namaste|good (morning|afternoon|evening))\b/i],
    answer: () => 'Hey — I\'m your Copilot. I can pull anything from across the platform: a case (try CMP-2291), a distributor (try Suvarna), a territory (try Nashik), documents, approvals, leads, grievances or the analytics. What do you want to look at?',
  },
  {
    id: 'identity',
    strong: [/who are you|what are you\b|are you (a )?(real|actual|human)|chatgpt|\bllm\b|scripted|are you (an )?ai/i],
    answer: () => 'I\'m the Acme Distribution Copilot — the assistant layer over the partner-onboarding platform. I answer from the same live data you see on the screens: the approvals queue, intake inbox, leads, documents, grievances, GTM plan and analytics. In this prototype my answers are grounded in the demo dataset.',
  },
  {
    id: 'help',
    strong: [/what can you (do|answer|help)|how can you help|capabilit|what do you know|help me|what all can|what should i ask/i],
    answer: () => `Ask me anything you\'d otherwise dig through a screen for:\n${bullets([
      'Cases — "Why was CMP-2291 flagged?", "What documents does CMP-2288 have?"',
      'Partners — "How is Suvarna Agencies doing?", "Does Godavari have grievances?"',
      'Territories — "What\'s happening in Nashik?", "How is GTM coverage vs target?"',
      'Process — "How does Financial Evaluation work?", "Who approves — RBL or SM?"',
      'Numbers — "What\'s this quarter\'s approval rate?", "What\'s driving rejections?"',
      'Or just: "Catch me up on today."',
    ])}`,
  },
  {
    id: 'digest',
    strong: [/catch me up|what('|’)s (new|happening|going on)|my day|today at a glance|morning brief|daily (summary|digest)|summar(y|ise|ize) (of )?(the |my )?day|what did i miss|status update/i],
    weak: [/\btoday\b/i],
    answer: digest,
  },
  {
    id: 'platform',
    strong: [/what is (this|the) (platform|app|tool|portal|system)|about (this|the) (platform|app|system)|platform overview|how does this (work|platform work)/i],
    answer: () => `This is Acme Distribution\'s partner onboarding & management platform. The flow runs left to right in the sidebar:\n${bullets([
      'Prospecting — Intake Inbox reads incoming enquiries, Leads surfaces coverage gaps, New Application runs the appointment wizard.',
      'Onboarding — Approvals holds the evaluation queue; Documents tracks every upload and its verification.',
      'Collaborate — Communication threads each case; Grievances is the distributor-support queue.',
      'Insights — Analytics, GTM Coverage and Reports.',
      'Manage — Partners directory, Templates (partner-type config), Admin & Settings, Audit Log.',
    ])}\nSeven AI agents do the heavy lifting — ask "which agents are running?" for the roster.`,
  },
  {
    id: 'agents-list',
    strong: [/(which|what|list|show|how many).*(ai )?agents?\b|ai agents|multi.?agent|agents? (are )?(running|online|active)/i],
    answer: () => `${AGENTS.length} agents run the platform — ${AGENTS.filter((a) => a.status === 'active').length} active, ${AGENTS.filter((a) => a.status === 'standby').length} on standby:\n${bullets(AGENTS.map((a) => `${a.label} — ${a.tagline}`))}\nAsk me about any one of them by name.`,
  },
  {
    id: 'agent-detail',
    strong: [/lead.?gen(eration)? agent/i, /intake agent/i, /recommendation agent/i, /evaluation agent/i, /routing( (&|and))? ?(compliance)? agent|compliance agent/i, /communication agent/i],
    answer: (q) => {
      const pick = [
        { re: /lead.?gen/i, id: 'lead_gen' }, { re: /intake/i, id: 'intake' }, { re: /recommendation/i, id: 'recommendation' },
        { re: /evaluation/i, id: 'evaluation' }, { re: /routing|compliance/i, id: 'routing' }, { re: /communication/i, id: 'communication' },
      ].find((p) => p.re.test(q))
      const a = AGENTS.find((x) => x.id === pick?.id)
      if (!a) return `The agents on the platform: ${AGENTS.map((x) => x.label).join(', ')}.`
      return `${a.label} (${a.status === 'active' ? 'active' : 'standby'})\n${a.detail}\nRecently:\n${bullets(a.recentActivity)}\nIts home is ${a.homeLabel.replace('Open ', '')} — everything it does also lands in the Audit Log.`
    },
  },
  {
    id: 'why-flagged-generic',
    strong: [/why.*(flag|blocked|stuck|held)|flagged|what('|’)s (wrong|blocking)/i],
    answer: () => {
      const flagged = QUEUE_CASES.filter((c) => c.status === 'flagged')
      if (!flagged.length) return 'Nothing is flagged in the Approvals queue right now.'
      return `I\'m not sure which case or partner you mean — ${flagged.length} case${flagged.length === 1 ? ' is' : 's are'} flagged right now:\n${bullets(flagged.map((c) => `${c.code} (${c.partnerName}) — ${FLAG_SHORT[c.code] ?? c.flagDetail?.split(' — ')[0] ?? 'under review'}`))}\nAsk me about any of them by code or partner name for the full reason.`
    },
  },
  {
    id: 'overdue-sla',
    strong: [/overdue|sla|breach|past due|deadline|running late|late cases?/i],
    answer: () => {
      const oc = QUEUE_CASES.filter((c) => c.isOverdue)
      const og = INITIAL_GRIEVANCES.filter((g) => g.isOverdue && g.status !== 'resolved')
      return `Two things have breached SLA right now:\n${bullets([
        ...oc.map((c) => `Case ${c.code} — ${c.partnerName} (${c.town}), with ${ROLE_LABEL[c.ownerRole]}. ${FLAG_SHORT[c.code] ?? ''}. Finance still needs a CC top-up commitment in writing.`),
        ...og.map((g) => `Grievance ${g.id} — ${g.distributor}: "${g.subject}", with ${ROLE_LABEL[g.ownerRole]}, ${g.ageDays} days old.`),
      ])}\nStill inside SLA: ${QUEUE_CASES.filter((c) => !c.isOverdue && c.status === 'flagged').map((c) => `${c.code} (${c.slaLabel})`).join(', ')}. Every case carries an SLA timer from the moment the Routing Agent assigns it; auto-notify on breach is configurable in Admin & Settings.`
    },
  },
  {
    id: 'queue-summary',
    strong: [/approvals? queue|what('|’)s in (the )?(approvals?|queue)|pending (cases|approvals?)|cases? (pending|open|in (the )?queue)|my queue|open cases|queue (status|summary)|how many cases/i],
    answer: () => {
      const flagged = QUEUE_CASES.filter((c) => c.status === 'flagged')
      return `${QUEUE_CASES.length} cases in Approvals — ${flagged.length} flagged, ${QUEUE_CASES.length - flagged.length} auto-cleared:\n${bullets(QUEUE_CASES.map((c) => `${c.code} — ${c.partnerName} (${c.town}) · ${CASE_STATUS_LABEL[c.status]} · with ${ROLE_LABEL[c.ownerRole]} · SLA ${c.slaLabel}${FLAG_SHORT[c.code] ? ` · ${FLAG_SHORT[c.code]}` : ''}`))}\nAsk about any code for the full brief.`
    },
  },
  {
    id: 'financial-eval',
    strong: [/financial eval|fin.?eval|own funds|cc limit|credit limit|financial (criteria|threshold|score|check)|investment required/i],
    answer: () => `Financial Evaluation passes when (own funds + CC limit) ÷ required investment ≥ 100%. Required investment for the demo territory is ₹${REQUIRED_INVESTMENT}L (inventory days + market credit + claims).\nExample — CMP-2291 (Malhotra Distributors): own funds ₹120L + CC limit ₹80L = ₹200L → 138%, comfortably past the ratio bar. But the CC-limit floor still catches it: ₹80L sits below the required ₹100L minimum, so it routes to Finance regardless of the ratio. Both sliders are on the Evaluate step — move them and the verdict recomputes live.\nAsk me about a specific partner (e.g. "Vishwas Traders' financials") to see their actual numbers instead of this example.`,
  },
  {
    id: 'infra-eval',
    strong: [/infra(structure)?( score| eval)?|channel management eval|8.?factor|infra threshold/i],
    answer: () => `Channel Management Evaluation scores ${INFRA_FACTORS.length} infrastructure factors, each 1–10:\n${bullets(INFRA_FACTORS.map((f) => f.label))}\nThe average must be ≥ ${INFRA_THRESHOLD.toFixed(1)} to pass. A candidate needs this AND Financial Evaluation to auto-clear — failing infra routes the case to Channel Development (that\'s what\'s holding CMP-2280, still short of the 7.0 bar).`,
  },
  {
    id: 'auto-clear',
    strong: [/auto.?(clear|approv)|automatic(ally)? (approv|clear)|approval matrix|how does (the )?evaluation work/i],
    answer: () => `Auto-clear means no human had to touch the case: the Evaluation Agent runs Financial Evaluation ((own funds + CC) ÷ required investment ≥ 100%) and Channel Management Evaluation (avg infra score ≥ ${INFRA_THRESHOLD.toFixed(1)}). Pass both → auto-cleared, like CMP-2265 (Surat Stockists, 95% confidence). Fail either → the Routing & Compliance Agent sends it to Finance, Channel Development or MDM with the exact reason and starts the SLA clock. ${OUTCOMES[0].pct}% of ${OUTCOME_TOTAL} applications auto-cleared last month.`,
  },
  {
    id: 'approval-authority',
    strong: [/\brbl\b|sm approval|who (approves|signs off)|approval authority|sign.?off|final approval/i],
    answer: () => `Approval authority follows expected Acme turnover: above ₹${RBL_APPROVAL_THRESHOLD}L/mo it goes to RBL; at or below, the SM signs off. The demo candidate (Suvarna Agencies, expected ₹41L/mo) lands with the SM. Flagged criteria are separate — those go to the owning function (Finance / Channel Development / MDM) before the final approval.`,
  },
  {
    id: 'rejections',
    strong: [/reject/i],
    answer: () => `Rejection rate is 7.2% and falling (−3.5% vs last month) — ${OUTCOMES[2].value} of ${OUTCOME_TOTAL} applications last month. Where they come from:\n${bullets(REJECTION_REASONS.map((r) => `${r.label} — ${r.sub} (${r.value} cases)`))}\nThe AI read on the trend: "${ANALYTICS_INSIGHT.headline}" ${ANALYTICS_INSIGHT.suggested}`,
  },
  {
    id: 'approval-rate',
    strong: [/approval rate|auto.?clear(ance)?.*(rate|%|percent)|resolved by ai|what (%|percent).*(clear|approv)/i],
    weak: [/this (month|quarter)/i],
    answer: () => `The auto-approval rate is 61% this quarter, up 12 points — driven by tighter ARC alignment in Gujarat and Maharashtra. The monthly view is even stronger: ${OUTCOMES[0].pct}% of June\'s ${OUTCOME_TOTAL} applications auto-cleared (${OUTCOMES[0].value} cases), with ${OUTCOMES[1].pct}% approved after review and ${OUTCOMES[2].pct}% rejected — and the rate has climbed every month since January.`,
  },
  {
    id: 'analytics-kpis',
    strong: [/analytics|kpis?|key metrics|how many applications|applications (this|last|in)|onboarding time|cycle time|avg(erage)? time|the numbers|metrics/i],
    answer: () => `The headline onboarding numbers (last 6 months):\n${bullets(ANALYTICS_KPIS.map((k) => `${k.label}: ${k.value} (${k.delta})`))}\nOutcome mix in June: ${OUTCOMES.map((o) => `${o.label} ${o.pct}%`).join(' · ')}. Volume has doubled since January (${TREND[0].total} → ${TREND[TREND.length - 1].total}) while onboarding time nearly halved.\nThe Analytics screen itself focuses on distributor performance — ask "which distributors are at risk?" for that view.`,
  },
  {
    id: 'db-at-risk',
    strong: [/at.?risk|underperform|below (target|plan)|(db|distributor) performance|who('|’)s (lagging|behind|slipping)|worst (db|distributor)|declining|falling behind|below plan/i],
    answer: () => {
      const atRisk = DB_PERFORMANCE.filter((d) => dbStatus(d) === 'at_risk')
      const watch = DB_PERFORMANCE.filter((d) => dbStatus(d) === 'watch')
      return `${DB_PERF_INSIGHT.headline}\nAt risk (${atRisk.length}):\n${bullets(atRisk.map((d) => `${d.name} (${d.town}) — ${dbAttainment(d)}% of turnover plan, ${dbCoverage(d)}% of coverage plan${d.growthMoM < 0 ? `, declining ${d.growthMoM}% MoM` : ''}`))}\nOn watch: ${watch.map((d) => d.name).join(', ')}.\n${DB_PERF_INSIGHT.suggested}`
    },
  },
  {
    id: 'db-best',
    strong: [/best (db|distributor|performer)|top (db|distributor|performer)|who('|’)s (doing|performing) (well|best)|strongest (db|distributor)/i],
    answer: () => {
      const sorted = [...DB_PERFORMANCE].sort((a, b) => dbAttainment(b) - dbAttainment(a))
      const top = sorted[0]
      return `${top.name} (${top.town}) leads the scorecard — ₹${top.acmeTurnover}L/mo against a ₹${top.acmeTarget}L plan (${dbAttainment(top)}% attainment), ${num(top.outlets)} outlets covered, +${top.growthMoM}% MoM, ${top.fillRate}% fill rate. Next best: ${sorted.slice(1, 3).map((d) => `${d.name} (${dbAttainment(d)}%)`).join(', ')}. The full scorecard is on Analytics under distributor performance.`
    },
  },
  {
    id: 'leads',
    strong: [/\blead(s)?\b|whitespace|coverage gap|turnover gap|opportunit|where.*(gap|expand)/i],
    answer: () => `${LEADS_INSIGHT}\n${bullets(LEADS.map((l) => `${l.id} — ${l.town}: ${l.gapType}, ${l.gapPct}% gap (${l.confidence}% confidence). ${l.action}`))}\nEach lead comes pre-matched to distributors already active in the area — ask about a lead by ID (e.g. LD-108) for the matches.`,
  },
  {
    id: 'gtm',
    strong: [/gtm|go.?to.?market|territory coverage|coverage (vs|against|plan)|state.?(wise|level) coverage|coverage picture/i],
    answer: () => {
      const states = Object.values(GTM_DATA)
      const totA = states.reduce((s, x) => s + x.actual, 0)
      const totT = states.reduce((s, x) => s + x.target, 0)
      return `GTM coverage is ${totA}/${totT} DBs vs plan (${Math.round((totA / totT) * 100)}%):\n${bullets(states.map((s) => `${s.name}: ${s.actual}/${s.target}${s.actual >= s.target ? ' — ahead of plan' : ''}`))}\nGujarat is the only state ahead of plan; UP and MP carry the biggest shortfalls. Drill state → city → area → DB on the GTM Coverage screen — the same data feeds the Leads engine.`
    },
  },
  {
    id: 'pipeline-stages',
    strong: [/stage|pipeline|open.*pending.*approval|kanban|candidate board/i],
    answer: () => {
      const byStage = CANDIDATE_STAGES.map((s) => `${s.label}: ${INITIAL_CANDIDATES.filter((c) => c.stage === s.id).map((c) => c.name).join(', ') || '—'}`)
      return `A candidate moves ${CANDIDATE_STAGES.map((s) => s.label).join(' → ')} — the stage reflects real progress through the wizard and only advances as each step clears; it\'s never set by hand.\nThe Nashik pipeline right now:\n${bullets(byStage)}\nSuvarna Agencies is the Recommendation Agent\'s best match at 92% confidence.`
    },
  },
  {
    id: 'ideal-db',
    strong: [/ideal db|benchmark/i],
    answer: () => `The Ideal DB is the benchmark for the territory\'s coverage plan, not a real candidate: ₹${IDEAL_DB.turnoverMonthly}L monthly turnover, ${num(IDEAL_DB.coverageOutlets)} outlets, ${IDEAL_DB.infraScore.toFixed(1)} infra score. Every candidate on the Recommend step is compared against it — Suvarna Agencies comes closest (₹200L · 1,200 outlets · 8.0 infra).`,
  },
  {
    id: 'recommendation',
    strong: [/recommend|best (match|candidate|fit)|rank(ing)?|who should (we|i) (pick|appoint)|compare.*candidates/i],
    answer: () => {
      const ranked = [...INITIAL_CANDIDATES].sort((a, b) => b.confidencePct - a.confidencePct)
      return `The Recommendation Agent ranks candidates on turnover, coverage and infra against the Ideal DB benchmark (₹${IDEAL_DB.turnoverMonthly}L · ${num(IDEAL_DB.coverageOutlets)} outlets · ${IDEAL_DB.infraScore.toFixed(1)} infra). Current ranking for Nashik:\n${bullets(ranked.map((c, i) => `${i + 1}. ${c.name} — ${c.confidencePct}% confidence · ₹${c.turnoverMonthly}L/mo · ${num(c.coverageOutlets)} outlets · infra ${c.infraScore}/10 · fin-eval ${c.finEvalPct}%${c.isBestMatch ? ' ← best match' : ''}`))}\nWhichever candidate you select on the Candidates step shows live in the comparison.`
    },
  },
  {
    id: 'new-application',
    strong: [/new application|start.*(application|case|onboarding|appointment)|how (do|to|can) (i|we) (create|start|add|submit|appoint)|the wizard|appointment process/i],
    answer: () => `New Application runs the appointment wizard end-to-end: Type → Leads → Intake → Recommend → Evaluate → Review → Agreement.\n${bullets([
      'Type — pick the partner type (Distributor has the full wizard; Vendor is configured, Logistics/Co-packer are coming soon).',
      'Leads — pick or add the candidate(s) to consider.',
      'Intake — the recommendation form, mirroring Acme Distribution\'s workbook field-for-field. A replacement case adds the Discontinuation step here.',
      'Recommend — the Recommendation Agent ranks candidates vs the Ideal DB.',
      'Evaluate — financial + infra scoring with live pass/fail; Document Intelligence can be toggled here.',
      'Review → Agreement — flagged criteria go to the owning function, then the case closes with an agreement.',
    ])}\nThe outcome prediction (confidence %) updates as you go.`,
  },
  {
    id: 'docs-required',
    strong: [/(what|which) documents?|documents? (are )?(required|needed|mandatory)|required documents?|docs? (for|do) (a |an )?(distributor|vendor|logistics|co.?packer|partner)/i],
    weak: [/gst|fssai|godown|onboarding form/i],
    answer: (q) => {
      const t = PARTNER_TYPES.find((x) => new RegExp(x.code === 'copacker' ? 'co.?packer' : x.code, 'i').test(q)) ?? PARTNER_TYPES[0]
      const others = PARTNER_TYPES.filter((x) => x.code !== t.code)
      return `For a ${t.label}${t.isActive ? '' : ' (coming soon)'}, the required documents are: ${t.documents.join(', ')}.\nWorkflow: ${t.workflow.join(' → ')}.\nOther types — ${others.map((x) => `${x.label}: ${x.documents.join(', ')}`).join(' · ')}.\nDocument requirements live in Templates — changing them is configuration, not a code change. Document Intelligence verification is optional and off by default.`
    },
  },
  {
    id: 'docs-status',
    strong: [/documents?.*(status|summary|pending|verified|how many)|verification status|doc(ument)? (stats|breakdown)|pending verification/i],
    answer: () => {
      const v = DEMO_DOCUMENTS.filter((d) => d.status === 'verified').length
      const p = DEMO_DOCUMENTS.filter((d) => d.status === 'pending').length
      const n = DEMO_DOCUMENTS.filter((d) => d.status === 'not_checked').length
      const wk = DEMO_DOCUMENTS.filter((d) => d.thisWeek).length
      const cases = new Set(DEMO_DOCUMENTS.map((d) => d.caseCode)).size
      return `${DEMO_DOCUMENTS.length} documents on file across ${cases} cases:\n${bullets([
        `Verified: ${v} — claimed and extracted values matched`,
        `Pending verification: ${p}`,
        `Not checked: ${n} — Document Intelligence is off for those cases (it\'s opt-in per case)`,
        `Uploaded this week: ${wk}`,
      ])}\nThe standout: VND-0417 (Krishna Packaging) is still missing GST and the Factory Audit Report entirely — that\'s blocking the MDM check. Fully-verified example: CMP-2259 (Juhu Distributors), all 3 docs green.`
    },
  },
  {
    id: 'doc-intelligence',
    strong: [/document intelligence|claimed vs extracted|auto.?match|\bocr\b|verify documents?|document verification/i],
    answer: () => 'Document Intelligence extracts GST, PAN and warehouse details from uploaded documents and checks them against the claimed values — matches turn green, mismatches get flagged for review. It\'s off by default (Acme Distribution doesn\'t verify subjective capacity claims) and is enabled per case on the Evaluate step. With it off, documents stay "not checked" and are treated as optional; with it on, they move through pending → verified/mismatch.',
  },
  {
    id: 'docs-missing',
    strong: [/missing (doc|document|paper)|awaiting documents?|incomplete (case|docs?)|documents? (still )?(missing|outstanding)|not (yet )?uploaded/i],
    answer: () => {
      const pending = DEMO_DOCUMENTS.filter((d) => d.status === 'pending')
      return `One case is blocked on genuinely missing uploads: VND-0417 (Krishna Packaging) — 2 of 6 required vendor documents haven\'t arrived (PAN and the Cancelled Cheque). K. Nair (MDM) can\'t clear the document check until they\'re in; the ASE is chasing the vendor.\nBeyond that, ${pending.length} uploaded documents across the pipeline are still pending verification — the biggest clusters are CMP-2288 (Sunrise) and CMP-2333 (Andheri General Stores). The Documents screen has the full list.`
    },
  },
  {
    id: 'intake-how',
    strong: [/how does (the )?intake|intake (work|agent|channel)|self.?signup|bulk upload|csv|spreadsheet|upload (a )?(file|sheet|excel)/i],
    weak: [/intake/i],
    answer: () => `The Intake Agent captures candidates from three channels: emails to a connected mailbox, uploaded documents (scanned forms, spreadsheets — there\'s a CSV template you can download from the Intake Inbox), and self-signup forms. For each item it extracts the structured fields (firm, contact, town, DB type, turnover claim, GST), scores its own confidence, flags missing fields and possible duplicates, and hands you a draft profile — you confirm, not retype. Confirmed drafts flow straight into New Application.`,
  },
  {
    id: 'intake-summary',
    strong: [/intake (inbox|summary|queue)|what('|’)s in (the )?(intake|inbox)|new (enquir|inquir)|unassigned|inbox (items|summary|status)/i],
    answer: () => {
      const items = Object.values(EXTRACTIONS)
      const emails = items.filter((e) => e.channel === 'email').length
      const docs = items.filter((e) => e.channel === 'document').length
      const hi = items.filter((e) => e.priority === 'high')
      const unassigned = items.filter((e) => !e.assignedTo || e.assignedTo === 'Unassigned').length
      const dups = items.filter((e) => e.duplicate).length
      return `${items.length} items in the Intake Inbox — ${emails} emails, ${docs} document uploads. ${hi.length} high-priority, ${unassigned} unassigned, ${dups} possible duplicates to link.\nWorth a look first:\n${bullets([
        'Metro Trade Combines (Mumbai) — complete, 95% confidence, ₹240L/mo across 2,600 outlets. Fast-track candidate.',
        'Suvarna Agencies (Nashik) — 91% confidence but a similar DB name is already active there; check the duplicate before creating a lead.',
        'Andheri General Stores — 58% confidence, almost everything missing; needs a full information request.',
      ])}`
    },
  },
  {
    id: 'connect-inbox',
    strong: [/connect.*(inbox|mailbox|gmail|outlook|email)|inbox.*(connect|watch|setup)|my settings|link my (email|inbox)/i],
    answer: () => 'Each ASE/ASM connects their own mailbox in My Settings — Gmail or Outlook. Once connected, the Intake Agent watches it and drafts a candidate profile from anything that arrives. The demo user has Outlook connected (rmalhotra@acme-field.in) with "auto-forward unmatched mail" on, so anything the agent can\'t parse still reaches a human. Disconnect any time from the same screen.',
  },
  {
    id: 'duplicates',
    strong: [/duplicate/i],
    answer: () => {
      const dups = Object.values(EXTRACTIONS).filter((e) => e.duplicate)
      return `The Intake Agent flags possible duplicates before they become leads — ${dups.length} are flagged right now:\n${bullets(dups.map((d) => `${d.title} — ${d.duplicate}`))}\nLinking them merges the records so a firm never gets onboarded twice.`
    },
  },
  {
    id: 'grievances',
    strong: [/grievance|complaint|distributor (issue|support|ticket)/i],
    answer: () => {
      const open = INITIAL_GRIEVANCES.filter((g) => g.status === 'open')
      const prog = INITIAL_GRIEVANCES.filter((g) => g.status === 'in_progress')
      const done = INITIAL_GRIEVANCES.filter((g) => g.status === 'resolved')
      const od = INITIAL_GRIEVANCES.find((g) => g.isOverdue && g.status !== 'resolved')
      return `${INITIAL_GRIEVANCES.length} grievances on the books — ${open.length} open, ${prog.length} in progress, ${done.length} resolved.${od ? ` The urgent one: ${od.id} (${od.distributor}) — "${od.subject}" has breached SLA with ${ROLE_LABEL[od.ownerRole]}.` : ''}\nOpen & in progress:\n${bullets([...open, ...prog].map((g) => `${g.id} — ${g.distributor}: "${g.subject}" · ${g.category} · ${g.priority} priority · with ${ROLE_LABEL[g.ownerRole]}`))}\nGrievances arrive via email, phone, portal or field visit, and each one also shows on the distributor\'s 360° profile. Ask about any ID for the timeline.`
    },
  },
  {
    id: 'communication',
    strong: [/communicat|thread|who.*(reply|respond|next)|next replier|discussion|nudge|case chat/i],
    weak: [/message|repl(y|ies)/i],
    answer: () => {
      const waiting = INITIAL_THREADS.filter((t) => t.participants.some((m) => m.isNextReplier))
      return `Case discussions are threaded per case — no email chains — and the Communication Agent auto-notifies whoever owes the next reply. Right now ${waiting.length} threads are waiting on someone:\n${bullets(waiting.map((t) => {
        const n = t.participants.find((m) => m.isNextReplier)!
        return `${t.code} (${t.partnerName}) — ${n.authorName} (${ROLE_LABEL[n.authorRole]}) is up: "${t.last}"`
      }))}\nYou can also nudge a partner directly from Approvals, Partners or their profile — it opens (or creates) a partner-facing thread.`
    },
  },
  {
    id: 'partners-directory',
    strong: [/partners? (directory|list)|how many partners|distributor directory|list.*(partners|distributors)|360|all (the )?partners/i],
    answer: () => {
      const byType = PARTNER_TYPES.map((t) => `${DEMO_PARTNERS.filter((p) => p.partnerType === t.code).length} ${t.label.split(' ')[0].toLowerCase()}${DEMO_PARTNERS.filter((p) => p.partnerType === t.code).length === 1 ? '' : 's'}`).filter((s) => !s.startsWith('0'))
      const active = DEMO_PARTNERS.filter((p) => p.status === 'active').length
      const review = DEMO_PARTNERS.filter((p) => p.status === 'in_review').length
      const disc = DEMO_PARTNERS.filter((p) => p.status === 'discontinued').length
      return `The Partners directory is the system of record: ${DEMO_PARTNERS.length} partners — ${byType.join(', ')} — of which ${active} active, ${review} in review, ${disc} discontinued.\nEvery partner has a 360° profile: turnover trend vs plan, documents, approval history, grievances and agent activity. Ask me about any partner by name (try "how is Suvarna doing?").`
    },
  },
  {
    id: 'templates',
    // Split patterns so "add a partner type" outscores the generic how-do-I intents.
    strong: [/partner type/i, /template/i, /add (a |another |new )?partner type|configure.*(type|workflow)/i, /logistics partner|co.?packer/i],
    weak: [/vendor/i],
    answer: () => {
      const live = PARTNER_TYPES.filter((t) => t.isActive)
      const soon = PARTNER_TYPES.filter((t) => !t.isActive)
      return `A partner type is configuration, not a code change — Templates maps each type to its required documents and approval workflow.\n${bullets([
        ...live.map((t) => `${t.label} — live. Docs: ${t.documents.join(', ')}. Workflow: ${t.workflow.join(' → ')}.`),
        ...soon.map((t) => `${t.label} — coming soon (${t.workflow[0].toLowerCase()}). Hidden from New Application until published.`),
      ])}\nTo add one: Templates → new partner type → map documents & workflow → publish. No deployment needed.`
    },
  },
  {
    id: 'roles-access',
    strong: [/role|permission|persona|who (can|has) (see|access)|access control|rbac|what does .* see/i],
    answer: () => `Six personas, each with a sidebar scoped to what they actually do:\n${bullets(ROLES.map((r) => `${r.label} — ${r.blurb}`))}\nAdmin & Settings manages personas and user access platform-wide; My Settings is for things scoped to you (like your inbox connection). You can also "view as" another persona from the top bar to see their experience.`,
  },
  {
    id: 'users-admin',
    strong: [/add (a )?user|manage users|deactivate|user (list|management|directory)|new (user|seat)/i],
    answer: () => 'User management lives in Admin & Settings: add a user with a name, email, role and region; edit or deactivate them from the same table. The demo org has 9 seats across the six roles — 8 active, 1 inactive (V. Rao, Finance). Deactivating keeps history intact; the seat just can\'t sign in.',
  },
  {
    id: 'audit',
    strong: [/audit/i],
    answer: () => 'The Audit Log records who did what and when across the whole platform — case submissions, agent decisions (with confidence), approvals and rejections, admin/config changes. Every AI-agent action is logged the same way a human\'s is, so any decision can be traced after the fact. It\'s under Manage in the sidebar (admin persona).',
  },
  {
    id: 'notifications',
    strong: [/notification|the bell|alerts?\b/i],
    answer: () => 'The bell in the top bar collects everything that needs your attention — overdue cases, thread replies, missing documents, grievance SLA breaches. Each notification deep-links to the exact record it\'s about. Right now there are 4: CMP-2291 overdue, a Trade Marketing reply on CMP-2280, MDM waiting on VND-0417\'s documents, and an overdue grievance.',
  },
  {
    id: 'reports',
    strong: [/report|export|download.*(pdf|excel|summary)|share.*(leadership|insight)/i],
    answer: () => 'Reports (under Insights) exports any analytics view as a shareable report for leadership — hit "Generate new report" and download as PDF or Excel. Already generated: "Q2 Coverage & Approval Summary" (PDF) and "June appointments by state" (Excel). For raw data entry the intake CSV template is downloadable from the Intake Inbox.',
  },
  {
    id: 'discontinuation',
    strong: [/replacement|discontinu|old db|\bndc\b|terminat/i],
    answer: () => `A replacement application requires the outgoing DB\'s Discontinuation Form before it can clear. The demo one: Ramesh Distributors (DB-1187, Nashik) — appointed Mar 2022, sales slid from ₹1.6L to ₹0.9L/mo avg, reason "Poor coverage & poor retailer relations", stock of ₹2.1L transferred to the new distributor, NDC submitted through Jun 2026.\nAccepted discontinuation reasons: ${DISC_REASONS.join('; ')}.\nApplication subtypes: new appointment, replacement (adds this form), and additional DB (needs a reason, e.g. a new beat).`,
  },
  {
    id: 'confidence',
    strong: [/confidence|likel(y|ihood)|prediction|how sure/i],
    answer: () => 'Confidence % means the same thing everywhere in the app: the predicted likelihood a case will auto-clear. It\'s computed from the same signals the Evaluation Agent scores — financial ratio, infra, coverage — so auto-cleared cases sit high (CMP-2265: 95%) and the further a flagged case is from clearing, the lower it drops (CMP-2291: 38%). On New Application it updates live as you fill the wizard.',
  },
  {
    id: 'definitions',
    strong: [/fill rate|ws contribution|wholesale contribution|what (is|does) .*(attainment|arc)\b|arc alignment/i],
    answer: () => 'Quick glossary: fill rate = the share of ordered stock actually delivered (service level). WS contribution = wholesale\'s share of a distributor\'s total business. Turnover attainment = actual Acme turnover ÷ plan. Coverage = outlets actively served ÷ planned outlets. ARC = the agreed commercial construct a candidate is evaluated against — tighter ARC alignment is what\'s been lifting the auto-clear rate.',
  },
  {
    id: 'draft-outreach',
    strong: [/draft|write (an? )?(email|outreach|message|note)|compose/i],
    answer: () => `Here\'s a draft for the biggest open gap (LD-108, Nashik City — 48% under its 1,200-outlet plan):\n\nSubject: Acme Distribution Staples distribution — Nashik City\n"Hi Mr. Suvarnkar — Acme Distribution\'s coverage plan for Nashik City is 1,200 outlets and we\'re currently well under plan. Given Suvarna Agencies\' reach and your experience with Britannia, Marico and ITC, we\'d like to discuss the Acme Distribution Staples portfolio for the city. Could we set up a call this week? — R. Malhotra, ASE (West)"\n\nSend it from Leads → LD-108 → draft outreach, and the Communication Agent will track the reply on the case thread.`,
  },
  {
    id: 'login-demo',
    strong: [/log ?in|log ?out|password|sign ?in|switch (role|persona|user)|view as|demo mode|scenario/i],
    answer: () => 'Sign-in is persona-based for the demo — pick any of the six roles on the Login screen, no password. Once in, the "viewing as" switcher in the top bar lets you see the platform through another persona\'s eyes without logging out. There\'s also a demo scenario toggle (clean vs flagged) that controls whether the walkthrough case sails through or gets flagged to Finance.',
  },
]

function bestIntent(q: string): string | null {
  let bestScore = 0
  let bestIdx = -1
  for (let i = 0; i < INTENTS.length; i++) {
    let s = 0
    for (const r of INTENTS[i].strong) if (r.test(q)) s += 3
    for (const r of INTENTS[i].weak ?? []) if (r.test(q)) s += 1
    if (s > bestScore) { bestScore = s; bestIdx = i }
  }
  return bestIdx >= 0 ? INTENTS[bestIdx].answer(q) : null
}

function fallback(q: string): string {
  void q
  return `I couldn\'t match that to anything specific — but I probably have the answer if you point me at it. Try:\n${bullets([
    'A case code — "Summarise CMP-2291" or "What documents does VND-0417 have?"',
    'A name — "How is Suvarna Agencies doing?" or "Does Godavari have grievances?"',
    'A place — "What\'s happening in Nashik?"',
    'A number — "What\'s this quarter\'s approval rate?" or "Which distributors are below plan?"',
    'A process — "How does Financial Evaluation work?" or "How do I add a partner type?"',
  ])}\nOr just say "catch me up on today".`
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

const CASE_CODE_RE = /\b(cmp|vnd)[\s-]?(\d{4})\b/i
const GRIEVANCE_RE = /\bgrv[\s-]?(\d{4})\b/i
const LEAD_RE = /\bld[\s-]?(\d{3})\b/i

export function answerFor(_agent: CopilotAgent, question: string): string {
  const q = question.trim()
  if (!q) return 'Ask me anything — a case, a distributor, a territory, or "catch me up on today".'

  const cm = q.match(CASE_CODE_RE)
  if (cm) return caseAnswer(`${cm[1].toUpperCase()}-${cm[2]}`, q)

  const gm = q.match(GRIEVANCE_RE)
  if (gm) return grievanceAnswer(`GRV-${gm[1]}`, q)

  const lm = q.match(LEAD_RE)
  if (lm) return leadAnswer(`LD-${lm[1]}`)

  const pk = PARTNER_KEYWORDS.find((p) => p.re.test(q))
  if (pk) return partnerAnswer(pk.key, q)

  // Pronoun follow-ups ("why was it flagged?") resolve against the last entity discussed.
  if (/\b(it|its|this case|that case|the case|this one|them|they)\b/i.test(q)) {
    if (lastCase) return caseAnswer(lastCase, q)
    if (lastPartner) return partnerAnswer(lastPartner, q)
  }

  const town = TOWNS.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(q))
  if (town && /(coverage|gap|territor|snapshot|overview|happening|going on|doing|performing|leads?|cases?|grievance|distributors?|dbs?|partners)/i.test(q)) {
    return townAnswer(town)
  }

  const intent = bestIntent(q)
  if (intent) return intent

  if (town) return townAnswer(town)
  return fallback(q)
}

/* ------------------------------------------------------------------ */
/* Suggested prompts — role-aware, agent-aware                         */
/* ------------------------------------------------------------------ */

const ROLE_PROMPTS: Record<RoleCode, string[]> = {
  ase_asm: ['Catch me up on today', 'Why was CMP-2291 flagged?', 'Where are the biggest coverage gaps?', 'Who\'s the best candidate for Nashik?'],
  finance: ['Which cases are overdue?', 'How does Financial Evaluation work?', 'What\'s driving rejections?', 'Summarise CMP-2291'],
  channel_dev: ['Which distributors are at risk?', 'How is the infra score calculated?', 'How is GTM coverage vs target?', 'What\'s happening in Nashik?'],
  mdm: ['What\'s the document verification status?', 'What\'s missing on VND-0417?', 'How does Document Intelligence work?', 'What documents does a Vendor need?'],
  leadership: ['What\'s this quarter\'s approval rate?', 'Which distributors are below plan?', 'What\'s driving rejections?', 'How is GTM coverage vs target?'],
  admin: ['What partner types are configured?', 'How do I add a partner type?', 'Who has access to what?', 'Which AI agents are running?'],
}

const AGENT_PROMPTS: Partial<Record<CopilotAgent, string[]>> = {
  recommendation: ['Who\'s the best candidate for Nashik?', 'How does the ranking work?', 'What is the Ideal DB benchmark?', 'Compare the candidates'],
  evaluation: ['How does Financial Evaluation work?', 'What are the 8 infra factors?', 'Why was CMP-2291 flagged?', 'Who approves — RBL or SM?'],
  document: ['What\'s the document verification status?', 'What\'s missing on VND-0417?', 'How does Document Intelligence work?', 'What documents does a Distributor need?'],
  communication: ['Who\'s next to reply on each thread?', 'Show the CMP-2291 discussion', 'Draft outreach for the Nashik gap', 'How do partner nudges work?'],
}

export function suggestedPrompts(agent: CopilotAgent, role: RoleCode): string[] {
  return AGENT_PROMPTS[agent] ?? ROLE_PROMPTS[role] ?? ROLE_PROMPTS.ase_asm
}
