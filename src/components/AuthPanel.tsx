import { useState } from 'react'
import type { FormEvent } from 'react'
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { cloudText, errorText } from '../cloudTranslations'
import { pageText } from '../pageText'
import { traced } from '../lib/logging'
import type { Language } from '../translations'

export default function AuthPanel({ language }: { language: Language }) {
  const t = cloudText[language]
  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)
  async function perform(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError(null); setSent(false)
    try { await traced('auth.action', action) } catch (e) { setError(e) } finally { setBusy(false) }
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (register && !name.trim()) return
    void perform(async () => { if (register) { const result = await createUserWithEmailAndPassword(auth!, email.trim(), password); await updateProfile(result.user, { displayName: name.trim() }); window.dispatchEvent(new Event('profile-updated')) } else await signInWithEmailAndPassword(auth!, email.trim(), password) })
  }
  return <section className="auth-panel" aria-busy={busy}>
    <div className="auth-intro"><span aria-hidden="true">↗</span><h2>{t.intro}</h2></div>
    <form onSubmit={submit} className="new-project-form auth-form">
      <h2>{register ? t.signUp : t.signIn}</h2>
      {register && <><label htmlFor="name">{pageText[language].name}</label><input id="name" autoComplete="name" required maxLength={100}  value={name} onChange={e => setName(e.target.value)} dir="auto" /></>}
      <label htmlFor="email">{t.email}</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
      <label htmlFor="password">{t.password}</label>
      <input id="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} dir="ltr" />
      {error !== null && <p className="notice error" role="alert">{errorText(error, language)}</p>}
      {sent && <p className="notice" role="status">{t.resetSent}</p>}
      <button className="primary-button" disabled={busy || (register && !name.trim())}>{register ? t.signUp : t.signIn}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void perform(() => signInWithPopup(auth!, new GoogleAuthProvider()))}>{t.google}</button>
      <div className="form-actions">
        <button className="text-button" type="button" disabled={busy} onClick={() => { setRegister(!register); setError(null); setSent(false) }}>{register ? t.signIn : t.signUp}</button>
        {!register && email.trim() && <button className="text-button" type="button" disabled={busy} onClick={() => void perform(async () => { await sendPasswordResetEmail(auth!, email.trim()); setSent(true) })}>{t.reset}</button>}
      </div>
    </form>
  </section>
}
