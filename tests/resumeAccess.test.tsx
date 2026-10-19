// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import type { User } from 'firebase/auth'
import type { GroupInfo } from '../src/types'
import type { OfflineSnapshot } from '../src/lib/offlineWorkspace'
const callbacks=vi.hoisted(()=>({sources:new Map<string,(s:OfflineSnapshot)=>void>(),groups:undefined as undefined|((g:GroupInfo[],cached:boolean)=>void),metric:undefined as undefined|((m:{suspended:boolean})=>void)}))
vi.mock('../src/lib/firebase',()=>({db:{app:{options:{projectId:'demo-resume'}}},auth:{currentUser:{uid:'alice'}}}))
vi.mock('../src/lib/logging',()=>({logEvent:vi.fn()}))
vi.mock('../src/lib/repository',()=>({watchUserMetric:(_db:unknown,_uid:string,receive:typeof callbacks.metric)=>{callbacks.metric=receive;return()=>{}}}))
vi.mock('../src/lib/groups',()=>({watchGroups:(_db:unknown,_uid:string,receive:typeof callbacks.groups)=>{callbacks.groups=receive;return()=>{}}}))
vi.mock('../src/lib/createWorkspace',()=>({createWorkspace:(_db:unknown,_uid:string,_valid:unknown,receive:(s:OfflineSnapshot)=>void,id?:string)=>new class{
 receive:(s:OfflineSnapshot)=>void;id:string
 constructor(){this.receive=receive;this.id=id || ''}
 start(){callbacks.sources.set(this.id,this.receive);return()=>callbacks.sources.delete(this.id)}
}()}))
import { useTaskOverview } from '../src/lib/useTaskOverview'
let root:Root,container:HTMLDivElement
function Overview(){const value=useTaskOverview({uid:'alice'} as User,'Personal');return <output>{JSON.stringify(value)}</output>}
const state=()=>JSON.parse(container.textContent!)
function emit(id:string,projects:OfflineSnapshot['projects'],error:unknown=null){act(()=>callbacks.sources.get(id)?.({projects,sections:[],queued:0,syncing:false,conflicts:[],error,cached:true}))}
const task=(id:string,assignedTo='')=>({id,assignedTo,name:id,nextStep:'Next',status:'active' as const,rank:0,revision:0})
beforeEach(()=>{
 localStorage.clear();callbacks.sources.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<Overview/>))
 act(()=>callbacks.groups?.([{id:'team',name:'Team',role:'member'}],false))
 emit('',[task('private')]);emit('team',[task('mine','alice'),task('other','bob'),task('unassigned')])
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('includes all personal cards but only group cards assigned to the signed-in user',()=>{
 expect(state().entries.map((e:{project:{id:string}})=>e.project.id)).toEqual(['private','mine']);expect(state().ready).toBe(true);expect(state().cached).toBe(true)
})
it('removes revoked groups and stops their subscriptions before export',()=>{
 act(()=>callbacks.groups?.([],false));expect(state().entries.map((e:{project:{id:string}})=>e.project.id)).toEqual(['private']);expect(callbacks.sources.has('team')).toBe(false)
})
it('blocks cached task export for suspended accounts and permission-denied sources',()=>{
 emit('team',[task('mine','alice')],{code:'permission-denied'});expect(state().entries).toHaveLength(1)
 act(()=>callbacks.metric?.({suspended:true}));expect(state().entries).toHaveLength(0);expect(state().suspended).toBe(true);expect(state().ready).toBe(false)
})
