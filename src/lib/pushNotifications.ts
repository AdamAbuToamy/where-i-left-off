import { getToken } from 'firebase/app-check'
import { useEffect, useState } from 'react'
import { auth, db, emulatorMode, appCheck } from './firebase'
import type { Language } from '../translations'

export type PushPreferences = { enabled:boolean; due:boolean; stale:boolean; staleDays:number; defaultTime:string; leadMinutes:number; quiet:boolean; quietStart:string; quietEnd:string; hideContent:boolean; timezone:string; language:Language }
export type CardReminder = { disabled?:boolean; weekly?:boolean; time?:string }
export type PushState = { preferences:PushPreferences; publicKey:string; cards:Record<string,CardReminder> }
export function installedApp() {
  return typeof window!=='undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & {standalone?:boolean}).standalone===true)
}
export function useInstalledApp() {
  const [installed,setInstalled]=useState(installedApp)
  useEffect(()=>{const media=window.matchMedia('(display-mode: standalone)'),update=()=>setInstalled(installedApp());media.addEventListener('change',update);window.addEventListener('appinstalled',update);return()=>{media.removeEventListener('change',update);window.removeEventListener('appinstalled',update)}},[])
  return installed
}
export function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext }
let pushEndpoint:Promise<string>|undefined
export function notificationEndpoint() {
  return pushEndpoint ||= fetch('/push-config.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('push-not-configured')
    const config=await response.json(),url=new URL(config.endpoint)
    if(url.protocol!=='https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.port || url.search || url.hash)throw new Error('push-not-configured')
    return url.href
  }).catch(error=>{pushEndpoint=undefined;throw error})
}
export async function pushCall<T=unknown>(data:Record<string,unknown>):Promise<T> {
  if (!db || !auth?.currentUser) throw new Error('Sign in first')
  const uid=auth.currentUser.uid
  const [endpoint,identity,appcheck]=await Promise.all([
    notificationEndpoint(),auth.currentUser.getIdToken(),
    emulatorMode?Promise.resolve({token:'local-browser-test-only'}):appCheck?getToken(appCheck,false):Promise.reject(new Error('app-check-required')),
  ])
  if(auth.currentUser?.uid!==uid)throw new Error('account-changed')
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${identity}`,'X-Firebase-AppCheck':appcheck.token},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('push-request-failed')
  const result=(await response.json()).result as T
  if(data.action==='save')window.dispatchEvent(new Event('push-preferences-changed'))
  return result
}
const BINDING_CACHE='wilo-push-device'
async function bind(uid:string) {
  const cache=await caches.open(BINDING_CACHE)
  await cache.put('/__push_owner',new Response(uid))
}
export async function clearPushBinding() {
  if ('caches' in window) await bind('')
  const registration=await navigator.serviceWorker?.getRegistration()
  const notifications=await registration?.getNotifications()
  notifications?.filter(n=>n.tag.startsWith('wilo-')).forEach(n=>n.close())
}
export async function deviceSubscription() {
  return (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
}
export function deviceOptedIn(uid:string) { try { return localStorage.getItem(`push-opt-in:${uid}`)==='true' } catch { return false } }
export function setDeviceOptIn(uid:string,enabled:boolean) { try { localStorage.setItem(`push-opt-in:${uid}`,String(enabled)) } catch { /* Push is optional without persistent storage. */ } }
export async function subscribeDevice(publicKey:string, uid:string, requestPermission=false) {
  if (!installedApp() || !pushSupported()) throw new Error('unsupported')
  // Called directly from a tap; iOS requires user interaction for this request.
  if (requestPermission && Notification.permission!=='granted') {
    if (await Notification.requestPermission()!=='granted') throw new Error('permission-denied')
  }
  if (Notification.permission!=='granted') throw new Error('permission-denied')
  const registration=await navigator.serviceWorker.ready
  let subscription=await registration.pushManager.getSubscription()
  if (!subscription) {
    const base64=publicKey.replace(/-/g,'+').replace(/_/g,'/')
    const key=Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'=')),c=>c.charCodeAt(0))
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
  }
  if(!requestPermission && !deviceOptedIn(uid)) throw new Error('device-disabled')
  if(auth?.currentUser?.uid!==uid) throw new Error('account-changed')
  await pushCall({action:'subscribe',subscription:subscription.toJSON()})
  if (auth?.currentUser?.uid!==uid) { await clearPushBinding(); throw new Error('account-changed') }
  if(!requestPermission && !deviceOptedIn(uid)) throw new Error('device-disabled')
  await bind(uid)
  if(requestPermission) setDeviceOptIn(uid,true)
  return subscription
}
export async function disconnectDevice() {
  if(auth?.currentUser) setDeviceOptIn(auth.currentUser.uid,false)
  await clearPushBinding()
  if (!pushSupported()) return
  const subscription=await deviceSubscription()
  if (!subscription) return
  // Clear the local delivery gate even if the network request fails.
  try { await pushCall({action:'unsubscribe',subscription:subscription.toJSON()}) }
  finally { await subscription.unsubscribe() }
}
const viewedAttempts=new Map<string,number>()
export async function markCardViewed(projectId:string,groupId='') {
  if (!auth?.currentUser || !navigator.onLine) return
  const key=`${auth.currentUser.uid}/${groupId}/${projectId}`
  if(Date.now()-(viewedAttempts.get(key) || 0)<60000)return
  viewedAttempts.set(key,Date.now())
  try { await pushCall({action:'viewed',projectId,groupId}) } catch { /* Activity tracking must not block card actions. */ }
}
export function reminderKey(projectId:string,groupId='') { return `${groupId || 'personal'}__${projectId}` }

export async function preparePushSignOut() {
  await clearPushBinding()
  if(!pushSupported())return
  const subscription=await deviceSubscription()
  if(subscription) void pushCall({action:'unsubscribe',subscription:subscription.toJSON()}).catch(()=>{})
}
