import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { navigate, route, usePage } from '../lib/navigation'
import { tourText } from '../tourText'
import './WelcomeTour.css'

const storageKey = (uid: string) => `welcome-tour:v2:${uid}`
function shouldOpen(user: User) {
  try { if (localStorage.getItem(storageKey(user.uid))) return false } catch { /* Optional preference. */ }
  const created = Date.parse(user.metadata.creationTime || '')
  return route().page === 'personal' && !new URLSearchParams(location.search).has('groupInvite') && Number.isFinite(created) && Date.now() - created < 86400000
}
export default function WelcomeTour({ user, language }: { user: User; language: Language }) {
  const [open, setOpen] = useState(() => shouldOpen(user))
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const t = tourText[language], current = t.steps[step]
  const { page, groupId } = usePage()
  const target = step <= 3 ? 'personal' : step === 4 ? 'groups' : 'settings'
  const offPage = page !== target || !!groupId
  useEffect(() => {
    const replay = () => { navigate('personal'); setStep(0); setReady(false); setOpen(true) }
    window.addEventListener('replay-welcome-tour', replay)
    return () => window.removeEventListener('replay-welcome-tour', replay)
  }, [])
  useEffect(() => {
    if (!open) return
    let scrollFrame = 0
    const opened = () => { setStep(s => s <= 2 ? 1 : s); scrollFrame = requestAnimationFrame(() => document.querySelector('#project-name')?.scrollIntoView({ block:'center', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })) }
    const fields = (e: Event) => setReady((e as CustomEvent<boolean>).detail)
    const saved = () => { setStep(s => s <= 2 ? 3 : s) }
    const cancelled = () => { setStep(s => s <= 2 ? 0 : s); setReady(false) }
    window.addEventListener('tour-form-opened', opened)
    window.addEventListener('tour-fields-ready', fields)
    window.addEventListener('tour-project-created', saved)
    window.addEventListener('tour-form-closed', cancelled)
    return () => {
      cancelAnimationFrame(scrollFrame)
      window.removeEventListener('tour-form-opened', opened); window.removeEventListener('tour-fields-ready', fields)
      window.removeEventListener('tour-project-created', saved); window.removeEventListener('tour-form-closed', cancelled)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    if (step <= 3) navigate('personal')
    else navigate(step === 4 ? 'groups' : 'settings')
    document.body.dataset.tourStep = String(step)
    return () => { delete document.body.dataset.tourStep }
  }, [open, step])
  function finish() {
    try { localStorage.setItem(storageKey(user.uid), 'done') } catch { /* Still dismiss in this session. */ }
    setOpen(false)
  }
  if (!open) return null
  return <aside className="welcome-guide" aria-label={t.quick}>
    <div className="guide-heading"><span className="guide-step">{step + 1} / {t.steps.length}</span><strong>{t.quick}</strong><button className="guide-skip" aria-label={t.skip} onClick={finish}>{t.skip} <span aria-hidden="true">×</span></button></div>
    <div className="guide-copy" key={`${language}-${step}`} aria-live="polite" aria-atomic="true"><h2>{current.title}</h2><p>{current.body}</p></div>
    <div className="guide-bottom"><div className="guide-progress" aria-hidden="true">{t.steps.map((_, i) => <span key={i} className={i <= step ? 'complete' : ''} />)}</div>
      {offPage && <button className="secondary-button" onClick={() => { navigate(target); if (step === 1 || step === 2) setStep(0) }}>{language === 'ar' ? 'العودة للخطوة' : language === 'he' ? 'חזרה לשלב' : 'Return to this step'}</button>}
      {step === 1 && <button className="primary-button" disabled={!ready} onClick={() => setStep(2)}>{t.next}</button>}
      {step === 3 || step === 4 ? <button className="primary-button" onClick={() => setStep(s => s + 1)}>{t.next}</button> : step === 5 ? <button className="primary-button" onClick={finish}>{t.start}</button> : null}
      {(step === 0 || step === 2) && <span className="guide-action-hint">{current.action}</span>}
    </div>
  </aside>
}
