import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { db } from '../lib/firebase'
import { supportText } from '../supportText'
import { feedbackKinds, respondToFeedback, sendFeedback, validFeedback, watchFeedback } from '../lib/feedback'
import type { Feedback, FeedbackKind, FeedbackStatus } from '../lib/feedback'
import './Support.css'

export function LegalLinks({language}:{language:Language}) {
 const t=supportText[language],suffix=`?lang=${language}`
 return <nav className="legal-links" aria-label={t.legal}><a href={`/privacy.html${suffix}`} target="_blank" rel="noopener noreferrer">{t.privacy}</a><a href={`/terms.html${suffix}`} target="_blank" rel="noopener noreferrer">{t.terms}</a><a href="/extension-privacy.html" target="_blank" rel="noopener noreferrer">{t.extensionPrivacy}</a><a href="#/support">{t.title}</a></nav>
}
export default function Support({user,language,initialKind='suggestion'}:{user:User;language:Language;initialKind?:FeedbackKind}) {
 const t=supportText[language]
 const [kind,setKind]=useState<FeedbackKind>(initialKind),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[sent,setSent]=useState(''),[error,setError]=useState('')
 return <section className="page-panel support-page"><a className="text-button" href="#/personal">{{en:"Back to workspace",ar:"العودة إلى مساحة العمل",he:"חזרה לסביבת העבודה"}[language]}</a><h2>{t.title}</h2><p>{t.intro}</p><form className="support-form" onSubmit={async e=>{
  e.preventDefault();if(busy||!consent||!validFeedback(subject,message))return
  setBusy(true);setError('');setSent('')
  try{const id=await sendFeedback(db!,user.uid,kind,subject,message,language);setSent(id);setSubject('');setMessage('');setConsent(false)}
  catch(err){setError(err instanceof Error&&err.message==='support-rate'?t.rate:err instanceof Error&&err.message==='support-offline'?t.offline:t.failed)}finally{setBusy(false)}
 }}>
 <label htmlFor="support-kind">{t.kind}</label><select id="support-kind" value={kind} disabled={busy} onChange={e=>setKind(e.target.value as FeedbackKind)}>{feedbackKinds.map(k=><option key={k} value={k}>{t.kinds[k]}</option>)}</select>
 {kind==='deletion'&&<p className="notice">{t.manual}</p>}
 <label htmlFor="support-subject">{t.subject}</label><input id="support-subject" value={subject} minLength={3} maxLength={120} required disabled={busy} dir="auto" onChange={e=>setSubject(e.target.value)}/>
 <label htmlFor="support-message">{t.message}</label><textarea id="support-message" rows={5} value={message} minLength={10} maxLength={3000} required disabled={busy} dir="auto" onChange={e=>setMessage(e.target.value)}/>
 <label className="support-consent"><input type="checkbox" checked={consent} required disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>{t.consent}</span></label>
 <button className="primary-button" disabled={busy||!consent||!validFeedback(subject,message)}>{busy?t.sending:t.send}</button>
 {error&&<p role="alert">{error}</p>}{sent&&<p role="status">{t.sent} <bdi>{sent}</bdi></p>}
 </form><FeedbackList user={user} language={language}/></section>
}
export function FeedbackList({user,language,admin=false}:{user:User;language:Language;admin?:boolean}) {
 const t=supportText[language],[items,setItems]=useState<Feedback[]>([]),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0)
 useEffect(()=>watchFeedback(db!,user.uid,admin,rows=>{setItems(rows);setLoaded(true);setFailed(false)},()=>{setFailed(true);setLoaded(true)}),[user.uid,admin,attempt])
 return <section className="support-history"><h3>{admin?t.admin:t.history}</h3>{!loaded?<p role="status">{t.loading}</p>:failed?<p role="alert">{t.loadError} <button className="secondary-button" onClick={()=>{setFailed(false);setLoaded(false);setAttempt(n=>n+1)}}>{t.retry}</button></p>:!items.length?<p>{t.empty}</p>:items.map(item=><article className="support-request" key={item.id}><small>{t.kinds[item.kind]} · {t.status[item.status]} · <bdi>{item.id}</bdi></small><h4 dir="auto">{item.subject}</h4><p className="support-message" dir="auto">{item.message}</p>{item.reply&&<div><strong>{t.reply}</strong><p className="support-message" dir="auto">{item.reply}</p></div>}{admin&&<SupportResponse key={`${item.id}/${item.updatedAt?.toMillis()}`} item={item} language={language}/>}</article>)}</section>
}
function SupportResponse({item,language}:{item:Feedback;language:Language}) {
 const t=supportText[language],[reply,setReply]=useState(item.reply),[status,setStatus]=useState(item.status),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[saved,setSaved]=useState(false)
 return <form className="support-form" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setFailed(false);setSaved(false);try{await respondToFeedback(db!,item.id,status,reply);setSaved(true)}catch{setFailed(true)}finally{setBusy(false)}}}><label>{t.reply}<textarea disabled={busy} value={reply} maxLength={2000} rows={3} dir="auto" onChange={e=>setReply(e.target.value)}/></label><label>{{en:'Status',ar:'الحالة',he:'מצב'}[language]}<select disabled={busy} value={status} onChange={e=>setStatus(e.target.value as FeedbackStatus)}>{(['open','reviewing','closed'] as const).map(s=><option key={s} value={s}>{t.status[s]}</option>)}</select></label><button className="secondary-button" disabled={busy}>{t.save}</button>{failed&&<p role="alert">{t.failed}</p>}{saved&&<p role="status">{t.saved}</p>}</form>
}
