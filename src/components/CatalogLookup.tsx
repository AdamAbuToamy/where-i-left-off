import { useEffect, useRef, useState } from 'react'
import type { Language } from '../translations'
import type { ProjectDetails } from '../lib/projects'
import { workflowText } from '../workflowText'
import { cloudText } from '../cloudTranslations'
import { enrichCatalog } from '../lib/catalog'
import { useCatalogSearch } from '../lib/useCatalogSearch'
import type { CatalogResult } from '../lib/catalog'

type Props = {
  name: string
  type?: string
  language: Language
  onChoose: (name: string, values: ProjectDetails) => void
}

export default function CatalogLookup({ name, type, language, onChoose }: Props) {
  const t = workflowText[language]
  const [selected, setSelected] = useState('')
  const [selectionKey, setSelectionKey] = useState('')
  const [failedKey, setFailedKey] = useState('')
  const queryKey = `${type}:${name}`
  const choosing = selectionKey === queryKey
  const failed = failedKey === queryKey
  const selection = useRef<AbortController | null>(null)
  const search = useCatalogSearch(name, type, selected)

  // An older selection must never populate a different title or resource type.
  useEffect(() => () => { selection.current?.abort() }, [name, type])

  async function choose(result: CatalogResult) {
    if (selection.current && !selection.current.signal.aborted) return
    const controller = new AbortController()
    selection.current = controller
    setSelectionKey(queryKey)
    setFailedKey('')
    try {
      const item = await enrichCatalog(result, controller.signal)
      if (controller.signal.aborted) return
      setSelected(`${type}:${item.name}`)
      onChoose(item.name, {
        resourceType: item.resourceType, coverUrl: item.coverUrl, description: item.description,
        totalUnits: item.totalUnits, catalogId: item.id, catalogSource: item.source, projectUrl: item.url,
      })
    } catch {
      if (!controller.signal.aborted) setFailedKey(queryKey)
    } finally {
      if (selection.current === controller) {
        selection.current = null
        setSelectionKey(value => value === queryKey ? '' : value)
      }
    }
  }

  if (type !== 'book' && type !== 'series') return null
  const busy = search.phase === 'loading' || choosing
  return <section className="catalog-lookup" aria-busy={busy} aria-label={t.lookup}>
    <small>{t.lookupHint}</small>
    {busy && <p role="status">{t.loading}</p>}
    {(search.phase === 'error' || failed) && <p role="status">{t.lookupFail}
      <button type="button" className="text-button" onClick={() => { setFailedKey(''); search.retry() }}>{cloudText[language].retry}</button>
    </p>}
    {search.phase === 'ready' && !search.results.length && !choosing && <p role="status">{t.noResults}</p>}
    {search.results.map(result => <button type="button" className="catalog-result" key={result.id} disabled={busy} onClick={() => void choose(result)}>
      {result.coverUrl && <img src={result.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span><strong dir="auto">{result.name}</strong><small>{result.description.slice(0, 140)}</small>
        <small>{t.source}: {result.source === 'tvmaze' ? 'TVmaze' : 'Open Library'}</small></span>
    </button>)}
  </section>
}
