import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { auth } from '../lib/firebase'
import { useTaskOverview } from '../lib/useTaskOverview'
import { pushText } from '../pushText'
import { deviceOptedIn, clearPushBinding, deviceSubscription, disconnectDevice, pushCall, pushSupported, reminderKey, subscribeDevice } from '../lib/pushNotifications'
import type { CardReminder, PushPreferences, PushState } from '../lib/pushNotifications'
import './NotificationSettings.css'
function CardOptions({id,groupId,name,dueDate,initial,language,defaultTime}:{id:string;groupId?:string;name:string;dueDate?:string;initial:CardReminder;language:Language;defaultTime:string}) {
  const t=pushText[language], [value,setValue]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false)
  return <details className="push-card"><summary><strong dir="auto">{name}</strong><span>{dueDate || '—'}</span></summary><form onSubmit={async e=>{
    e.preventDefault();setBusy(true);setMessage('');setFailed(false)
    try {await pushCall({action:'card',projectId:id,groupId:groupId || '',disabled:value.disabled || false,weekly:value.weekly || false,time:value.time || ''});setMessage(t.saved)} catch {setFailed(true);setMessage(t.failed)} finally {setBusy(false)}
  }}>
    <label className="push-toggle"><input type="checkbox" checked={!!value.disabled} onChange={e=>setValue({...value,disabled:e.target.checked})}/>{t.cardOff}</label>
    {dueDate ? <><label>{t.time}<input aria-label={`${t.time}: ${name}`} type="time" value={value.time || ''} onChange={e=>setValue({...value,time:e.target.value})}/><small>{t.defaultTime}: {defaultTime}</small></label><label className="push-toggle"><input type="checkbox" checked={!!value.weekly} onChange={e=>setValue({...value,weekly:e.target.checked})}/>{t.weekly}</label></> : <p>{t.noDate}</p>}
    <button className="secondary-button" disabled={busy}>{t.cardSave}</button>{message&&<p role={failed?'alert':'status'}>{message}</p>}
  </form></details>
}
function Settings({user,language}:{user:User;language:Language}) {
  const t=pushText[language],{entries,ready}=useTaskOverview(user,'Personal')
  const [state,setState]=useState<PushState|null>(null),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false)
  useEffect(()=>{let alive=true;void(async()=>{try{
    const loaded=await pushCall<PushState>({action:'get'}), subscription=pushSupported()?await deviceSubscription():null
    if(alive){setState(loaded);setConnected(deviceOptedIn(user.uid) && !!subscription && loaded.preferences.enabled && Notification.permission==='granted')}
  }catch{if(alive){setMessage(t.failed);setFailed(true)}}})();return()=>{alive=false}},[user.uid,t.failed])
  function patch(value:Partial<PushPreferences>) {setState(s=>s?{...s,preferences:{...s.preferences,...value}}:s);setMessage('')}
  async function run(action:()=>Promise<void>,success:string) {
    setBusy(true);setMessage('');setFailed(false)
    try{await action();setMessage(success)}catch{setFailed(true);setMessage('Notification' in window&&Notification.permission==='denied'?t.denied:t.failed)}finally{setBusy(false)}
  }
  if (!state) return <section className="push-page page-panel"><a href="#/settings">← {t.back}</a><h2>{t.title}</h2><p role={failed?'alert':'status'}>{message || t.loading}</p></section>
  const p=state.preferences
  const savedPreferences=()=>({...p,language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})
  return <section className="push-page page-panel"><a href="#/settings">← {t.back}</a><header><svg className="push-icon" aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4M12 1v1"/></svg><h2>{t.title}</h2><p>{t.intro}</p></header>
    <section className="push-device"><strong>{connected?t.on:t.localOff}</strong>{!pushSupported()?<p>{t.unsupported}</p>:<div className="push-actions">
      <button className="primary-button" disabled={busy} onClick={()=>void run(async()=>{
        if(connected){await disconnectDevice();setConnected(false)}else{
          await subscribeDevice(state.publicKey,user.uid,true)
          const next={...savedPreferences(),enabled:true};await pushCall({action:'save',preferences:next});patch(next);setConnected(true)
        }
      },connected?t.off:t.saved)}>{connected?t.disable:t.enable}</button>
      {connected&&<button className="secondary-button" disabled={busy} onClick={()=>void run(async()=>{const subscription=await deviceSubscription();if(!subscription)throw new Error('missing-subscription');await pushCall({action:'test',subscription:subscription.toJSON()})},t.testSent)}>{t.test}</button>}
    </div>}</section>
    <form className="push-preferences" onSubmit={e=>{e.preventDefault();void run(async()=>{await pushCall({action:'save',preferences:savedPreferences()})},t.saved)}}>
      <fieldset disabled={busy}><legend>{t.title}</legend>
        <label className="push-toggle"><input type="checkbox" checked={p.due} onChange={e=>patch({due:e.target.checked})}/>{t.due}</label>
        <div className="push-grid"><label>{t.defaultTime}<input type="time" required value={p.defaultTime} onChange={e=>patch({defaultTime:e.target.value})}/></label><label>{t.lead}<select value={p.leadMinutes} onChange={e=>patch({leadMinutes:Number(e.target.value)})}>{[0,15,60,1440].map((n,i)=><option key={n} value={n}>{t.leads[i]}</option>)}</select></label></div>
        <label className="push-toggle"><input type="checkbox" checked={p.stale} onChange={e=>patch({stale:e.target.checked})}/>{t.stale}</label>
        <label>{t.days}<select value={p.staleDays} onChange={e=>patch({staleDays:Number(e.target.value)})}>{[7,14,30,60,90].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <label className="push-toggle"><input type="checkbox" checked={p.quiet} onChange={e=>patch({quiet:e.target.checked})}/>{t.quiet}</label>
        {p.quiet&&<div className="push-grid"><label>{t.from}<input type="time" required value={p.quietStart} onChange={e=>patch({quietStart:e.target.value})}/></label><label>{t.to}<input type="time" required value={p.quietEnd} onChange={e=>patch({quietEnd:e.target.value})}/></label></div>}
        <label className="push-toggle"><input type="checkbox" checked={p.hideContent} onChange={e=>patch({hideContent:e.target.checked})}/>{t.privacy}</label>
        <p>{t.zone}: <b dir="ltr">{Intl.DateTimeFormat().resolvedOptions().timeZone}</b></p><button className="primary-button">{t.save}</button>
      </fieldset>
    </form>
    {message&&<p className={`push-feedback ${failed?'error':''}`} role={failed?'alert':'status'}>{message}</p>}
    <section className="push-cards"><h3>{t.cards}</h3><p>{t.cardsHint}</p>{!ready&&<p role="status">…</p>}{ready&&!entries.filter(e=>e.project.status!=='done').length&&<p>{t.empty}</p>}{entries.filter(e=>e.project.status!=='done').map(e=><CardOptions key={reminderKey(e.project.id,e.groupId)} id={e.project.id} groupId={e.groupId} name={e.project.name} dueDate={e.project.dueDate} initial={state.cards[reminderKey(e.project.id,e.groupId)] || {}} language={language} defaultTime={p.defaultTime}/>)}</section>
    <p className="push-delivery">{t.delivery}</p>
    {p.enabled&&<button className="text-button" disabled={busy} onClick={()=>void run(async()=>{const next={...savedPreferences(),enabled:false};await pushCall({action:'save',preferences:next});await clearPushBinding();await disconnectDevice();patch(next);setConnected(false)},t.off)}>{t.allOff}</button>}
  </section>
}
export default function NotificationSettings(props:{user:User;language:Language}) {
  // Direct navigation cannot expose notification controls in ordinary browser tabs.
  // Authentication is checked independently by the callable service.
  if(!auth?.currentUser || auth.currentUser.uid!==props.user.uid) return null
  return <Settings {...props}/>
}
