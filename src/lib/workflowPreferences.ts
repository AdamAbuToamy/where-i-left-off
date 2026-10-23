import { createClientId } from './clientId'
import { useEffect,useState } from 'react'
import { doc,onSnapshot,setDoc,serverTimestamp } from 'firebase/firestore'
import { db,auth } from './firebase'
import { logEvent } from './logging'
export type WorkflowPreferences={autoArchive:boolean;reminders:boolean;desktop:boolean;reviewDays:number}
export const defaultPreferences:WorkflowPreferences={autoArchive:false,reminders:true,desktop:false,reviewDays:30}
const key=(uid:string)=>`workflow-preferences:${db?.app.options.projectId}/${uid}`
const pendingKey=(uid:string)=>`${key(uid)}:pending`
const writes=new Map<string,Promise<void>>()
function pending(uid:string){try{return localStorage.getItem(pendingKey(uid))}catch{return null}}
function notify(){window.dispatchEvent(new Event('workflow-preferences-changed'))}
export function readPreferences(uid:string):WorkflowPreferences{try{const queued=pending(uid);const saved=queued?JSON.parse(queued).value:JSON.parse(localStorage.getItem(key(uid)) || '{}');return{autoArchive:saved.autoArchive===true,reminders:saved.reminders!==false,desktop:saved.desktop===true,reviewDays:[7,14,30,60,90].includes(saved.reviewDays)?saved.reviewDays:30}}catch{return defaultPreferences}}
export function flushPreferences(uid:string):Promise<void>{
 const active=writes.get(uid);if(active)return active
 const write=(async()=>{
  let queued=pending(uid)
  while(queued){
   if(auth?.currentUser?.uid!==uid)throw new Error('permission-denied')
   const {value}=JSON.parse(queued) as {value:WorkflowPreferences}
   await setDoc(doc(db!,'users',uid,'preferences','workflow'),{...value,updatedAt:serverTimestamp()})
   if(pending(uid)===queued){localStorage.setItem(key(uid),JSON.stringify(value));localStorage.removeItem(pendingKey(uid))}
   queued=pending(uid)
  }
 })().catch(error=>{logEvent('workflow.preferences',error);throw error}).finally(()=>{writes.delete(uid);notify()})
 writes.set(uid,write);return write
}
export async function savePreferences(uid:string,value:WorkflowPreferences){
 if(auth?.currentUser?.uid!==uid)throw new Error('permission-denied')
 // Persist the outbox before writing so a reload cannot discard the choice.
 localStorage.setItem(pendingKey(uid),JSON.stringify({value,id:createClientId()}))
 localStorage.setItem(key(uid),JSON.stringify(value));notify()
 await flushPreferences(uid)
}
export function useWorkflowPreferences(uid:string){
 const [value,setValue]=useState(()=>readPreferences(uid))
 useEffect(()=>{
  const local=()=>setValue(readPreferences(uid));window.addEventListener('workflow-preferences-changed',local)
  const retry=()=>{if(pending(uid)&&auth?.currentUser?.uid===uid)void flushPreferences(uid).catch(()=>{/* Error already logged; retain the local outbox. */})}
  local();retry();window.addEventListener('online',retry)
  const stop=onSnapshot(doc(db!,'users',uid,'preferences','workflow'),{includeMetadataChanges:true},snapshot=>{
   if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites||pending(uid)||writes.has(uid))return
   try{localStorage.setItem(key(uid),JSON.stringify(snapshot.exists()?snapshot.data():defaultPreferences))}catch{/* Local storage is optional for server reads. */}
   local()
  },error=>logEvent('workflow.preferences.read',error))
  return()=>{stop();window.removeEventListener('workflow-preferences-changed',local);window.removeEventListener('online',retry)}
 },[uid])
 return value
}
