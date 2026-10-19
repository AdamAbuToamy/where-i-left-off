import { useEffect, useState } from 'react'
import { searchCatalog } from './catalog'
import type { CatalogResult } from './catalog'

type SearchState = { key: string; phase: 'ready' | 'error'; results: CatalogResult[] }

export function useCatalogSearch(name: string, type?: string, selected = '') {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<SearchState>({ key: '', phase: 'ready', results: [] })
  const term = name.trim()
  const enabled = (type === 'book' || type === 'series') && term.length >= 3 && selected !== `${type}:${name}`
  const key = `${type}:${term}:${attempt}`

  useEffect(() => {
    if (!enabled || (type !== 'book' && type !== 'series')) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchCatalog(term, type, controller.signal).then(results => {
        if (!controller.signal.aborted) setState({ key, phase: 'ready', results })
      }).catch(() => {
        if (!controller.signal.aborted) setState({ key, phase: 'error', results: [] })
      })
    }, 1000)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [enabled, type, term, key])

  const phase = !enabled ? 'idle' : state.key !== key ? 'loading' : state.phase
  return {
    phase,
    results: phase === 'ready' ? state.results : [],
    retry: () => setAttempt(value => value + 1),
  }
}
