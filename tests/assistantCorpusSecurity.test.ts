import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,serverTimestamp} from 'firebase/firestore';
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:''}}}));
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db;},auth:runtime.auth}));
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class{read=async()=>({projects:[],sections:[],operations:[]});}}));
import {AssistantRepository} from '../src/assistant/assistantRepository';
import {acceptanceCases,acceptanceContext} from './fixtures/assistant/corpus.mjs';
import {reconcileIntentProposal} from '../push-worker/src/assistantIntents.mjs';
import {liveReplayCases} from '../scripts/lib/liveAssistantReport.mjs';
import {evaluateAcceptance,assertReloaded} from './fixtures/assistant/oracle';
const livePath=process.env.ASSISTANT_LIVE_REPORT;
const liveCases=livePath?liveReplayCases(JSON.parse(readFileSync(livePath,'utf8')),acceptanceCases):null;
const selected=liveCases?liveCases.map((entry:{testCase:typeof acceptanceCases[number]})=>entry.testCase):acceptanceCases;
let env:RulesTestEnvironment;
beforeAll(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-assistant-corpus',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});vi.stubGlobal('window',{dispatchEvent:()=>true});
});
afterAll(async()=>{await env?.cleanup();vi.unstubAllGlobals();});
for(const testCase of selected)it(`${liveCases?"live reply":"authored oracle"}: persist and reload ${testCase.id}`,async()=>{
 const uid='corpus-'+testCase.id,context=acceptanceContext(testCase.id);
 runtime.auth.currentUser={uid};runtime.db=env.authenticatedContext(uid,{email_verified:true}).firestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const writes=[];
  for(const target of ['courses','tasks','lessons'] as const)for(const item of context.study[target])writes.push(setDoc(doc(ctx.firestore(),`users/${uid}/studyRecords/${target}_${item.id}`),{kind:target,id:item.id,payload:JSON.stringify(item),deleted:false,revision:0,mutationId:'seed',updatedAt:serverTimestamp()}));
  for(const target of ['projects','sections'] as const)for(const item of context.scopes[0][target]){const {id,...values}=item;writes.push(setDoc(doc(ctx.firestore(),`users/${uid}/${target}/${id}`),{...values,revision:0,mutationId:'seed',updatedAt:serverTimestamp()}));}
  await Promise.all(writes);
 });
 let reply:string;
 if(liveCases)reply=liveCases.find((entry:{testCase:{id:string}})=>entry.testCase.id===testCase.id)!.reply;
 else{
  const prepared=reconcileIntentProposal({text:'Review',actions:structuredClone(testCase.actions),controls:structuredClone(testCase.controls),tasks:[],files:[]},testCase.intents,context);
  expect(prepared.issues).toEqual([]);reply=JSON.stringify(prepared.proposal);
 }
 const {changes}=evaluateAcceptance(testCase,reply);
 const repository=new AssistantRepository(uid),snapshot=await repository.read();
 if(changes.length){const receipt=await repository.apply(snapshot,changes);expect(receipt.changes).toHaveLength(changes.length);}
 // New repository/read, no optimistic local result: checks actual emulator persistence.
 const fresh=await new AssistantRepository(uid).read();assertReloaded(changes,fresh.data);
 expect(fresh.pending).toBe(false);
});
