import {test} from 'node:test';import assert from 'node:assert/strict';
import {syntheticProviderDiagnostic} from '../scripts/lib/providerDiagnostic.mjs';
import {assistantProvider} from './src/assistantProvider.mjs';
test('synthetic diagnostics redact keys, URLs, email, bearer tokens and project numbers before truncation',()=>{
 const key='synthetic-private-key-987654321';
 const d=syntheticProviderDiagnostic({status:400,body:`Invalid argument: ${key} ${encodeURIComponent(key)} Bearer abc-privatetoken https://google.test/?key=hidden user@example.test project 166135877928`},key);
 for(const secret of [key,'abc-privatetoken','https://google.test','user@example.test','166135877928'])assert.equal(d.body.includes(secret),false);
 assert.ok(d.body.includes('Invalid argument'));assert.equal(d.syntheticDataOnly,true);
});
test('upstream text diagnostics require an explicit synthetic runner callback and support list-shaped Google errors',async()=>{
 const previous=globalThis.fetch;let captured=0;
 globalThis.fetch=async()=>Response.json([{error:{status:'INVALID_ARGUMENT',message:'Invalid tool argument'}}],{status:400});
 try{
  for(const enabled of [false,true]){
   const p=assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:'test-only-key'},enabled?{onSyntheticDiagnostic:d=>{captured++;assert.equal(d.status,400);}}:{});
   await assert.rejects(p.run({messages:[],max_tokens:20}),e=>e.providerCode==='invalid_argument');
  }
  assert.equal(captured,1);
 }finally{globalThis.fetch=previous;}
});
test('malformed synthetic tool proposals retain bounded diagnostic arguments without changing ordinary failure handling',async()=>{
 const previous=globalThis.fetch;let captured;
 globalThis.fetch=async()=>Response.json({choices:[{message:{tool_calls:[{type:'function',function:{name:'unexpected',arguments:'{"actions":[]}'}}]}}]});
 try{
  const p=assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:'test-only-key'},{onSyntheticDiagnostic:d=>{captured=d;}});
  await assert.rejects(p.run({messages:[],max_tokens:30,tools:[],tool_choice:'required'}),/ai-incomplete-proposal/);
  assert.equal(captured.status,200);assert.equal(JSON.parse(captured.body).callCount,1);assert.equal(JSON.parse(captured.body).calls[0].name,'unexpected');
 }finally{globalThis.fetch=previous;}
});
