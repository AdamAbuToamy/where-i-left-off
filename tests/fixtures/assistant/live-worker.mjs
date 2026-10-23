import {INTENT_FORMAT} from '../../../push-worker/src/assistantIntents.mjs';
import {assistantProviderError} from '../../../push-worker/src/assistantErrors.mjs';
import {assistant,assistantResponseText} from '../../../push-worker/src/assistant.mjs';
import {acceptanceCases,acceptanceContext} from './corpus.mjs';
/** Local-only synthetic harness. No production DB, accounts, queues or user content. */
export default {async fetch(request,env){
 if(request.headers.has('origin')||request.headers.get('authorization')!==`Bearer ${env.TEST_TOKEN}`)return new Response('',{status:403});
 if(request.method!=='POST')return new Response('',{status:405});
 const {id}=await request.json(),testCase=acceptanceCases.find(c=>c.id===id);
 if(!testCase)return Response.json({error:'unknown-case'},{status:400});
 const trace=[],start=Date.now();
 const runtime={ASSISTANT_FREE_ONLY:'true',DB:{prepare:()=>({bind(){return this;},async run(){return {};},async all(){return {results:[{used:1}]};}})},AI:{async run(model,input){
  const inventory=input.response_format===INTENT_FORMAT,prior=trace.filter(t=>inventory?t.stage.startsWith('inventory'):!t.stage.startsWith('inventory')).length,stage=inventory?(prior?'inventory-repair':'inventory'):(prior?'repair':'proposal');
  const began=Date.now();let result;try{result=await env.AI.run(model,input);}catch(error){trace.push({stage,model,ms:Date.now()-began,error:assistantProviderError(error)});throw error;}
  trace.push({stage,model,ms:Date.now()-began,text:assistantResponseText(result)});return result;
 }}};
 try{
  const result=await assistant(runtime,'synthetic-user',{mode:'workspace',language:testCase.language,message:testCase.message,history:[],context:JSON.stringify(acceptanceContext(testCase.id))});
  return Response.json({text:result.text,elapsedMs:Date.now()-start,trace});
 }catch(error){return Response.json({error:/^ai-[a-z-]+$/.test(error.message)?error.message:'harness-failed',details:error.details||[],elapsedMs:Date.now()-start,trace});}
}};
