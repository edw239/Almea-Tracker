export type SearchResultKind = 'task' | 'list' | 'space' | 'user' | 'brand'

export interface SearchDocument {
  id: string
  kind: SearchResultKind
  title: string
  subtitle?: string
  to: string
}

export interface SearchHit extends SearchDocument {
  score: number
}

const MAX_PER_KIND = 5
const MAX_TOTAL = 12

/** Normalize for RU search: lowercase + ё→е. */
export function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е')
}

function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = normalizeSearchText(haystack)
  const n = normalizeSearchText(needle)
  if (!h.includes(n)) return 0
  if (h.startsWith(n)) return 100
  const wordStart = h.split(/[\s/|-]+/).some((part) => part.startsWith(n))
  if (wordStart) return 80
  return 40
}

export function searchIndex(
  docs: readonly SearchDocument[],
  query: string,
  opts?: { maxPerKind?: number; maxTotal?: number },
): SearchHit[] {
  const q = query.trim()
  if (q.length < 2) return []
  const maxPerKind = opts?.maxPerKind ?? MAX_PER_KIND
  const maxTotal = opts?.maxTotal ?? MAX_TOTAL

  const scored: SearchHit[] = []
  for (const doc of docs) {
    const titleScore = scoreMatch(doc.title, q)
    const subScore = doc.subtitle ? scoreMatch(doc.subtitle, q) * 0.6 : 0
    const score = Math.max(titleScore, subScore)
    if (score <= 0) continue
    scored.push({ ...doc, score })
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'))

  const perKind = new Map<SearchResultKind, number>()
  const out: SearchHit[] = []
  for (const hit of scored) {
    const used = perKind.get(hit.kind) ?? 0
    if (used >= maxPerKind) continue
    perKind.set(hit.kind, used + 1)
    out.push(hit)
    if (out.length >= maxTotal) break
  }
  return out
}
