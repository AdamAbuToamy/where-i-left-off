import {EmailVerification} from '../lib/emailVerification'
import { useEffect,useState } from 'react'
import { EmailAuthProvider,reauthenticateWithCredential,updatePassword,sendEmailVerification } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc,onSnapshot,serverTimestamp,setDoc } from 'firebase/firestore'
import { auth,db } from '../lib/firebase'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { errorText } from '../cloudTranslations'
import { logEvent } from '../lib/logging'
export default function PasswordChange({user,language}:{user:User;language:Language}) {
 const t=featureText[language],[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[result,setResult]=useState<'queued'|'unavailable'|'unverified'|null>(null),[mailUntil,setMailUntil]=useState(0),[now,setNow]=useState(Date.now),[verifiedSent,setVerifiedSent]=useState(false)
 const [verificationResult,setVerificationResult]=useState<boolean|null>(null)
 const verificationText={ar:{refresh:'تحديث حالة تأكيد البريد',verified:'تم تأكيد البريد.',pending:'لم يُؤكد البريد بعد. افتح أحدث رسالة تأكيد، ثم حدّث الحالة هنا.'},en:{refresh:'Refresh email verification',verified:'Email verified.',pending:'Email is not verified yet. Open the newest verification email, then refresh here.'},he:{refresh:'רענון אימות הדוא״ל',verified:'הדוא״ל אומת.',pending:'הדוא״ל טרם אומת. פתחו את הודעת האימות האחרונה ואז רעננו כאן.'}}[language]
 async function refreshVerification(){setBusy(true);setError(null);try{const verified=await new EmailVerification(user).refresh();setVerificationResult(verified);window.dispatchEvent(new Event('profile-updated'));}catch(error){setError(error);}finally{setBusy(false);}}
 const mailReady=mailUntil>now
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer)},[])
 useEffect(()=>onSnapshot(doc(db!,'system','securityEmailWorker'),{includeMetadataChanges:true},snapshot=>setMailUntil(snapshot.metadata.fromCache?0:(snapshot.data()?.availableUntil?.toMillis() || 0)),()=>setMailUntil(0)),[])
 const usesPassword=user.providerData.some(provider=>provider.providerId==='password')
 async function change() {
  if(busy || !user.email || !current || next.length<8 || next.length>128 || next!==confirm || next===current)return
  setBusy(true);setError(null);setResult(null)
  try{
   await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,current))
   await updatePassword(user,next)
  }catch(err){setError(err);logEvent('auth.password.change',err);setBusy(false);return}
  // Changing the password has succeeded. Mail failure must never report that it failed.
  setCurrent('');setNext('');setConfirm('')
  try{
   if(!user.emailVerified){setResult('unverified');return}
   if(!mailReady)throw new Error('confirmation-unavailable')
   await user.getIdToken(true)
   await setDoc(doc(db!,'securityNotifications',user.uid),{status:'pending',event:'password-changed',language,requestedAt:serverTimestamp()})
   setResult('queued')
  }catch(err){setResult('unavailable');logEvent('auth.password.confirmation',err)}finally{setBusy(false)}
 }
 return <section className="settings-section password-settings"><h3>{t.passwordTitle}</h3>{usesPassword&&<><p>{t.passwordHint}</p><form className="profile-form" onSubmit={e=>{e.preventDefault();void change()}}><label htmlFor="password-current">{t.currentPassword}</label><input id="password-current" type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)} disabled={busy}/><label htmlFor="password-new">{t.newPassword}</label><input id="password-new" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={e=>setNext(e.target.value)} disabled={busy}/><label htmlFor="password-confirm">{t.confirmPassword}</label><input id="password-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy}/><button className="primary-button" disabled={busy || !current || next.length<8 || next!==confirm || next===current}>{busy?'…':t.changePassword}</button></form></>}{!usesPassword&&<p>Google</p>}{!user.emailVerified&&<button className="secondary-button" disabled={busy} onClick={()=>{setBusy(true);setError(null);auth!.languageCode=language;void sendEmailVerification(user).then(()=>setVerifiedSent(true)).catch(setError).finally(()=>setBusy(false))}}>{t.verifyEmail}</button>}{!user.emailVerified&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void refreshVerification()}>{verificationText.refresh}</button>}{verificationResult!==null&&<p role="status">{verificationResult?verificationText.verified:verificationText.pending}</p>}{verifiedSent&&<p role="status">{t.verificationSent}</p>}{result&&<p role="status">{t.passwordChanged}</p>}{error!==null&&<p role="alert">{errorText(error,language)}</p>}</section>
}
