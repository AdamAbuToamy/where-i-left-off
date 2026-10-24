import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
/** Real workerd, injected upstream HTTP. No model inference or production credentials. */
test('Cloudflare runtime reaches each provider with native tools and refuses redirects without forwarding credentials',async()=>{
 const source=`import {assistantProvider} from './src/assistantProvider.mjs';import {workspaceToolInput} from './src/assistantTools.mjs';
 export default {async fetch(request){try{const name=new URL(request.url).searchParams.get('provider');const provider=assistantProvider({ASSISTANT_PROVIDER:name,GROQ_API_KEY:'runtime-test-only',GEMINI_API_KEY:'runtime-test-only'});return Response.json(await provider.run(workspaceToolInput({language:'ar',message:'أضف بطاقة وتاريخها وملاحظتها',context:'{}'},[])));}catch(error){return Response.json({error:error.message,status:error.status||0},{status:502});}}};`;
 const {outputFiles}=await build({stdin:{contents:source,resolveDir:new URL('.',import.meta.url).pathname},bundle:true,write:false,format:'esm',platform:'browser'});
 let redirect=false;const destinations=[];
 const proposal={text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'محمد',dueDate:'2026-10-25',description:'ادم ادم ادم'}}],controls:[],files:[],tasks:[{title:'Card/date/note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-10-20',outboundService:async request=>{
  destinations.push(new URL(request.url).hostname);assert.equal(request.headers.get('authorization'),'Bearer runtime-test-only');
  if(redirect)return new Response(null,{status:302,headers:{location:'https://must-never-receive-key.example/'}});
  const body=await request.json();assert.equal(body.tools.length,1);assert.ok(body.messages.at(-1).content.includes('أضف بطاقة وتاريخها وملاحظتها'));
  return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(proposal)}}]}}]});
 }}));
 try{
  for(const provider of ['groq','gemini']){const response=await runtime.dispatchFetch('https://runtime.test/?provider='+provider);assert.equal(response.status,200,await response.clone().text());assert.deepEqual(JSON.parse((await response.json()).response).actions,proposal.actions);}
  redirect=true;const response=await runtime.dispatchFetch('https://runtime.test/?provider=groq');assert.equal(response.status,502);assert.equal((await response.json()).status,302);
  assert.deepEqual(destinations,['api.groq.com','generativelanguage.googleapis.com','api.groq.com']);
 }finally{await runtime.dispose();}
});
