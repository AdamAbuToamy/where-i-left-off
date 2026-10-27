import { FeedbackList } from './Support'
import { supportText } from '../supportText'
import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Language } from '../translations'
import { translations } from '../translations'
import type { User } from 'firebase/auth'
import LogViewer from './LogViewer'
import { pageText } from '../pageText'
import { isProtectedAdminAccount } from '../lib/admin'
import { logEvent } from '../lib/logging'
import { cloudText, errorText } from '../cloudTranslations'
import { readUserMetrics, setUserSuspended } from '../lib/repository'
import type { UserMetric } from '../lib/repository'
import './AdminDashboard.css'

type Props = { db: Firestore; language: Language; user: User }

export default function AdminDashboard({ db, language, user }: Props) {
  const t = translations[language]
  const c = cloudText[language]
  const p = pageText[language]
  const section = location.hash.endsWith('/logs') || location.hash === '#/logs' ? 'logs' : location.hash.endsWith('/support') ? 'support' : 'accounts'
  const [metrics, setMetrics] = useState<UserMetric[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void readUserMetrics(db).then(result => {
      if (alive) {
        const recent = Date.now() - 7 * 24 * 60 * 60 * 1000
        setMetrics(result)
        setActive(result.filter(metric => metric.lastSeen?.toDate?.().getTime() >= recent).length)
      }
    }).catch(error => { if (alive) {setError(error);logEvent('admin.accounts',error)} }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [db, attempt])
  const suspended = metrics.filter(metric => metric.suspended).length
  const locale = language === 'ar' ? 'ar' : language === 'he' ? 'he' : 'en'
  async function changeAccess(metric: UserMetric, value: boolean) {
    setPending(metric.id)
    try {
      await setUserSuspended(db, metric.id, value)
      setMetrics(current => current.map(item => item.id === metric.id ? { ...item, suspended: value } : item))
      setConfirming(null)
    } catch { setError(true) }
    finally { setPending(null) }
  }
  return <section className="admin-dashboard">
    <h2>{t.adminTitle}</h2>
    <nav className="admin-sections" aria-label={t.adminTitle}><a className={section === 'accounts' ? 'is-current' : ''} aria-current={section === 'accounts' ? 'page' : undefined} href="#/admin">{p.adminAccounts}</a><a className={section === 'logs' ? 'is-current' : ''} aria-current={section === 'logs' ? 'page' : undefined} href="#/admin/logs">{p.logs}</a><a className={section === 'support' ? 'is-current' : ''} href="#/admin/support" aria-current={section === 'support' ? 'page' : undefined}>{supportText[language].admin}</a></nav>
    {section === 'support' ? <FeedbackList user={user} language={language} admin /> : section === 'logs' ? <LogViewer user={user} language={language} /> : loading ? <p role="status">…</p> : error ? <div role="alert"><p>{errorText(error,language)}</p><button className="secondary-button" onClick={() => { setError(null); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button></div> : <>
      <div className="admin-stats">
      <article><strong>{metrics.length}</strong><span>{t.accountsSeen}</span></article>
      <article><strong>{active}</strong><span>{t.activeThisWeek}</span></article>
      <article><strong>{suspended}</strong><span>{t.suspendedAccounts}</span></article>
      </div>
      <div className="admin-account-list">
        <h3>{t.accountStatus}</h3>
        {!metrics.length && <p>{t.noAccounts}</p>}
        {metrics.map(metric => { const protectedAccount = isProtectedAdminAccount(metric.email); return <article className={`admin-account ${protectedAccount ? 'is-protected' : ''}`} key={metric.id}>
          <div className="admin-account-info">
            <strong dir="auto">{metric.email || metric.id}</strong>
            <span>{t.firstSeen}: {metric.firstSeen?.toDate?.().toLocaleDateString(locale) ?? '—'}</span>
            <span>{t.lastSeen}: {metric.lastSeen?.toDate?.().toLocaleDateString(locale) ?? '—'}</span>
            {protectedAccount && <strong className="protected-admin-label">{p.protectedAdmin}</strong>}
            <span className={metric.suspended ? 'account-paused' : 'account-active'}>{metric.suspended ? t.suspendedAccounts : t.accountActive}</span>
          </div>
          {!protectedAccount && <div className="admin-account-actions">
            {confirming === metric.id && <div className="admin-confirm" role="group" aria-label={t.confirmSuspend}>
              <span>{t.confirmSuspend}</span>
              <button className="card-delete" disabled={pending === metric.id} onClick={() => void changeAccess(metric, true)}>{pending === metric.id ? '…' : t.suspendApp}</button>
              <button className="card-secondary" onClick={() => setConfirming(null)}>{t.cancelAction}</button>
            </div>}
            {!metric.suspended && confirming !== metric.id && <button className="card-delete" onClick={() => setConfirming(metric.id)}>{t.suspendApp}</button>}
            {metric.suspended && <button className="card-secondary" disabled={pending === metric.id} onClick={() => void changeAccess(metric, false)}>{pending === metric.id ? '…' : t.restoreApp}</button>}
          </div>}
        </article>})}
      </div>
    </>}
    <a className="secondary-button" href="#/admin/preview">{language==='ar'?'تجربة تحسين الواجهة الأصلية':language==='he'?'ניסוי שיפורי הממשק המקורי':'Try original-interface improvements'}</a>
    <p className="admin-limits">{t.adminLimit}</p>
    <a className="primary-button admin-console-link" href="https://console.firebase.google.com/project/where-i-left-off-b5683/authentication/users" target="_blank" rel="noopener noreferrer">{t.firebaseUsers} ↗</a>
  </section>
}
