import {useEffect,useRef} from 'react'
import type {User} from 'firebase/auth'
import {useTaskOverview} from '../lib/useTaskOverview'
import {pushCall} from '../lib/pushNotifications'
import type {PushState} from '../lib/pushNotifications'
export default function CloudPushSync({user}:{user:User}) {
 const {allEntries,ready,suspended}=useTaskOverview(user,'Personal',true)
 const last=useRef('')
 useEffect(()=>{
  if(!ready||suspended)return
  let alive=true
  const signature=JSON.stringify(allEntries.map(e=>[e.groupId,e.project.id,e.project.revision,e.project.assignedTo]))
  const sync=async()=>{
   if(!alive || !navigator.onLine || last.current===signature)return
   try {
    const state=await pushCall<PushState>({action:'get'})
    if(!alive)return
    if(!state.preferences.enabled){last.current=signature;return}
    if(last.current===signature)return
    await pushCall({action:'sync',cards:allEntries.filter(e=>e.groupId).slice(0,8).map(e=>({projectId:e.project.id,groupId:e.groupId}))})
    if(alive)last.current=signature
   } catch { /* Retry after reconnecting or the next periodic sync. */ }
  }
  const timer=window.setTimeout(()=>void sync(),1500)
  const retry=window.setInterval(()=>void sync(),60000)
  const online=()=>{last.current='';void sync()}
  window.addEventListener('online',online);window.addEventListener('push-preferences-changed',online)
  return()=>{alive=false;clearTimeout(timer);clearInterval(retry);window.removeEventListener('online',online);window.removeEventListener('push-preferences-changed',online)}
 },[allEntries,ready,suspended,user.uid])
 return null
}
