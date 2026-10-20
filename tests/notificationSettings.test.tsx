// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { User } from 'firebase/auth'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({call:vi.fn(),subscribe:vi.fn(),disconnect:vi.fn(),clear:vi.fn()}))
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{uid:'user-a'}}}))
vi.mock('../src/lib/useTaskOverview',()=>({useTaskOverview:()=>({ready:true,entries:[{project:{id:'a'.repeat(20),name:'Robot arm',status:'later',dueDate:'2026-10-20'}}]})}))
vi.mock('../src/lib/pushNotifications',()=>({pushCall:mock.call,pushSupported:()=>true,deviceSubscription:async()=>null,deviceOptedIn:()=>false,subscribeDevice:mock.subscribe,disconnectDevice:mock.disconnect,clearPushBinding:mock.clear,reminderKey:(id:string)=>`personal__${id}`}))
import NotificationSettings from '../src/components/NotificationSettings'
let root:Root,container:HTMLDivElement
const p={enabled:false,due:true,stale:false,staleDays:14,defaultTime:'09:00',leadMinutes:0,quiet:true,quietStart:'22:00',quietEnd:'08:00',hideContent:true,timezone:'UTC',language:'en'}
const user={uid:'user-a'} as User
async function click(text:string){await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===text)!.click()})}
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Notification',{permission:'default'})
 mock.call.mockReset();mock.subscribe.mockReset();mock.disconnect.mockReset();mock.clear.mockReset()
 mock.call.mockImplementation(async(data)=>data.action==='get'?{preferences:{...p},publicKey:'public-key',cards:{}}:{ok:true})
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
 await act(async()=>{root.render(<NotificationSettings user={user} language="en"/> )})
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('does not subscribe or ask for permission on opening settings',()=>{
 expect(mock.subscribe).not.toHaveBeenCalled()
 expect(container.textContent).toContain('Notifications are not enabled on this phone')
 expect(container.textContent).toContain('Robot arm')
})
it('enables only on a tap and persists explicit consent',async()=>{
 await click('Enable notifications on this phone')
 expect(mock.subscribe).toHaveBeenCalledWith('public-key','user-a',true)
 expect(mock.call).toHaveBeenCalledWith(expect.objectContaining({action:'save',preferences:expect.objectContaining({enabled:true,hideContent:true})}))
 await click('Disable notifications on this phone')
 expect(mock.disconnect).toHaveBeenCalled()
 expect(container.textContent).toContain('Notifications disabled on this phone')
})
it('does not enable the account when phone permission is denied',async()=>{
 mock.subscribe.mockRejectedValueOnce(new Error('denied'));vi.stubGlobal('Notification',{permission:'denied'})
 await click('Enable notifications on this phone')
 expect(mock.call.mock.calls.filter(([d])=>d.action==='save')).toHaveLength(0)
 expect(container.querySelector('[role=alert]')?.textContent).toContain('blocked')
})
it('saves categories without implicitly opting in',async()=>{
 const label=[...container.querySelectorAll('label')].find(l=>l.textContent?.includes('Remind me about cards'))!
 await act(async()=>{(label.querySelector('input') as HTMLInputElement).click()})
 await click('Save preferences')
 expect(mock.call).toHaveBeenCalledWith(expect.objectContaining({action:'save',preferences:expect.objectContaining({enabled:false,stale:true})}))
 expect(mock.subscribe).not.toHaveBeenCalled()
})
it('per-card opt-out does not alter task data or other cards',async()=>{
 const label=[...container.querySelectorAll('label')].find(l=>l.textContent==='Disable reminders for this card')!
 await act(async()=>{(label.querySelector('input') as HTMLInputElement).click()})
 await click('Save card reminder')
 expect(mock.call).toHaveBeenCalledWith({action:'card',projectId:'a'.repeat(20),groupId:'',disabled:true,weekly:false,time:''})
})
it('does not render controls for a different signed-in account',async()=>{
 await act(async()=>{root.render(<NotificationSettings user={{uid:'user-b'} as User} language="en"/>)})
 expect(container.textContent).toBe('')
})
