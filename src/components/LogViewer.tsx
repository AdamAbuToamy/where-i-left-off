import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { db } from '../lib/firebase'
import { isAdmin } from '../lib/admin'
import { readLogs } from '../lib/logging'
import type { LogEntry } from '../lib/logging'
import { pageText } from '../pageText'
export default function LogViewer({ user, language }: { user: User; language: Language }) {
  const t = pageText[language], admin = isAdmin(user.email, user.emailVerified)
  const [source, setSource] = useState<'local' | 'central'>('local'), [entries, setEntries] = useState(() => [...readLogs(''), ...readLogs(user.uid)].slice(-200))
  const [level, setLevel] = useState('all'), [search, setSearch] = useState(''), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [reload, setReload] = useState(0)
  useEffect(() => {
    if (source !== 'local') return
    const receive = () => setEntries([...readLogs(''), ...readLogs(user.uid)].slice(-200)); receive()
    window.addEventListener('diagnostics-updated', receive)
    return () => window.removeEventListener('diagnostics-updated', receive)
  }, [source, user.uid])
  useEffect(() => {
    if (source !== 'central') return
    let cancelled = false
    const base = collection(db!, 'appLogs')
    const request = admin ? query(base, orderBy('receivedAt', 'desc'), limit(200)) : query(base, where('uid', '==', user.uid), orderBy('receivedAt', 'desc'), limit(200))
    void getDocs(request).then(snap => { if (!cancelled) setEntries(snap.docs.map(d => d.data() as LogEntry)) }).catch(() => { if (!cancelled) setFailed(true) }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [source, user.uid, admin, reload])
  const visible = [...entries].filter(e => (level === 'all' || e.level === level) && `${e.event} ${e.code} ${e.id} ${e.page} ${e.uid}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  function exportLogs() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(visible, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'diagnostics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="page-panel"><h2>{t.logs}</h2><p>{t.logHint}</p><p>{t.logQueued}</p>
    <div className="log-toolbar"><label>{t.logs}<select value={source} onChange={e => { setEntries([]); setFailed(false); setBusy(e.target.value === 'central'); setSource(e.target.value as 'local' | 'central') }}><option value="local">{t.local}</option><option value="central">{t.central}</option></select></label>
      <label>{t.level}<select value={level} onChange={e => setLevel(e.target.value)}>{['all', 'error', 'warn', 'info'].map(v => <option key={v} value={v}>{v === 'all' ? t.all : v}</option>)}</select></label>
      <input type="search" aria-label={t.reference} placeholder={t.reference} value={search} onChange={e => setSearch(e.target.value)} />
      {visible.length > 0 && <button className="secondary-button" onClick={exportLogs}>{t.export}</button>}
      {source === 'central' && <button className="secondary-button" disabled={busy} onClick={() => { setBusy(true); setFailed(false); setReload(v => v + 1) }}>{t.retry}</button>}
    </div>
    {failed && <p className="notice error" role="alert">{t.logFailure}</p>}
    {busy ? <p role="status">…</p> : !visible.length ? <p>{t.empty}</p> : <ol className="log-list">{visible.map(e => <li key={e.id} className={`log-${e.level}`}><div><time dateTime={e.timestamp}>{new Date(e.timestamp).toLocaleString(language)}</time><strong>{e.level}</strong></div><p dir="ltr"><code>{e.event}</code> · <code>{e.code}</code></p><details><summary>{t.open}</summary><dl>{Object.entries(e).filter(([k]) => k !== 'receivedAt').map(([k, value]) => <div key={k}><dt>{k}</dt><dd dir="ltr">{String(value)}</dd></div>)}</dl></details></li>)}</ol>}
  </section>
}
