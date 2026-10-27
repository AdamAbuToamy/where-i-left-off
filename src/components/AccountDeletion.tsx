import LoadingScreen from './LoadingScreen'
import { supportText } from '../supportText'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { cancelAccountDeletion, confirmIdentity, requestAccountDeletion, restoreDeadline, useAccountDeletion } from '../lib/accountDeletion'
import type { DeletionRequest } from '../lib/accountDeletion'
import { clearLocalAccount } from '../lib/offlineStore'
import { isProtectedAdminAccount } from '../lib/admin'
import { logEvent } from '../lib/logging'
import { settingsText } from '../settingsText'
import type { Language } from '../translations'

export function AccountLifecycle({ user, language, children }: { user: User; language: Language; children: ReactNode }) {
 const { request, loaded, cached } = useAccountDeletion(user.uid)
 if (!loaded) return <LoadingScreen language={language} status={settingsText[language].checking} />
 if (request) return <AccountDeletion user={user} language={language} request={request} cached={cached} />
 return children
}
export default function AccountDeletion({ user, language, request = null, cached = false }: { user: User; language: Language; request?: DeletionRequest | null; cached?: boolean }) {
 const t = settingsText[language]
 const [workerUntil, setWorkerUntil] = useState(0), [now, setNow] = useState(Date.now)
 const [confirm, setConfirm] = useState(false), [typed, setTyped] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
 const dialog = useRef<HTMLDialogElement>(null)
 const requiresPassword = !user.providerData.some(p => p.providerId === 'google.com')
 const deadline = request ? restoreDeadline(request) : null
 const canRestore = request?.status === 'pending' && !!deadline && now < deadline
 const enabled = workerUntil > now
 useEffect(() => {
  const timer = window.setInterval(() => setNow(Date.now()), 15000)
  return () => window.clearInterval(timer)
 }, [])
 useEffect(() => {
  if (request) return
  return onSnapshot(doc(db!, 'system', 'accountDeletionWorker'), { includeMetadataChanges:true }, snapshot => {
   setWorkerUntil(snapshot.metadata.fromCache ? 0 : snapshot.data()?.availableUntil?.toMillis() || 0)
  }, () => setWorkerUntil(0))
 }, [request])
 useEffect(() => {
  const element = dialog.current
  if (confirm && element && !element.open) element.showModal()
  else if (!confirm && element?.open) element.close()
 }, [confirm])
 function close() { if (busy) return; setConfirm(false); setTyped(''); setPassword(''); setFailed(false) }
 async function submit() {
  if (busy || !navigator.onLine) { setFailed(true); return }
  setBusy(true); setFailed(false)
  try {
   await confirmIdentity(user, password)
   if (request) await cancelAccountDeletion(user.uid)
   else {
    await requestAccountDeletion(user.uid)
    await clearLocalAccount(db!.app.options.projectId || '', user.uid).catch(error => logEvent('account.cache.clear', error))
   }
   setConfirm(false); setTyped('')
  } catch (error) { setFailed(true); logEvent(request ? 'account.restore' : 'account.deletion.request', error) }
  finally { setPassword(''); setBusy(false) }
 }
 if (isProtectedAdminAccount(user.email) && !request) return <section className="settings-section"><h3>{t.deletionTitle}</h3><p>{t.protectedAccount}</p></section>
 return <section className={request ? 'page-panel deletion-status' : 'settings-section settings-danger'}>
  <h3>{request ? t.pendingTitle : t.deletionTitle}</h3>
  <p>{request ? request.status === 'completed' ? t.deleted : canRestore ? t.pendingBody : t.processing : t.deletionBody}</p>
  {deadline && <><span>{t.deadline}</span><time dateTime={new Date(deadline).toISOString()}>{new Date(deadline).toLocaleString(language)}</time></>}
  {request ? canRestore && <button className="primary-button" disabled={cached} onClick={() => { setFailed(false); setConfirm(true) }}>{t.restore}</button> : <><button className="danger-button" disabled={!enabled} onClick={() => setConfirm(true)}>{t.requestDelete}</button>{!enabled && <><p role="status">{t.unavailable}</p><p>{supportText[language].manual}</p><a className="secondary-button" href="#/support?kind=deletion">{supportText[language].deleteHelp}</a></>}</>}
  <dialog ref={dialog} className="settings-dialog" aria-labelledby="deletion-confirm-title" onCancel={e => { e.preventDefault(); close() }}>
   <form onSubmit={e => { e.preventDefault(); void submit() }}>
    <h2 id="deletion-confirm-title">{request ? t.restoreTitle : t.confirmTitle}</h2>
    {!request && <><p>{t.deletionBody}</p><label htmlFor="delete-confirm">{t.confirmLabel}</label><input id="delete-confirm" autoComplete="off" dir="ltr" value={typed} onChange={e => setTyped(e.target.value)} required pattern="DELETE" disabled={busy} /></>}
    {requiresPassword && <><label htmlFor="delete-password">{t.password}</label><input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /></>}
    {failed && <p role="alert">{navigator.onLine ? t.fail : t.offline}</p>}
    <div className="form-actions"><button className={request ? 'primary-button' : 'danger-button'} disabled={busy || (!request && typed !== 'DELETE') || (requiresPassword && !password)}>{busy ? '…' : request ? t.restore : t.confirmDelete}</button><button type="button" className="secondary-button" disabled={busy} onClick={close}>{t.cancel}</button></div>
   </form>
  </dialog>
 </section>
}
