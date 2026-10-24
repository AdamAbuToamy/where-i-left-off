import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantProvider,CLOUDFLARE_MODEL,GROQ_MODEL,GEMINI_MODEL} from './src/assistantProvider.mjs';
import {assistantProviderError} from './src/assistantErrors.mjs';
import {INTENT_FORMAT} from './src/assistantIntents.mjs';
const input={messages:[{role:'user',content:'Create a card'}],temperature:0,max_tokens:2048,response_format:INTENT_FORMAT};
async function withFetch(fake,work){const previous=globalThis.fetch;globalThis.fetch=fake;try{await work();}finally{globalThis.fetch=previous;}}
test('Cloudflare remains the default; explicit Groq needs only its server secret',async()=>{
 const provider=assistantProvider({AI:{run:async(model,body)=>({model,body})}});assert.equal(provider.model,CLOUDFLARE_MODEL);assert.equal((await provider.run(input)).body,input);
 assert.equal(assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-key'}).model,GROQ_MODEL);
 for(const env of [{},{ASSISTANT_PROVIDER:'groq',AI:{}},{ASSISTANT_PROVIDER:'unknown',GROQ_API_KEY:'test-only-key'}])assert.throws(()=>assistantProvider(env),/ai-not-configured/);
});
test('Groq uses JSON mode with local schema checks, low reasoning, a fixed endpoint and an authorization header',async()=>withFetch(async(url,options)=>{
 assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.redirect,'manual');assert.equal(options.headers.authorization,'Bearer test-only-key');
 const body=JSON.parse(options.body);assert.equal(body.model,GROQ_MODEL);assert.equal(body.reasoning_effort,'low');assert.equal(body.max_completion_tokens,2048);assert.equal(body.max_tokens,undefined);
 assert.deepEqual(body.response_format,{type:'json_object'});
 assert.ok(options.signal instanceof AbortSignal);return Response.json({choices:[{finish_reason:'stop',message:{content:'{"intents":[]}'}}]});
},async()=>assert.deepEqual(await assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-key'}).run(input),{response:'{"intents":[]}'})));
for(const [status,code] of [[429,'ai-provider-limit'],[401,'ai-provider-access'],[403,'ai-provider-access'],[500,'ai-unavailable-or-quota'],[413,'ai-provider-context']])test(`Groq ${status} is safe and never silently switches providers`,async()=>withFetch(async()=>new Response('secret upstream payload',{status}),async()=>{
 await assert.rejects(assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-key',AI:{run(){throw new Error('fallback must not run');}}}).run(input),error=>{assert.equal(assistantProviderError(error),code);assert.equal(error.message,status===413?'ai-provider-context':'provider-request-failed');return true;});
}));
for(const [choice,code] of [[{finish_reason:'length',message:{content:'partial'}},'ai-response-too-large'],[{message:{content:''}},'ai-empty-response']])test(`reject unusable Groq completion: ${code}`,async()=>withFetch(async()=>Response.json({choices:[choice]}),async()=>{
 await assert.rejects(assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-only-key'}).run(input),error=>assistantProviderError(error)===code);
}));

test('Gemini selects Google directly with the existing native batched tool contract',async()=>withFetch(async(url,options)=>{
 assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');assert.equal(options.headers.authorization,'Bearer test-google-key');
 const sent=JSON.parse(options.body);assert.equal(sent.model,GEMINI_MODEL);assert.equal(sent.max_tokens,2048);assert.equal(sent.max_completion_tokens,undefined);assert.equal(sent.parallel_tool_calls,undefined);assert.equal(sent.reasoning_effort,undefined);assert.equal(sent.tools.length,2);
 return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify({text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'Test',dueDate:'2026-10-25',description:'Exact note'}}],controls:[],files:[],tasks:[{title:'Card, date and note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]})}}]}}]});
},async()=>{
 const {workspaceToolInput}=await import('./src/assistantTools.mjs');const p=assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:'test-google-key'});assert.equal(p.name,'gemini');
 const result=await p.run(workspaceToolInput({language:'en',message:'Create Test card with date and note',context:'{}'},[]));assert.deepEqual(JSON.parse(result.response).actions[0].values,{name:'Test',dueDate:'2026-10-25',description:'Exact note'});
}));
test('Gemini never falls back to Groq or Cloudflare, and requires its own server secret',async()=>{
 assert.throws(()=>assistantProvider({ASSISTANT_PROVIDER:'gemini',GROQ_API_KEY:'other-key',AI:{}}),/ai-not-configured/);
 await withFetch(async()=>Response.json({error:{code:429}},{status:429}),async()=>{
  await assert.rejects(assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:'test-key',GROQ_API_KEY:'other-key',AI:{}}).run(input),e=>assistantProviderError(e)==='ai-provider-limit');
 });
});
