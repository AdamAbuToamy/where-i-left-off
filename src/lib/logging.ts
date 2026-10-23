import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, emulatorMode } from './firebase'
export type LogLevel = 'info' | 'warn' | 'error'
export type LogEntry = { id: string; timestamp: string; uid: string; level: LogLevel; event: string; code: string; page: string; environment: string; version: string; durationMs: number; source: string }
const VERSION = '2026.10-pages-logs'
const MAX = 200
let flushing = false
let recent = new Map<string, number>()
const pending = new Set<string>()
const memory = new Map<string, LogEntry[]>()
function key(uid: string) { return `diagnostics/${db?.app.options.projectId || 'unconfigured'}/${uid || 'anonymous'}` }
export function safeCode(error: unknown): string {
  const known = ['permission-denied', 'conflict', 'invalid-name', 'invalid-project', 'invalid-invite', 'invalid-group']
  if (error instanceof Error && known.includes(error.message)) return error.message
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error ? error.name : 'unknown'
  return /^[a-zA-Z0-9/_-]{1,80}$/.test(code) ? code : 'unknown'
}
export function safeSource(error: unknown): string {
  if (!(error instanceof Error) || !error.stack) return ''
  // Keep only same-origin source asset locations. Drop messages, functions, hosts and query strings.
  return error.stack.split('\n').slice(1).flatMap(line => {
    const match = /(https?:\/\/[^()\s]+):(\d+):(\d+)/.exec(line)
    if (!match) return []
    try {
      const url = new URL(match[1])
      if (url.origin !== location.origin || !/^\/(assets|src)\/[A-Za-z0-9._/-]+\.(js|jsx|ts|tsx)$/.test(url.pathname)) return []
      return [`${url.pathname}:${match[2]}:${match[3]}`]
    } catch { return [] }
  }).slice(0, 5).join('\n').slice(0, 500)
}
export function readLogs(uid = auth?.currentUser?.uid || ''): LogEntry[] {
  try { const stored = localStorage.getItem(key(uid)); if (!stored) return memory.get(key(uid)) || []; const values = JSON.parse(stored); return Array.isArray(values) ? values.slice(-MAX).filter(v => v && typeof v.id === 'string' && v.uid === uid && typeof v.timestamp === 'string' && ['info', 'warn', 'error'].includes(v.level) && typeof v.event === 'string' && typeof v.code === 'string') : [] } catch { return memory.get(key(uid)) || [] }
}
function notify() { window.dispatchEvent(new Event('diagnostics-updated')) }
export function logEvent(event: string, error?: unknown, level: LogLevel = 'error', durationMs = 0): string {
  const uid = auth?.currentUser?.uid || '', code = error === undefined ? 'none' : safeCode(error)
  const match = /^#\/(personal|groups|settings|logs|admin|resume|university|library|analytics|notifications|support)(?:\/([A-Za-z0-9]{20}))?$/.exec(location.hash.split('?')[0])
  const page = match ? `#/${match[1]}${match[2] ? '/:group' : ''}` : '/personal'
  const dedupe = `${uid}/${event}/${code}/${page}`
  const previous = recent.get(dedupe)
  if (previous && Date.now() - previous < 30000) return ''
  if (recent.size > MAX) recent = new Map()
  recent.set(dedupe, Date.now())
  // Fixed metadata only. Never serialize Error.message, payloads, URLs, tokens or emails.
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
  const entry: LogEntry = { id, uid, timestamp: new Date().toISOString(), level, event: /^[a-zA-Z0-9._-]{1,60}$/.test(event) ? event : 'unknown', code, page, environment: emulatorMode ? 'emulator' : import.meta.env.PROD ? 'production' : 'development', version: VERSION, durationMs: Math.min(3600000, Math.max(0, Math.round(durationMs))), source: safeSource(error) }
  const entries = [...readLogs(uid), entry].slice(-MAX)
  memory.set(key(uid), entries)
  try { localStorage.setItem(key(uid), JSON.stringify(entries)) } catch { /* Memory remains available. */ }
  if (pending.size >= MAX) pending.delete(pending.values().next().value!)
  pending.add(id); notify(); void flushLogs()
  return id
}
export async function flushLogs() {
  if (flushing || !db || !auth?.currentUser || !navigator.onLine) return
  const uid = auth.currentUser.uid
  flushing = true
  let failed = false
  try {
    // Retry this device's bounded buffer. Deterministic IDs avoid duplicate documents.
    for (const entry of readLogs(uid)) {
      if (auth.currentUser?.uid !== uid) break
      const uploadedKey = `${key(uid)}/uploaded`
      let uploaded: string[] = []
      try { uploaded = JSON.parse(localStorage.getItem(uploadedKey) || '[]'); if (!Array.isArray(uploaded)) uploaded = [] } catch { /* Retry safely by ID. */ }
      if (uploaded.includes(entry.id) && !pending.has(entry.id)) continue
      try {
        await setDoc(doc(db, 'appLogs', entry.id), { ...entry, receivedAt: serverTimestamp() })
        pending.delete(entry.id)
        try { localStorage.setItem(uploadedKey, JSON.stringify([...uploaded, entry.id].slice(-MAX))) } catch { /* Bounded retry. */ }
      } catch { failed = true; break } // Logging must never recurse or break normal app actions.
    }
  } finally {
    flushing = false
    const current = auth.currentUser?.uid
    if (!failed && current && readLogs(current).some(entry => pending.has(entry.id))) setTimeout(() => void flushLogs(), 0)
  }
}
export async function traced<T>(event: string, action: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try { const value = await action(); if (import.meta.env.DEV) logEvent(`${event}.ok`, undefined, 'info', performance.now() - started); return value }
  catch (error) { logEvent(event, error, 'error', performance.now() - started); throw error }
}
export function installLogging() {
  const error = (event: ErrorEvent) => logEvent('browser.error', event.error)
  const rejection = (event: PromiseRejectionEvent) => logEvent('browser.rejection', event.reason)
  window.addEventListener('error', error); window.addEventListener('unhandledrejection', rejection); window.addEventListener('online', flushLogs)
  return () => { window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', rejection); window.removeEventListener('online', flushLogs) }
}
