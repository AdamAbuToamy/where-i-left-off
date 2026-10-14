import { mergeSessionCache } from './sessionCache'
import { useEffect,useState } from 'react'
import { collection,doc,onSnapshot,orderBy,query,limit,setDoc,serverTimestamp } from 'firebase/firestore'
import { auth,db } from './firebase'
import { logEvent } from './logging'
export type SessionEntry={id:string;projectId:string;projectName:string;groupId:string;resourceType:string;startedAt:number;endedAt:number;seconds:number;checkpoint:string;nextStep:string;pending?:boolean}
const key=(uid:string)=>`session-journal:${db?.app.options.projectId}/${uid}`
export function readJournal(uid:string):SessionEntry[]{try{const value=JSON.parse(localStorage.getItem(key(uid)) || '[]');return Array.isArray(value)?value:[]}catch{return []}}
function remember(uid:string,items:SessionEntry[]){const text=JSON.stringify(items.slice(0,500));if(localStorage.getItem(key(uid))===text)return;localStorage.setItem(key(uid),text);window.dispatchEvent(new CustomEvent('session-journal-changed',{detail:uid}))}
const flushing=new Set<string>()
export async function flushJournal(uid:string){
 if(flushing.has(uid)||!navigator.onLine||auth?.currentUser?.uid!==uid)return
 flushing.add(uid)
 try{for(const entry of readJournal(uid).filter(s=>s.pending)){
  if(auth?.currentUser?.uid!==uid)break
  const {id,pending:queued,...data}=entry;void queued
  await setDoc(doc(db!,'users',uid,'sessions',id),{...data,receivedAt:serverTimestamp()})
  remember(uid,readJournal(uid).map(s=>s.id===id?{...s,pending:false}:s))
 }}catch(error){logEvent('session.sync',error)}finally{flushing.delete(uid)}
}
export function queueSession(uid:string,entry:Omit<SessionEntry,'pending'>){
 if(auth?.currentUser?.uid!==uid)throw new Error('permission-denied')
 remember(uid,[{...entry,pending:true},...readJournal(uid).filter(s=>s.id!==entry.id)].sort((a,b)=>b.startedAt-a.startedAt))
 void flushJournal(uid)
}
export function newSessionId(uid:string){return doc(collection(db!,'users',uid,'sessions')).id}
export function useSessionHistory(uid:string,enabled=true){
 const [items,setItems]=useState(()=>enabled?readJournal(uid):[]),[cached,setCached]=useState(true),[truncated,setTruncated]=useState(false)
 useEffect(()=>{
  if(!enabled)return
  const local=(event:Event)=>{if((event as CustomEvent).detail===uid)setItems(readJournal(uid))},online=()=>void flushJournal(uid)
  window.addEventListener('session-journal-changed',local);window.addEventListener('online',online)
  const stop=onSnapshot(query(collection(db!,'users',uid,'sessions'),orderBy('startedAt','desc'),limit(500)),{includeMetadataChanges:true},snapshot=>{
   setCached(snapshot.metadata.fromCache);setTruncated(snapshot.size===500)
   const remote=snapshot.docs.map(s=>({...s.data(),id:s.id,pending:false} as SessionEntry))
   try{remember(uid,mergeSessionCache(remote,readJournal(uid),snapshot.metadata.fromCache));setItems(readJournal(uid))}catch(error){logEvent('session.cache',error);setItems(remote)}
  },error=>{setCached(true);logEvent('session.list',error)})
  void flushJournal(uid)
  return()=>{stop();window.removeEventListener('session-journal-changed',local);window.removeEventListener('online',online)}
 },[uid,enabled])
 return{items,cached,truncated}
}
