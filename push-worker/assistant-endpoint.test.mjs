import {test} from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createWorker} from './src/index.mjs';import {verifyIdentity} from './src/firebase.mjs';import {database} from './test-db.mjs';import {ASSISTANT_PROTOCOL} from './src/assistantEndpoint.mjs';
const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);jwk.kid='endpoint-test';const keys={auth:createLocalJWKSet({keys:[jwk]}),app:createLocalJWKSet({keys:[jwk]})};
async function signed(claims){return new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'endpoint-test'}).setIssuedAt().setExpirationTime('1h').sign(pair.privateKey);}
async function fixture({accountError,missingTables=false,verified=true,appAudience='projects/123',identityAudience='demo-project'}={}){
 const env={FIREBASE_PROJECT_ID:'demo-project',FIREBASE_APP_ID:'1:123:web:app',APP_ORIGINS:'https://app.test',ASSISTANT_FREE_ONLY:'true',ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-key',DB:database()};
 if(missingTables)env.DB.sqlite.exec('DROP TABLE ai_usage');
 const worker=createWorker({verifyIdentity:(r,e)=>verifyIdentity(r,e,keys),accountAvailable:async()=>{if(accountError)throw Object.assign(new Error(accountError),{status:403});}});
 const token=await signed({sub:'alice',iss:'https://securetoken.google.com/demo-project',aud:identityAudience,auth_time:Math.floor(Date.now()/1000)-1,email_verified:verified});
 const app=await signed({sub:env.FIREBASE_APP_ID,iss:'https://firebaseappcheck.googleapis.com/123',aud:[appAudience]});
 return {env,worker,token,app,request:data=>new Request('https://worker.test/assistant',{method:'POST',headers:{origin:'https://app.test',authorization:`Bearer ${token}`,'x-firebase-appcheck':app,'content-type':'application/json'},body:JSON.stringify(data)})};
}
test('actual HTTP route verifies signed Firebase/App Check tokens and returns a native tool plan',async()=>{
 const f=await fixture(),old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const body=JSON.parse(options.body);assert.ok(body.tools);calls++;
 const plan={text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'محمد',dueDate:'2026-10-25',description:'ادم ادم ادم'}}],controls:[],files:[],tasks:[{title:'Create card with date and note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
 return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(plan)}}]}}]});};
 try{const response=await f.worker.fetch(f.request({mode:'workspace',language:'ar',message:'اضف بطاقة باسم محمد وضعها بالاسبوع 25 الشهر واضف ملاحظة ادم ادم ادم',context:'{"localDate":"2026-10-24","timezone":"Asia/Jerusalem"}'}),f.env),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'https://app.test');assert.equal(response.headers.get('x-wilo-assistant-version'),ASSISTANT_PROTOCOL);assert.match(response.headers.get('x-wilo-request-id'),/^[a-f0-9-]{36}$/);assert.equal(calls,1);assert.equal(JSON.parse(body.result.text).actions[0].values.description,'ادم ادم ادم');
 assert.equal(JSON.stringify(body).includes(f.token),false);assert.equal(JSON.stringify(body).includes(f.app),false);
 }finally{globalThis.fetch=old;}
});
for(const [options,code,status,stage] of [
 [{appAudience:'projects/999'},'ai-app-check-failed',401,'app-check'],[{identityAudience:'other-project'},'ai-auth-required',401,'identity'],[{verified:false},'ai-email-unverified',403,'account'],
 [{accountError:'auth-lookup-failed'},'ai-service-permission',503,'account'],[{accountError:'reader-auth-failed'},'ai-service-identity',503,'account'],[{accountError:'database-unavailable'},'ai-service-database',503,'account'],[{missingTables:true},'ai-storage-not-ready',503,'database'],
])test(`actual endpoint keeps ${code} separate from inference failure`,async()=>{
 const f=await fixture(options),response=await f.worker.fetch(f.request({mode:'health'}),f.env),body=await response.json();assert.equal(response.status,status);assert.equal(body.error,code);assert.equal(body.diagnostic.stage,stage);assert.equal(body.diagnostic.protocol,ASSISTANT_PROTOCOL);assert.equal(JSON.stringify(body).includes(f.token),false);
});
test('authenticated health checks storage/provider setup without a model call or budget increment',async()=>{
 const f=await fixture(),old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('health must not call model');};
 try{const response=await f.worker.fetch(f.request({mode:'health'}),f.env),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.result,{status:'ready',protocol:ASSISTANT_PROTOCOL,provider:'groq',model:'openai/gpt-oss-120b',inferenceTested:false});assert.equal(f.env.DB.sqlite.prepare('SELECT count(*) AS n FROM ai_budget').get().n,0);}finally{globalThis.fetch=old;}
});
test('deployment preflight exposes protocol and CORS, never credentials or user data',async()=>{
 const {worker,env}=await fixture();const response=await worker.fetch(new Request('https://worker.test/assistant',{method:'OPTIONS',headers:{origin:'https://app.test'}}),env);assert.equal(response.status,204);assert.equal(response.headers.get('x-wilo-assistant-version'),ASSISTANT_PROTOCOL);assert.equal(await response.text(),'');
});
