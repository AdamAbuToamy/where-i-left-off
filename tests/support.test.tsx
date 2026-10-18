// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { User } from 'firebase/auth'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({send:vi.fn()}))
vi.mock('../src/lib/firebase',()=>({db:{}}))
vi.mock('../src/lib/feedback',async original=>({...await original<typeof import('../src/lib/feedback')>(),sendFeedback:mocks.send,watchFeedback:(_db:unknown,_uid:unknown,_admin:unknown,receive:(items:unknown[])=>void)=>{receive([]);return()=>{}}}))
import Support from '../src/components/Support'
let root:Root,container:HTMLDivElement
const user={uid:'alice'} as User
function type(selector:string,value:string){act(()=>{const input=container.querySelector(selector)!;const prototype=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
async function submit(){await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);mocks.send.mockReset().mockResolvedValue('request-123');container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<Support user={user} language="en"/>));type('#support-subject','A meaningful request');type('#support-message','This is a private bug report.');})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('requires consent, clears only after confirmed submission and shows reference',async()=>{
 await submit();expect(mocks.send).not.toHaveBeenCalled()
 act(()=>container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await submit()
 expect(mocks.send).toHaveBeenCalledWith({},'alice','suggestion','A meaningful request','This is a private bug report.','en')
 expect(container.textContent).toContain('request-123');expect(container.querySelector<HTMLInputElement>('#support-subject')!.value).toBe('')
})
it('retains user text when submission fails',async()=>{
 mocks.send.mockRejectedValue(new Error('support-offline'));act(()=>container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await submit()
 expect(container.querySelector('[role=alert]')?.textContent).toContain('Nothing has been submitted')
 expect(container.querySelector<HTMLTextAreaElement>('#support-message')!.value).toBe('This is a private bug report.')
})
