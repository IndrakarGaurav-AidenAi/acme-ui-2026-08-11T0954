// Client for the backend's real-PDF text-position lookup (see backend-springboot's
// PdfTextLocator / IntakeController#locateText) — finds where an extracted field's actual value
// sits on the real uploaded document, so a "Source" highlight can point at the genuine page
// instead of a synthetic mock row.
import { apiPost } from './api'

export interface PdfMatch { page: number; x: number; y: number; width: number; height: number }

export async function locateTextInDoc(
  itemId: string, filename: string, query: string, token: string | null,
): Promise<PdfMatch[]> {
  if (!query.trim()) return []
  try {
    const data = await apiPost<{ matches: PdfMatch[] }>(
      `/api/intake/${encodeURIComponent(itemId)}/locate-text`, token, { filename, query },
    )
    return Array.isArray(data.matches) ? data.matches : []
  } catch {
    return []
  }
}

// One field can map to several highlightable values (e.g. a doc's own View highlights every
// field it backs) — look them all up in parallel and flatten, de-duping identical boxes.
export async function locateAllInDoc(
  itemId: string, filename: string, queries: string[], token: string | null,
): Promise<PdfMatch[]> {
  const unique = [...new Set(queries.filter((q) => q.trim()))]
  const results = await Promise.all(unique.map((q) => locateTextInDoc(itemId, filename, q, token)))
  const seen = new Set<string>()
  const out: PdfMatch[] = []
  for (const m of results.flat()) {
    const key = `${m.page}:${m.x.toFixed(3)}:${m.y.toFixed(3)}`
    if (!seen.has(key)) { seen.add(key); out.push(m) }
  }
  return out
}
