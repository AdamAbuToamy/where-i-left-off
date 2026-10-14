import { beforeEach,expect,it,vi } from 'vitest'
import { emptyState,projectedState,normalizedProject } from '../src/lib/offlineStore'
import type { OfflineState } from '../src/lib/offlineStore'
import type { Firestore } from 'firebase/firestore'
const memory=vi.hoisted(()=>({state:undefined as unknown as OfflineState,serial:0}))
vi.mock('../src/lib/offlineStore',async original=>({...await original<typeof import('../src/lib/offlineStore')>(),updateLocal:async(_key:string,change:(s:OfflineState)=>OfflineState)=>{memory.state=change(memory.state)}}))
vi.mock('firebase/firestore',async original=>({...await original<typeof import('firebase/firestore')>(),collection:()=>({}),doc:()=>({id:`mutation${++memory.serial}`})}))
import { OfflineWorkspace } from '../src/lib/offlineWorkspace'
const db={app:{options:{projectId:'demo-sections'}}} as Firestore
beforeEach(()=>{memory.state=emptyState();memory.serial=0;memory.state.sections=[{id:'first',name:'First',revision:0},{id:'last',name:'Last',revision:0}];memory.state.projects=[normalizedProject('card',{name:'Keep me',sectionId:'first',revision:2,checklist:'[x] Saved'}),normalizedProject('other',{name:'Other',sectionId:'last'})]})
it('deletes a nonempty first section while preserving its cards and queues moves before section removal',async()=>{
 const workspace=new OfflineWorkspace(db,'alice',()=>true,()=>{})
 await workspace.deleteSection('first')
 const view=projectedState(memory.state)
 expect(view.sections.map(s=>s.id)).toEqual(['last'])
 expect(view.projects.find(p=>p.id==='card')).toMatchObject({name:'Keep me',sectionId:'',revision:3,checklist:'[x] Saved'})
 expect(view.projects.find(p=>p.id==='other')?.sectionId).toBe('last')
 expect(memory.state.operations.map(op=>op.entity)).toEqual(['project','section'])
})
it('rejects a switched account without modifying its cached state',async()=>{
 const workspace=new OfflineWorkspace(db,'alice',()=>false,()=>{})
 await expect(workspace.deleteSection('first')).rejects.toThrow('permission-denied')
 expect(memory.state.operations).toHaveLength(0)
})
it('archives all eligible personal completions in one local update and preserves recent completions',async()=>{
 const now=Date.now(),old=now-8*86400000
 memory.state.projects=[normalizedProject('old1',{name:'One',status:'done',completedAt:old}),normalizedProject('old2',{name:'Two',status:'done',completedAt:old}),normalizedProject('recent',{name:'Recent',status:'done',completedAt:now})]
 const workspace=new OfflineWorkspace(db,'alice',()=>true,()=>{})
 await workspace.archiveCompleted()
 const view=projectedState(memory.state)
 expect(view.projects.filter(p=>p.archivedAt).map(p=>p.id).sort()).toEqual(['old1','old2'])
 expect(memory.state.operations).toHaveLength(2)
})
it('does not apply personal automatic archiving to a group workspace',async()=>{
 const workspace=new OfflineWorkspace(db,'alice',()=>true,()=>{},'team')
 await expect(workspace.archiveCompleted()).rejects.toThrow('permission-denied')
 expect(memory.state.operations).toHaveLength(0)
})
