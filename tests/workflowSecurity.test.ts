import { readFileSync } from 'node:fs'
import { beforeAll,beforeEach,afterAll,describe,it } from 'vitest'
import { initializeTestEnvironment,assertSucceeds,assertFails } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc,getDoc,setDoc,updateDoc,serverTimestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { createGroup,createInvite,joinGroup } from '../src/lib/groups'
let env:RulesTestEnvironment
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('workflow privacy and permissions',()=>{
 beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-workflow-security',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}})})
 beforeEach(async()=>{await env.clearFirestore()})
 afterAll(async()=>{await env?.cleanup()})
 const client=(uid:string)=>env.authenticatedContext(uid,{email:`${uid}@example.test`}).firestore()
 const card=()=>({name:'Course',nextStep:'Continue',status:'active',rank:0,revision:0,updatedAt:serverTimestamp(),activityAt:1000,completedAt:0,archivedAt:0,trashedAt:0,resourceType:'course',progressUnits:0,totalUnits:10})
 it('keeps archive, trash and preferences private and validates automatic-archive settings',async()=>{
  const alice=client('alice'),bob=client('bob'),ref=doc(alice,'users/alice/projects/card')
  await assertSucceeds(setDoc(ref,card()))
  await assertSucceeds(updateDoc(ref,{archivedAt:1000,revision:1,updatedAt:serverTimestamp()}))
  await assertSucceeds(updateDoc(ref,{archivedAt:0,trashedAt:2000,revision:2,updatedAt:serverTimestamp()}))
  await assertFails(getDoc(doc(bob,'users/alice/projects/card')))
  const prefs=doc(alice,'users/alice/preferences/workflow'),data={autoArchive:true,reminders:true,desktop:false,reviewDays:30,updatedAt:serverTimestamp()}
  await assertSucceeds(setDoc(prefs,data));await assertFails(getDoc(doc(bob,'users/alice/preferences/workflow')))
  await assertFails(setDoc(prefs,{...data,autoArchive:'true'}));await assertFails(setDoc(prefs,{...data,reviewDays:0}))
 })
 it('keeps session history owner-only, immutable and bounded while allowing an idempotent receipt retry',async()=>{
  const alice=client('alice'),bob=client('bob'),ref=doc(alice,'users/alice/sessions/session')
  const data={projectId:'card',projectName:'Course',groupId:'',resourceType:'course',startedAt:1000,endedAt:61000,seconds:60,checkpoint:'Lesson 3',nextStep:'Lesson 4',receivedAt:serverTimestamp()}
  await assertSucceeds(setDoc(ref,data));await assertSucceeds(setDoc(ref,data))
  await assertFails(getDoc(doc(bob,'users/alice/sessions/session')))
  await assertFails(updateDoc(ref,{seconds:5400,receivedAt:serverTimestamp()}))
  await assertFails(setDoc(doc(alice,'users/alice/sessions/too-long'),{...data,endedAt:10000000,seconds:5401}))
  await assertFails(setDoc(doc(bob,'users/alice/sessions/forged'),data))
 })
 it('allows assigned progress and follow-up edits but forbids members from archiving shared cards',async()=>{
  const owner=client('owner'),member=client('member'),user=(uid:string)=>({uid,email:`${uid}@example.test`,displayName:uid}) as User
  const gid=await createGroup(owner,user('owner'),'Team'),invite=await createInvite(owner,user('owner'),{id:gid,name:'Team',role:'manager'})
  await joinGroup(member,user('member'),invite)
  await setDoc(doc(owner,'groups',gid,'projects','card'),{...card(),assignedTo:'member'})
  const ref=doc(member,'groups',gid,'projects','card')
  await assertSucceeds(updateDoc(ref,{progressUnits:3,activityAt:2000,followUpDate:'2026-10-20',revision:1,updatedAt:serverTimestamp()}))
  await assertFails(updateDoc(ref,{archivedAt:3000,revision:2,updatedAt:serverTimestamp()}))
  await assertFails(updateDoc(ref,{trashedAt:3000,revision:2,updatedAt:serverTimestamp()}))
  await assertFails(updateDoc(ref,{resourceType:'book',revision:2,updatedAt:serverTimestamp()}))
 })
})
