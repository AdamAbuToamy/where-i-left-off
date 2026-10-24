import {INTENT_FORMAT} from '../../../push-worker/src/assistantIntents.mjs';
import {assistantProviderError,safeProviderFailure} from '../../../push-worker/src/assistantErrors.mjs';
import {assistant,assistantResponseText} from '../../../push-worker/src/assistant.mjs';
import {acceptanceContext} from './corpus.mjs';
/** Shared synthetic inference path. No production DB, identity, queues or user data. */
export async function runAcceptanceCase(testCase,provider){
 const trace=[],start=Date.now();
 const runtime={ASSISTANT_FREE_ONLY:'true',DB:{prepare:()=>({bind(){return this;},async run(){return {};},async all(){return {results:[{used:1}]};}})}};
 const traced={name:provider.name,model:provider.model,workspaceTools:provider.workspaceTools,async run(input,options){
  const inventory=input.response_format===INTENT_FORMAT,prior=trace.filter(t=>inventory?t.stage.startsWith('inventory'):!t.stage.startsWith('inventory')).length;
  const stage=input.tools?'tool-plan':inventory?(prior?'inventory-repair':'inventory'):(prior?'repair':'proposal'),began=Date.now();
  let result;try{result=await provider.run(input,options);}catch(error){trace.push({stage,model:provider.model,ms:Date.now()-began,error:assistantProviderError(error),providerFailure:safeProviderFailure(error)});throw error;}
  trace.push({stage,model:provider.model,ms:Date.now()-began,text:assistantResponseText(result)});return result;
 }};
 try{
  const result=await assistant(runtime,'synthetic-user',{mode:'workspace',language:testCase.language,message:testCase.message,history:[],context:JSON.stringify(acceptanceContext(testCase.id))},traced);
  return {text:result.text,elapsedMs:Date.now()-start,trace};
 }catch(error){return {error:/^ai-[a-z-]+$/.test(error.message)?error.message:'harness-failed',details:error.details||[],elapsedMs:Date.now()-start,trace};}
}
