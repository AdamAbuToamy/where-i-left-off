import { useEffect,useRef } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { useWorkflowPreferences } from '../lib/workflowPreferences'
import { useTaskOverview } from '../lib/useTaskOverview'
import { shouldArchive,recommendation } from '../lib/workflow'
import { OfflineWorkspace } from '../lib/offlineWorkspace'
import { auth,db } from '../lib/firebase'
import { workflowText } from '../workflowText'
import { logEvent } from '../lib/logging'
import { flushJournal } from '../lib/sessionJournal'
export default function WorkflowAgent({user,language}:{user:User;language:Language}){
 const prefs=useWorkflowPreferences(user.uid),t=workflowText[language],{allEntries,ready,suspended}=useTaskOverview(user,'Personal',false,false)
 const archiving=useRef(false)
 useEffect(()=>{const online=()=>void flushJournal(user.uid);online();window.addEventListener('online',online);return()=>window.removeEventListener('online',online)},[user.uid])
 useEffect(()=>{
  if(!ready||suspended||!prefs.autoArchive||archiving.current)return
  if(!allEntries.some(entry=>!entry.groupId&&shouldArchive(entry.project,true)))return
  archiving.current=true
  const workspace=new OfflineWorkspace(db!,user.uid,()=>auth?.currentUser?.uid===user.uid,()=>{})
  void workspace.archiveCompleted().then(()=>workspace.flush()).catch(error=>logEvent('workflow.auto-archive',error)).finally(()=>{archiving.current=false})
 },[allEntries,ready,suspended,prefs.autoArchive,user.uid])
 useEffect(()=>{
  if(!ready||suspended||!prefs.reminders||!prefs.desktop||!('Notification' in window)||Notification.permission!=='granted')return
  const candidate=allEntries.find(entry=>recommendation(entry)!==null)
  if(!candidate)return
  const day=new Date().toLocaleDateString(),key=`workflow-notice:${user.uid}:${day}`
  try{if(localStorage.getItem(key))return;void(async()=>{
   try{const registration='serviceWorker' in navigator?await navigator.serviceWorker.getRegistration():undefined
    if(registration)await registration.showNotification(t.focus,{body:candidate.project.name,tag:`workflow-${user.uid}`})
    else{const notice=new Notification(t.focus,{body:candidate.project.name,tag:`workflow-${user.uid}`});notice.onclick=()=>{window.focus();location.hash='/resume';notice.close()}}
    localStorage.setItem(key,'sent')
   }catch{/* Notifications are optional when the browser does not support them. */}
  })()}catch{/* Browser storage is optional. */}
 },[allEntries,ready,suspended,prefs.reminders,prefs.desktop,user.uid,t.focus])
 return null
}
