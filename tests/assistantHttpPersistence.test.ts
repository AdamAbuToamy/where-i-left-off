import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:'http-persistence'}}}));
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db;},auth:runtime.auth,appCheck:null,emulatorMode:true}));
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class{read=async()=>({projects:[],sections:[],operations:[]});}}));
import {AssistantApi} from '../src/assistant/api';import {AssistantRepository,assistantContext} from '../src/assistant/assistantRepository';import {parseAssistantReply,planAssistantProposal} from '../src/assistant/actions';
import {createWorker} from '../push-worker/src/index.mjs';import {verifyIdentity} from '../push-worker/src/firebase.mjs';import {database} from '../push-worker/test-db.mjs';
let env:RulesTestEnvironment;
beforeAll(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-assistant-http',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();runtime.db=env.authenticatedContext(runtime.auth.currentUser.uid,{email_verified:true}).firestore();
 const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v)});vi.stubGlobal('window',{dispatchEvent:()=>true});
});
afterAll(async()=>{await env?.cleanup();vi.unstubAllGlobals();});
it('goes through the API boundary, actual JWT/App Check verification, native tool route, domain planner, Firebase transaction and fresh read',async()=>{
 const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);jwk.kid='http-test';const keys={auth:createLocalJWKSet({keys:[jwk]}),app:createLocalJWKSet({keys:[jwk]})};
 const signed=(claims:Record<string,unknown>)=>new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'http-test'}).setIssuedAt().setExpirationTime('1h').sign(pair.privateKey);
 const uid=runtime.auth.currentUser.uid,identity=await signed({sub:uid,email_verified:true,aud:'demo-assistant-http',iss:'https://securetoken.google.com/demo-assistant-http',auth_time:Math.floor(Date.now()/1000)-1}),attestation=await signed({sub:'1:123:web:http',aud:['projects/123'],iss:'https://firebaseappcheck.googleapis.com/123'});
 let accountFailure=false,modelCalls=0;
 const worker=createWorker({verifyIdentity:(request:Request,settings:unknown)=>verifyIdentity(request,settings,keys),accountAvailable:async()=>{if(accountFailure)throw new Error('auth-lookup-failed');}});
 const settings={DB:database(),ASSISTANT_FREE_ONLY:'true',ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-secret',APP_ORIGINS:'https://app.test',FIREBASE_PROJECT_ID:'demo-assistant-http',FIREBASE_APP_ID:'1:123:web:http'};
 const api=new AssistantApi({uid:()=>runtime.auth.currentUser.uid,identity:async()=>identity,attestation:async()=>attestation,endpoint:async()=> 'https://worker.test/assistant',fetch:async(url,options)=>{
  const headers=new Headers(options?.headers);headers.set('origin','https://app.test');return worker.fetch(new Request(String(url),{...options,headers}),settings);
 }});
 const originalFetch=globalThis.fetch;globalThis.fetch=async(input,options)=>{
  if(String(input)!=='https://api.groq.com/openai/v1/chat/completions')return originalFetch(input,options);
  modelCalls++;const sent=JSON.parse(String(options?.body));expect(sent.tools).toHaveLength(2);
  const proposal={text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'HTTP card',dueDate:'2026-10-25',description:'Exact note'}},{target:'courses',action:'create',id:'new-course',values:{name:'Algorithms'}},{target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:0,start:'11:00',end:'13:00',sessionType:'lecture',room:''}}],controls:[],files:[],tasks:[{title:'Card/date/note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},{title:'Course and class',outcome:'proposed',actionIndexes:[1,2],controlIndexes:[],detail:''}]};
  return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(proposal)}}]}}]});
 };
 try{
  const repository=new AssistantRepository(uid),snapshot=await repository.read(),message='Create HTTP card with date October 25 2026 and note Exact note. Create Algorithms and its Sunday lecture 11:00-13:00.';
  const reply=await api.request<{text:string}>({mode:'workspace',language:'en',message,context:assistantContext(snapshot,message)}),parsed=parseAssistantReply(reply.text),changes=planAssistantProposal(snapshot.data,parsed.actions);
  expect(modelCalls).toBe(1);expect(changes).toHaveLength(3);const receipt=await repository.apply(snapshot,changes);expect(receipt.changes).toHaveLength(3);
  const fresh=await new AssistantRepository(uid).read();expect(fresh.data.scopes[0].projects).toEqual([expect.objectContaining({name:'HTTP card',dueDate:'2026-10-25',description:'Exact note'})]);expect(fresh.data.study.courses).toHaveLength(1);expect(fresh.data.study.lessons[0]).toMatchObject({courseId:fresh.data.study.courses[0].id,day:0,start:'11:00',end:'13:00'});
  accountFailure=true;await expect(api.request({mode:'health'})).rejects.toMatchObject({code:'ai-service-permission',stage:'account'});expect(modelCalls).toBe(1);const unchanged=await repository.read();expect(unchanged.data.scopes[0].projects).toHaveLength(1);
 }finally{globalThis.fetch=originalFetch;}
});
