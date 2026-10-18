import { readFileSync } from 'node:fs'
import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest'
import { initializeTestEnvironment,assertFails,assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection,doc,getDoc,getDocs,query,where,serverTimestamp,setDoc,updateDoc,writeBatch,Timestamp } from 'firebase/firestore'
let env:RulesTestEnvironment
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-feedback-security',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}})})
beforeEach(async()=>{await env.clearFirestore()})
afterAll(async()=>{await env?.cleanup()})
function submit(uid='alice',override={},includeRate=true){
 const db=env.authenticatedContext(uid).firestore(),ref=doc(collection(db,'feedback')),batch=writeBatch(db)
 batch.set(ref,{uid,kind:'bug',subject:'Sync issue',message:'First line\nSecond meaningful line',language:'en',status:'open',reply:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...override})
 if(includeRate)batch.set(doc(db,`users/${uid}/supportRate/state`),{lastId:ref.id,submittedAt:serverTimestamp()})
 return {ref,commit:()=>batch.commit()}
}
it('requires authentication, verified ownership and an atomic rate marker',async()=>{
 await assertFails(submit('alice',{uid:'bob'}).commit());await assertFails(submit('alice',{},false).commit())
 const sent=submit();await assertSucceeds(sent.commit())
 await assertFails(submit().commit())
 await assertSucceeds(getDoc(sent.ref))
 const bob=env.authenticatedContext('bob').firestore()
 await assertFails(getDoc(doc(bob,sent.ref.path)))
 await assertFails(getDocs(collection(bob,'feedback')))
 await assertSucceeds(getDocs(query(collection(bob,'feedback'),where('uid','==','bob'))))
 expect((await getDoc(sent.ref)).data()?.message).toContain('\n')
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),sent.ref.path)))
})
it('only a verified administrator can reply and cannot rewrite the original request',async()=>{
 const sent=submit();await sent.commit()
 await assertFails(updateDoc(sent.ref,{reply:'Forged answer',updatedAt:serverTimestamp()}))
 const unverified=env.authenticatedContext('admin',{email:'adam2002hosny@gmail.com',email_verified:false}).firestore()
 await assertFails(updateDoc(doc(unverified,sent.ref.path),{reply:'Answer',updatedAt:serverTimestamp()}))
 const admin=env.authenticatedContext('admin',{email:'adam2002hosny@gmail.com',email_verified:true}).firestore(),ref=doc(admin,sent.ref.path)
 await assertSucceeds(updateDoc(ref,{status:'reviewing',reply:'We are investigating.',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{message:'Rewritten',updatedAt:serverTimestamp()}))
 await assertSucceeds(getDocs(collection(admin,'feedback')))
})
it('rejects oversized data and client timestamps; support remains reachable for paused accounts',async()=>{
 await assertFails(submit('alice',{message:'x'.repeat(3001)}).commit())
 await assertFails(submit('alice',{createdAt:Timestamp.fromMillis(0)}).commit())
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'accountDeletions/alice'),{status:'pending',requestedAt:Timestamp.now()})})
 await assertSucceeds(submit('alice',{kind:'deletion'}).commit())
})
