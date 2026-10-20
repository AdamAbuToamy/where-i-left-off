// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/lib/firebase',()=>({auth:null,db:null}))
import { installedApp,deviceOptedIn,setDeviceOptIn } from '../src/lib/pushNotifications'
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear()})
it('hides controls in ordinary browser tabs',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false}))
 expect(installedApp()).toBe(false)
})
it('recognizes installed Android and iPhone app modes',()=>{
 vi.stubGlobal('matchMedia',(query:string)=>({matches:query==='(display-mode: standalone)'}))
 expect(installedApp()).toBe(true)
 vi.stubGlobal('matchMedia',()=>({matches:false}));vi.stubGlobal('navigator',{standalone:true})
 expect(installedApp()).toBe(true)
})
it('keeps the phone opt-out across reloads and isolates it by account',()=>{
 expect(deviceOptedIn('a')).toBe(false)
 setDeviceOptIn('a',true);expect(deviceOptedIn('a')).toBe(true);expect(deviceOptedIn('b')).toBe(false)
 setDeviceOptIn('a',false);expect(deviceOptedIn('a')).toBe(false)
})
