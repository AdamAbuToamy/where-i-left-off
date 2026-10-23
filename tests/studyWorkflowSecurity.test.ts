import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,it,expect,vi} from 'vitest'
import {initializeTestEnvironment} from '@firebase/rules-unit-testing'
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing'
import {doc,getDoc} from 'firebase/firestore'
import {FirestoreStudyRemote} from '../src/university/firestoreStudyRemote'
import {UniversityRepository} from '../src/university/studyRepository'
import {UniversityStore,emptyUniversity} from '../src/university/model'
import {studyToday} from '../src/university/studyTools'
import type {StudySyncStatus} from '../src/university/studyRepository'
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:'alice'}}}))
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db},auth:runtime.auth}))
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class {read=async()=>({projects:[],sections:[],operations:[]})}}))
import {AssistantRepository} from '../src/assistant/assistantRepository'
import {planAssistantChanges} from '../src/assistant/actions'
let env:RulesTestEnvironment
const storage=new Map<string,string>()
beforeAll(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-study-workflow',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}})
 vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v)})
 vi.stubGlobal('window',{dispatchEvent:()=>true})
})
afterAll(async()=>{vi.unstubAllGlobals();await env?.cleanup()})
async function until(check:()=>boolean) {const start=Date.now();while(!check()){if(Date.now()-start>8000)throw new Error('workflow-timeout');await new Promise(r=>setTimeout(r,20))}}
it('syncs the planner across devices, feeds Continue now, and observes reviewed AI edits and undo through the same Firebase records',async()=>{
 await env.clearFirestore()
 const db=env.authenticatedContext('alice',{email_verified:true}).firestore();runtime.db=db
 const remote=new FirestoreStudyRemote(db,'alice',()=>runtime.auth.currentUser.uid)
 const a=new UniversityRepository(new UniversityStore('alice','device-a'),remote),b=new UniversityRepository(new UniversityStore('alice','device-b'),new FirestoreStudyRemote(db,'alice',()=>runtime.auth.currentUser.uid))
 let first=emptyUniversity(),second=emptyUniversity(),status:StudySyncStatus={ready:false,pending:0,conflicts:[],error:''}
 a.start((s,v)=>{first=s;status=v});b.start(s=>{second=s})
 try {
  await until(()=>status.ready)
  const now=new Date(),due=new Date(now);due.setHours(23,59,0,0)
  const course=(id:string)=>({id,name:id,url:'',notes:'',requires:[],topics:[],x:0,y:0})
  a.commit({...first,courses:[course('a'),course('b')],tasks:[{id:'t',courseId:'a',title:'Homework',kind:'assignment',due:due.toISOString(),notes:'',done:false,url:''}],lessons:[{id:'l',courseId:'a',day:now.getDay(),start:'09:00',end:'10:00',room:'90',sessionType:'tutorial'}]})
  await until(()=>second.courses.length===2&&second.tasks.length===1&&second.lessons.length===1&&status.pending===0)
  expect(studyToday(second,now).tasks.map(t=>t.title)).toContain('Homework');expect(studyToday(second,now).lessons[0].room).toBe('90')
  const assistant=new AssistantRepository('alice'),snapshot=await assistant.read()
  const receipt=await assistant.apply(snapshot,planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'b',values:{requires:['a']}}]))
  await until(()=>second.courses.find(c=>c.id==='b')?.requires[0]==='a')
  await assistant.undo(receipt);await until(()=>second.courses.find(c=>c.id==='b')?.requires.length===0)
  const bob=env.authenticatedContext('bob',{email_verified:true}).firestore()
  await expect(getDoc(doc(bob,'users/alice/studyRecords/courses_a'))).rejects.toThrow()
  runtime.auth.currentUser={uid:'bob'}
  await expect(remote.write('courses_a',()=>{throw new Error('must-not-run')})).rejects.toThrow('account-changed')
 } finally {a.stop();b.stop();runtime.auth.currentUser={uid:'alice'}}
})
