import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createWorker} from './src/index.mjs';
import {verifyIdentity} from './src/firebase.mjs';
import {database} from './test-db.mjs';
import {readWorkspaceToolProposal} from './src/assistantTools.mjs';
import {clarifyMinimalCreation} from './src/assistantClarification.mjs';

// Fully synthetic identity, app-check, D1, and provider. No production origin,
// production credentials, network traffic, Firestore writes, or AI inference.
const keyPair=await generateKeyPair('RS256');
const jwk=await exportJWK(keyPair.publicKey);jwk.kid='wilo-load-test';
const keys={auth:createLocalJWKSet({keys:[jwk]}),app:createLocalJWKSet({keys:[jwk]})};
async function signed(claims){return new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'wilo-load-test'}).setIssuedAt().setExpirationTime('1h').sign(keyPair.privateKey);}
async function fixture(){
 const uid='stress-user',env={FIREBASE_PROJECT_ID:'demo-wilo-stress',FIREBASE_APP_ID:'1:123:web:stress',APP_ORIGINS:'https://synthetic.wilo.test',ASSISTANT_FREE_ONLY:'true',ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'synthetic-never-network',DB:database()};
 const worker=createWorker({verifyIdentity:(request,settings)=>verifyIdentity(request,settings,keys),accountAvailable:async()=>{}});
 const id=await signed({sub:uid,iss:'https://securetoken.google.com/demo-wilo-stress',aud:'demo-wilo-stress',auth_time:Math.floor(Date.now()/1000)-1,email_verified:true});
 const check=await signed({sub:env.FIREBASE_APP_ID,iss:'https://firebaseappcheck.googleapis.com/123',aud:['projects/123']});
 const request=body=>new Request('https://isolated-worker.test/assistant',{method:'POST',headers:{origin:env.APP_ORIGINS,authorization:'Bearer '+id,'x-firebase-appcheck':check,'content-type':'application/json'},body:JSON.stringify(body)});
 return {uid,env,worker,request};
}
const proposal={text:'راجع التغييرات',actions:[{target:'projects',action:'create',id:'test-card',scope:'personal',values:{name:'Stress card',sectionId:'',dueDate:'2026-10-25',description:'Synthetic note',projectUrl:''}}],controls:[],files:[],tasks:[{title:'Add the card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
const payload={mode:'workspace',language:'ar',message:'أضف بطاقة باسم Stress card بتاريخ 25 الشهر مع ملاحظة Synthetic note وبدون قسم أو رابط',context:JSON.stringify({localDate:'2026-10-24',timezone:'Asia/Jerusalem',study:{courses:[],tasks:[],lessons:[]},scopes:[{id:'personal',name:'Personal',projects:[],sections:[]}]})};
test('120 parallel authenticated health checks do not reach Gemini or increment AI budget',async()=>{
 const f=await fixture(),old=globalThis.fetch;let upstream=0;
 globalThis.fetch=async()=>{upstream++;throw Error('Synthetic health must not call provider');};
 try{
  const responses=await Promise.all(Array.from({length:120},()=>f.worker.fetch(f.request({mode:'health'}),f.env)));
  const bodies=await Promise.all(responses.map(x=>x.json()));
  assert.ok(responses.every(x=>x.status===200),JSON.stringify(responses.map((x,i)=>[x.status,bodies[i]?.error]).filter(x=>x[0]!==200)));
  assert.ok(bodies.every(x=>x.result.status==='ready'&&x.result.inferenceTested===false));
  assert.equal(new Set(responses.map(x=>x.headers.get('x-wilo-request-id'))).size,120);
  assert.equal(f.env.DB.sqlite.prepare('SELECT count(*) AS n FROM ai_budget').get().n,0);
  assert.equal(upstream,0);
 }finally{globalThis.fetch=old;}
});
test('40 concurrent prompts from one account are bounded by rate limiter before inference',async()=>{
 const f=await fixture(),old=globalThis.fetch;let upstream=0;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  upstream++;assert.equal(options?.redirect,'manual');
  return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'stress-proposal',type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(proposal)}}]}}]});
 };
 try{
  const responses=await Promise.all(Array.from({length:40},()=>f.worker.fetch(f.request(payload),f.env)));
  const bodies=await Promise.all(responses.map(x=>x.json()));
  const successes=responses.filter(x=>x.status===200).length;
  const limited=responses.filter(x=>x.status===429).length;
  assert.equal(successes,1,JSON.stringify(responses.map((x,i)=>[x.status,bodies[i]?.error]).filter(x=>x[0]!==429)));
  assert.equal(limited,39);
  assert.ok(bodies.filter(x=>x.error).every(x=>x.error==='ai-rate-limit'));
  assert.equal(upstream,1);
  assert.equal(f.env.DB.sqlite.prepare('SELECT sum(used) AS n FROM ai_usage').get().n,1);
  assert.equal(f.env.DB.sqlite.prepare('SELECT sum(used) AS n FROM ai_budget').get().n,1);
 }finally{globalThis.fetch=old;}
});
test('1000 randomized multilingual tool plans accept valid fields and reject unknown or conflicting ones',()=>{
 const names=['بطاقة للاختبار','בדיקת מערכת','Stress card','برمجة 🦾','تحضير امتحان'];
 for(let i=0;i<1000;i++){
  const p=structuredClone(proposal);
  p.actions[0].id='new-'+i;
  p.actions[0].values.name=names[i%names.length]+' '+i;
  const parsed=JSON.parse(readWorkspaceToolProposal(JSON.stringify(p)));
  assert.deepEqual(parsed.actions[0].values,p.actions[0].values);
  if(i%4===0){
   const bad=structuredClone(p);bad.actions[0].values.javascript='do-not-run';
   assert.throws(()=>readWorkspaceToolProposal(JSON.stringify(bad)),/ai-incomplete-proposal/);
  }
  if(i%5===0){
   const conflict=structuredClone(p);conflict.actions[0].values.title='different name';
   assert.throws(()=>readWorkspaceToolProposal(JSON.stringify(conflict)),/ai-incomplete-proposal/);
  }
 }
});
test('empty and explicitly skipped card details never cause an automatic write',()=>{
 for(const language of ['ar','en','he']){
  const bare=structuredClone(proposal);bare.actions[0].values={};
  const ask=clarifyMinimalCreation(bare,language,'{}',[],language==='ar'?'أضف بطاقة':'Add a card');
  assert.equal(ask.actions.length,0);
  assert.equal(ask.tasks[0].outcome,'needs-input');
  const named=structuredClone(proposal);named.actions[0].values={name:'Study card',sectionId:'',dueDate:'',description:'',projectUrl:''};
  const skipMessage={ar:'بدون إضافات',en:'no extras',he:'בלי תוספות'}[language];
  const ready=clarifyMinimalCreation(named,language,'{}',[],skipMessage);
  assert.equal(ready.actions.length,1);
 }
});
