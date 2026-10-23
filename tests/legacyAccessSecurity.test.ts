import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,it} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDocs,collection,serverTimestamp,Timestamp} from 'firebase/firestore';
let env:RulesTestEnvironment;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-legacy-access',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>env.clearFirestore());afterAll(async()=>env?.cleanup());
it('permits existing accounts whose old metric has no suspended field, while keeping ownership checks',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(1),lastSeen:Timestamp.fromMillis(2)}));
 const alice=env.authenticatedContext('alice',{email:'alice@example.test',email_verified:true}).firestore(),bob=env.authenticatedContext('bob',{email:'bob@example.test',email_verified:true}).firestore();
 await assertSucceeds(getDocs(collection(alice,'users/alice/projects')));
 await assertSucceeds(getDocs(collection(alice,'users/alice/groupMemberships')));
 await assertSucceeds(getDocs(collection(alice,'users/alice/studyRecords')));
 await assertFails(getDocs(collection(bob,'users/alice/studyRecords')));
});
it('can normalize a legacy metric but cannot unsuspend or rewrite firstSeen',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(1),lastSeen:Timestamp.fromMillis(2)}));
 const alice=env.authenticatedContext('alice',{email:'alice@example.test',email_verified:true}).firestore();
 await assertSucceeds(setDoc(doc(alice,'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(1),lastSeen:serverTimestamp(),suspended:false}));
 await assertFails(setDoc(doc(alice,'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(2),lastSeen:serverTimestamp(),suspended:false}));
 await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(1),lastSeen:Timestamp.fromMillis(2),suspended:true}));
 await assertFails(getDocs(collection(alice,'users/alice/projects')));
 await assertFails(setDoc(doc(alice,'appMetrics/alice'),{email:'alice@example.test',firstSeen:Timestamp.fromMillis(1),lastSeen:serverTimestamp(),suspended:false}));
});
