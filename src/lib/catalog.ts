export type CatalogResult = {
  id: string
  source: 'openlibrary' | 'tvmaze'
  name: string
  url: string
  coverUrl: string
  description: string
  totalUnits: number
  resourceType: 'book' | 'series'
}

const cache = new Map<string, CatalogResult[]>()
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const plain = (value: unknown) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000) : ''

function secureUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    url.protocol = 'https:'
    return url.href
  } catch { return '' }
}

function parseBook(value: unknown): CatalogResult | null {
  const item = record(value)
  if (typeof item.key !== 'string' || !/^\/works\/OL\d+W$/.test(item.key)) return null
  const name = plain(item.title).slice(0, 100)
  if (!name) return null
  const id = item.key.slice('/works/'.length)
  const pages = item.number_of_pages_median
  const cover = item.cover_i
  return {
    id, source: 'openlibrary', name, url: `https://openlibrary.org/works/${id}`,
    coverUrl: typeof cover === 'number' && Number.isSafeInteger(cover) && cover > 0
      ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : '',
    description: Array.isArray(item.author_name) ? item.author_name.filter(author => typeof author === 'string').join(', ').slice(0, 1000) : '',
    totalUnits: typeof pages === 'number' && Number.isFinite(pages) ? Math.min(1000000, Math.max(0, Math.round(pages))) : 0,
    resourceType: 'book',
  }
}

function parseSeries(value: unknown): CatalogResult | null {
  const show = record(record(value).show)
  if (typeof show.id !== 'number' || !Number.isSafeInteger(show.id) || show.id <= 0) return null
  const name = plain(show.name).slice(0, 100)
  if (!name) return null
  return {
    id: String(show.id), source: 'tvmaze', name, url: secureUrl(show.url),
    coverUrl: secureUrl(record(show.image).medium), description: plain(show.summary),
    totalUnits: 0, resourceType: 'series',
  }
}

export async function searchCatalog(query: string, type: 'book' | 'series', signal: AbortSignal): Promise<CatalogResult[]> {
  signal.throwIfAborted()
  const term = query.trim()
  if (term.length < 3) return []
  const key = `${type}:${term.toLowerCase()}`
  if (cache.has(key)) return cache.get(key)!
  const url = type === 'book'
    ? `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=4&fields=key,title,author_name,cover_i,number_of_pages_median`
    : `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(term)}`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('catalog-unavailable')
  const body: unknown = await response.json()
  signal.throwIfAborted()
  const rows = type === 'book' ? record(body).docs : body
  if (!Array.isArray(rows)) throw new Error('catalog-invalid-response')
  const parse = type === 'book' ? parseBook : parseSeries
  const unique = new Map<string, CatalogResult>()
  for (const row of rows) {
    const result = parse(row)
    if (result && !unique.has(result.id)) unique.set(result.id, result)
    if (unique.size === 4) break
  }
  const results = [...unique.values()]
  if (cache.size >= 50) cache.delete(cache.keys().next().value!)
  cache.set(key, results)
  return results
}

export async function enrichCatalog(result: CatalogResult, signal: AbortSignal): Promise<CatalogResult> {
  signal.throwIfAborted()
  const validId = result.source === 'openlibrary' ? /^OL\d+W$/.test(result.id) : /^\d+$/.test(result.id)
  if (!validId) throw new Error('catalog-invalid-response')
  try {
    const url = result.source === 'openlibrary'
      ? `https://openlibrary.org/works/${result.id}.json`
      : `https://api.tvmaze.com/shows/${result.id}/episodes`
    const response = await fetch(url, { signal })
    if (!response.ok) return result
    const body: unknown = await response.json()
    signal.throwIfAborted()
    if (result.source === 'tvmaze') return { ...result, totalUnits: Array.isArray(body) ? Math.min(body.length, 1000000) : result.totalUnits }
    const description = record(body).description
    return { ...result, description: plain(typeof description === 'string' ? description : record(description).value) || result.description }
  } catch (error) {
    if (signal.aborted) throw error
    return result
  }
}
