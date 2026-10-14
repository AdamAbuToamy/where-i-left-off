// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { User } from 'firebase/auth'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
const queue=vi.hoisted(()=>vi.fn())
vi.mock('../src/lib/sessionJournal',()=>({queueSession:queue,newSessionId:()=> 'Session00000000000000',useSessionHistory:()=>({items:[]})}))
vi.mock('../src/lib/logging',()=>({logEvent:vi.fn()}))
import FocusSession from '../src/components/FocusSession'
let root:Root,container:HTMLDivElement
const save=vi.fn(),project={id:'card',name:'Robot',nextStep:'Test',checkpoint:'Mounted bearing',status:'active' as const,rank:0,revision:0}
beforeEach(()=>{
 vi.useFakeTimers();queue.mockClear();save.mockReset().mockResolvedValue(true);sessionStorage.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true}})
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false}})
 container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<FocusSession project={project} user={{uid:'alice'} as User} groupId="team" language="en" onSave={save}/>))
 act(()=>container.querySelector<HTMLButtonElement>('.focus-launch')!.click())
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('saves the checkpoint and a personal session only after the card save succeeds',async()=>{
 act(()=>vi.advanceTimersByTime(60000))
 await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
 expect(save).toHaveBeenCalledWith({checkpoint:'Mounted bearing',nextStep:'Test',progressUnits:0},0)
 expect(queue).toHaveBeenCalledWith('alice',expect.objectContaining({seconds:60,groupId:'team',projectId:'card',checkpoint:'Mounted bearing'}))
 expect(container.querySelector('dialog')).toBeNull();expect(sessionStorage.length).toBe(0)
})
it('retains the draft and avoids crediting a failed save',async()=>{
 save.mockResolvedValue(false);act(()=>vi.advanceTimersByTime(10000))
 await act(async()=>{container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve()})
 expect(queue).not.toHaveBeenCalled();expect(container.querySelector('dialog')!.open).toBe(true);expect(container.querySelector('[role=alert]')).not.toBeNull();expect(sessionStorage.length).toBe(1)
})
