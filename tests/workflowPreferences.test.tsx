// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
const mocks=vi.hoisted(()=>({set:vi.fn(),snapshot:vi.fn(),auth:{currentUser:{uid:'alice'} as {uid:string}|null}}))
vi.mock('firebase/firestore',()=>({doc:()=>({}),setDoc:mocks.set,onSnapshot:mocks.snapshot,serverTimestamp:()=> 'server-time'}))
vi.mock('../src/lib/firebase',()=>({db:{app:{options:{projectId:'test'}}},auth:mocks.auth}))
vi.mock('../src/lib/logging',()=>({logEvent:vi.fn()}))
import { readPreferences,savePreferences,useWorkflowPreferences } from '../src/lib/workflowPreferences'
import WorkflowSettings from '../src/components/WorkflowSettings'
let root:Root,container:HTMLDivElement,resolve:()=>void,reject:(e:Error)=>void
let listeners:Array<(s:{metadata:{fromCache:boolean;hasPendingWrites:boolean};exists:()=>boolean;data:()=>object})=>void>
const stale=()=>listeners.forEach(fn=>fn({metadata:{fromCache:false,hasPendingWrites:false},exists:()=>false,data:()=>({})}))
function Probe(){const value=useWorkflowPreferences('alice');return <span>{String(value.autoArchive)}</span>}
beforeEach(()=>{
 localStorage.clear();mocks.auth.currentUser={uid:'alice'};listeners=[]
 mocks.set.mockReset().mockImplementation(()=>new Promise<void>((yes,no)=>{resolve=yes;reject=no}))
 mocks.snapshot.mockImplementation((_ref:unknown,_opts:unknown,fn:typeof listeners[number])=>{listeners.push(fn);return()=>{listeners=listeners.filter(item=>item!==fn)}})
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('keeps a pending choice across remount and ignores an older empty server snapshot until acknowledgement',async()=>{
 act(()=>root.render(<Probe/>))
 let saved:Promise<void>
 act(()=>{saved=savePreferences('alice',{autoArchive:true,reminders:true,desktop:false,reviewDays:30});stale()})
 expect(readPreferences('alice').autoArchive).toBe(true);expect(container.textContent).toBe('true')
 act(()=>root.render(null));act(()=>root.render(<Probe/>));act(stale)
 expect(container.textContent).toBe('true');expect(mocks.set).toHaveBeenCalledTimes(1)
 await act(async()=>{resolve();await saved!})
 expect(readPreferences('alice').autoArchive).toBe(true)
 expect(localStorage.getItem('workflow-preferences:test/alice:pending')).toBeNull()
})
it('shows saving until server acknowledgement and reports failures while retaining the retry outbox',async()=>{
 act(()=>root.render(<WorkflowSettings uid="alice" language="en"/>))
 act(()=>container.querySelector<HTMLInputElement>('input')!.click())
 expect(container.querySelector('section')!.getAttribute('aria-busy')).toBe('true')
 expect(container.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
 await act(async()=>{reject(new Error('permission-denied'));await Promise.resolve()})
 expect(container.querySelector('section')!.getAttribute('aria-busy')).toBe('false')
 expect(container.querySelector('[role=alert]')).not.toBeNull()
 expect(localStorage.getItem('workflow-preferences:test/alice:pending')).not.toBeNull()
})
