import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,it} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
let env:RulesTestEnvironment;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-study-security',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>env.clearFirestore());afterAll(async()=>env?.cleanup());
const data=()=>({id:'course',kind:'courses',payload:JSON.stringify({id:'course',name:'Private'}),deleted:false,revision:0,mutationId:'one',updatedAt:serverTimestamp()});
it('isolates university records by account and rejects unverified or suspended users',async()=>{
 const alice=env.authenticatedContext('alice',{email_verified:true}).firestore(),bob=env.authenticatedContext('bob',{email_verified:true}).firestore(),unverified=env.authenticatedContext('alice',{email_verified:false}).firestore();
 const path='users/alice/studyRecords/courses_course';await assertSucceeds(setDoc(doc(alice,path),data()));await assertFails(getDoc(doc(bob,path)));await assertFails(getDoc(doc(unverified,path)));await assertFails(setDoc(doc(bob,path),data()));
 await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'appMetrics/alice'),{suspended:true}));await assertFails(getDoc(doc(alice,path)));
});
it('requires revision increments, bounded data and canonical document keys',async()=>{
 const db=env.authenticatedContext('alice',{email_verified:true}).firestore(),path='users/alice/studyRecords/courses_course';await assertSucceeds(setDoc(doc(db,path),data()));
 await assertFails(setDoc(doc(db,path),data()));await assertFails(setDoc(doc(db,'users/alice/studyRecords/wrong'),data()));
 await assertFails(setDoc(doc(db,path),{...data(),revision:1,payload:'x'.repeat(600001)}));
 await assertSucceeds(setDoc(doc(db,path),{...data(),revision:1,deleted:true,payload:''}));
});
it('keeps API receipts private even from normal owner/admin clients',async()=>{
 const path='users/alice/apiOperations/source_synthetic';await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),path),{kind:'source',entityId:'task',base:{title:'Private baseline'}}));
 for(const context of [env.unauthenticatedContext(),env.authenticatedContext('alice',{email_verified:true}),env.authenticatedContext('bob',{email_verified:true}),env.authenticatedContext('administrator',{email:'adam2002hosny@gmail.com',email_verified:true})]){
  await assertFails(getDoc(doc(context.firestore(),path)));await assertFails(setDoc(doc(context.firestore(),path),{kind:'receipt'}));
 }
});

it('protects curriculum plans with the same owner, revision and tombstone checks',async()=>{
 const alice=env.authenticatedContext('alice',{email_verified:true}).firestore(),bob=env.authenticatedContext('bob',{email_verified:true}).firestore();
 const path='users/alice/studyRecords/curricula_plan';const record={...data(),kind:'curricula',id:'plan',payload:JSON.stringify({id:'plan',name:'Synthetic',courses:[]})};
 await assertSucceeds(setDoc(doc(alice,path),record));await assertFails(getDoc(doc(bob,path)));await assertFails(setDoc(doc(bob,path),{...record,revision:1}));await assertFails(setDoc(doc(alice,path),record));await assertSucceeds(setDoc(doc(alice,path),{...record,revision:1}));
});
