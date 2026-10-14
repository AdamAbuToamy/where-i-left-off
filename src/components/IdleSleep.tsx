import { useEffect,useRef,useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import SleepCards from './SleepCards'
import { AccountLifecycle } from './AccountDeletion'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { IDLE_SLEEP_MS,readSleepEnabled,saveSleepEnabled } from '../lib/idleSleep'
export function SleepPreference({uid,language}:{uid:string;language:Language}){
 const [enabled,setEnabled]=useState(()=>readSleepEnabled(uid)),t=featureText[language]
 return <section className="settings-section"><h3>{t.sleepTitle}</h3><p>{t.sleepHint}</p><label className="sleep-toggle"><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);saveSleepEnabled(uid,e.target.checked)}}/>{t.sleepEnable}</label></section>
}
export default function IdleSleep({uid,user,language,children}:{uid?:string;user?:User;language:Language;children:ReactNode}){
 const [asleep,setAsleep]=useState(false),[awakening,setAwakening]=useState(false)
 const sleepScreen=useRef<HTMLElement>(null),t=featureText[language]
 useEffect(()=>{
  if(!uid)return
  let enabled=readSleepEnabled(uid),last=Date.now(),sleeping=false,timer=0,wakeTimer=0,suppressUntil=0,scrollY=0,previousFocus:HTMLElement|null=null
  const dialogs:HTMLDialogElement[]=[]
  const wake=()=>{
   if(!sleeping)return
   sleeping=false;last=Date.now();suppressUntil=last+350;setAsleep(false);setAwakening(true)
   requestAnimationFrame(()=>{window.scrollTo({top:scrollY,behavior:'instant'});for(const dialog of dialogs)if(dialog.isConnected && !dialog.open)dialog.showModal();dialogs.length=0;previousFocus?.focus({preventScroll:true})})
   wakeTimer=window.setTimeout(()=>setAwakening(false),550)
  }
  const check=()=>{
   window.clearTimeout(timer)
   if(!enabled)return
   const remaining=IDLE_SLEEP_MS-(Date.now()-last)
   if(remaining>0){timer=window.setTimeout(check,remaining);return}
   if(!sleeping){sleeping=true;scrollY=window.scrollY;previousFocus=document.activeElement as HTMLElement;document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog=>{dialogs.push(dialog);dialog.close()});setAsleep(true)}
  }
  const activity=(event:Event)=>{
   if(sleeping){event.preventDefault();event.stopImmediatePropagation();wake();timer=window.setTimeout(check,IDLE_SLEEP_MS);return}
   if(Date.now()<suppressUntil && ['pointerdown','click','keydown','touchstart'].includes(event.type)){event.preventDefault();event.stopImmediatePropagation();return}
   last=Date.now()
  }
  const visibility=()=>{if(document.visibilityState==='visible')check()}
  const settings=(event:Event)=>{const value=(event as CustomEvent<{uid:string;enabled:boolean}>).detail;if(value.uid!==uid)return;enabled=value.enabled;last=Date.now();if(!enabled)wake();check()}
  const events=['pointerdown','pointermove','keydown','wheel','touchstart','input','click']
  events.forEach(type=>window.addEventListener(type,activity,{capture:true,passive:false}))
  document.addEventListener('visibilitychange',visibility);window.addEventListener('idle-settings-changed',settings)
  timer=window.setTimeout(check,IDLE_SLEEP_MS)
  return()=>{window.clearTimeout(timer);window.clearTimeout(wakeTimer);events.forEach(type=>window.removeEventListener(type,activity,true));document.removeEventListener('visibilitychange',visibility);window.removeEventListener('idle-settings-changed',settings)}
 },[uid])
 useEffect(()=>{if(asleep)sleepScreen.current?.focus({preventScroll:true})},[asleep])
 return <><div className={`private-content ${awakening?'is-awakening':''}`} hidden={asleep} inert={asleep} aria-hidden={asleep}>{children}</div>{asleep&&<section ref={sleepScreen} tabIndex={-1} className="sleep-screen" role="dialog" aria-modal="true" aria-labelledby="sleep-title"><h2 id="sleep-title">{t.sleeping}</h2><p>{t.wakeHint}</p>{user&&<AccountLifecycle user={user} language={language}><SleepCards user={user} language={language}/></AccountLifecycle>}</section>}</>
}
