// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { User } from 'firebase/auth'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({reauth:vi.fn(),update:vi.fn(),setDoc:vi.fn(),snapshot:undefined as undefined|((value:unknown)=>void)}))
vi.mock('../src/lib/firebase',()=>({db:{},auth:{}}))
vi.mock('../src/lib/logging',()=>({logEvent:vi.fn()}))
vi.mock('firebase/auth',()=>({EmailAuthProvider:{credential:(email:string,password:string)=>({email,password})},reauthenticateWithCredential:mocks.reauth,updatePassword:mocks.update,sendEmailVerification:vi.fn()}))
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...parts:string[])=>parts.join('/'),serverTimestamp:()=> 'server-time',setDoc:mocks.setDoc,onSnapshot:(_ref:unknown,_options:unknown,receive:(value:unknown)=>void)=>{mocks.snapshot=receive;return()=>{}}}))
import PasswordChange from '../src/components/PasswordChange'
let root:Root,container:HTMLDivElement
const token=vi.fn()
const user={uid:'alice',email:'alice@example.test',emailVerified:true,providerData:[{providerId:'password'}],getIdToken:token} as unknown as User
function type(id:string,value:string){act(()=>{const input=container.querySelector<HTMLInputElement>(`#${id}`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function submit(){await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.reauth.mockReset().mockResolvedValue({});mocks.update.mockReset().mockResolvedValue(undefined);mocks.setDoc.mockReset().mockResolvedValue(undefined);token.mockReset().mockResolvedValue('fresh')
 container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<PasswordChange user={user} language="en"/>))
 act(()=>mocks.snapshot?.({metadata:{fromCache:false},data:()=>({availableUntil:{toMillis:()=>Date.now()+3600000}})}))
 type('password-current','old-password');type('password-new','new-password');type('password-confirm','new-password')
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('reauthenticates before updating and queues only a server-addressed confirmation',async()=>{
 await submit();expect(mocks.reauth).toHaveBeenCalledWith(user,{email:user.email,password:'old-password'});expect(mocks.update).toHaveBeenCalledWith(user,'new-password')
 expect(mocks.reauth.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);expect(token).toHaveBeenCalledWith(true)
 expect(mocks.setDoc).toHaveBeenCalledWith('securityNotifications/alice',{status:'pending',event:'password-changed',language:'en',requestedAt:'server-time'})
 expect(container.textContent).toContain('Password changed.');expect(container.querySelector<HTMLInputElement>('#password-new')!.value).toBe('')
})
it('reports a successful password change even when confirmation fails',async()=>{
 mocks.setDoc.mockRejectedValue({code:'permission-denied'});await submit()
 expect(container.textContent).toContain('Password changed.');expect(container.querySelector('[role=alert]')).toBeNull();expect(container.querySelector<HTMLInputElement>('#password-current')!.value).toBe('')
})
it('does not change the password or queue mail after failed reauthentication',async()=>{
 mocks.reauth.mockRejectedValue({code:'auth/invalid-credential'});await submit();expect(mocks.update).not.toHaveBeenCalled();expect(mocks.setDoc).not.toHaveBeenCalled();expect(container.querySelector('[role=alert]')).not.toBeNull()
})
it('explains missing email verification after a successful password change',async()=>{
 act(()=>root.render(<PasswordChange user={{...user,emailVerified:false} as User} language="en"/>))
 await submit();expect(mocks.update).toHaveBeenCalledOnce();expect(mocks.setDoc).not.toHaveBeenCalled();expect(container.textContent).toContain('Password changed.')
})
it('disables saving when new passwords mismatch or repeat the current password',()=>{
 type('password-confirm','mismatch');expect(container.querySelector<HTMLButtonElement>('form button')!.disabled).toBe(true)
 type('password-new','old-password');type('password-confirm','old-password');expect(container.querySelector<HTMLButtonElement>('form button')!.disabled).toBe(true)
})
