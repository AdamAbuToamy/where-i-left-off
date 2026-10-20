import { useEffect } from 'react'
import type { User } from 'firebase/auth'
import { deviceOptedIn, clearPushBinding, installedApp, pushSupported, pushCall, subscribeDevice } from '../lib/pushNotifications'
import type { PushState } from '../lib/pushNotifications'
export default function PushLifecycle({user}:{user:User|null}) {
  useEffect(()=>{
    if (!installedApp() || !pushSupported()) return
    let alive=true
    const refresh=async()=>{
      try {
        await clearPushBinding()
        if (!user || !deviceOptedIn(user.uid) || Notification.permission!=='granted' || !navigator.onLine) return
        const state=await pushCall<PushState>({action:'get'})
        if(alive && deviceOptedIn(user.uid) && state.preferences.enabled) await subscribeDevice(state.publicKey,user.uid)
      } catch { /* Retry on next online event or from notification settings. */ }
    }
    void refresh();window.addEventListener('online',refresh)
    return()=>{alive=false;window.removeEventListener('online',refresh);void clearPushBinding().catch(()=>{})}
  },[user])
  return null
}
