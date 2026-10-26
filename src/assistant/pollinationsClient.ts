import {AssistantFailure} from './failure';
import {pollinationsKey} from './pollinationsAuth';
import config from './pollinationsConfig.json';
import {conversationInput,readConversationChoice} from '../../push-worker/src/assistantConversation.mjs';
import {runNativeWorkspace} from '../../push-worker/src/assistantNativeTools.mjs';
import type {WorkspaceToolInput} from '../../push-worker/src/assistantTools.mjs';
import {inferenceBudget,readInferenceResponse} from './inferenceStream';
import type {InferenceProgress} from './inferenceStream';

export type InferenceTiming={stage:'conversation'|'workspace';attempt:number;inputChars:number;tools:number;headersMs?:number;firstDeltaMs?:number;totalMs:number;httpStatus?:number;outcome:'ok'|'failed'|'retry'};
type WorkspaceRequest={message:string;language:string;context:string;history:{role:'user'|'assistant';content:string}[];repair?:{reason:string;proposal:string};functions?:string[];outputFormat?:string;requirements?:{target:string;fields:string[]}[]};
export class PollinationsAssistant{
 private uid:string;private history:InferenceTiming[]=[];
 constructor(uid:string){this.uid=uid;}
 timings(){return this.history.map(timing=>({...timing}));}
 private async complete(input:WorkspaceToolInput,parent?:AbortSignal,onProgress?:(progress:InferenceProgress)=>void):Promise<unknown>{
  const inputChars=JSON.stringify(input).length;
  if(inputChars>120000)throw new AssistantFailure('assistant-too-large','request');
  const budget=inferenceBudget(parent);
  try{
   for(let attempt=0;attempt<2;attempt++){
    const started=performance.now(),timing:InferenceTiming={stage:'result_protocol' in input&&input.result_protocol==='conversation'?'conversation':'workspace',attempt:attempt+1,inputChars,tools:input.tools?.length||0,totalMs:0,outcome:'failed'};
    this.history.push(timing);this.history=this.history.slice(-20);
    let received=false;
    try{
     budget.signal.throwIfAborted();budget.activity();onProgress?.('waiting');
     const response=await fetch('https://gen.pollinations.ai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+pollinationsKey(this.uid),'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:input.messages,tools:input.tools,tool_choice:'auto',parallel_tool_calls:true,reasoning_effort:'none',stream:true,stream_options:{include_usage:true},max_tokens:input.max_tokens||2048,temperature:0}),signal:budget.signal});
     timing.headersMs=Math.round(performance.now()-started);timing.httpStatus=response.status;
     if(!response.ok){
      if(!attempt&&[408,422,500,502,503,504].includes(response.status)){timing.outcome='retry';await new Promise(resolve=>setTimeout(resolve,250));continue;}
      throw new AssistantFailure(response.status===401?'ai-provider-access':response.status===429||response.status===402?'ai-provider-limit':'assistant-network','provider',{status:response.status,protocol:'wilo-assistant-pollinations-v3'});
     }
     const body=await readInferenceResponse(response,budget.signal,()=>{
      budget.activity();
      if(!received){received=true;timing.firstDeltaMs=Math.round(performance.now()-started);onProgress?.('receiving');}
     });
     budget.signal.throwIfAborted();
     const content=body.choices?.[0]?.message?.content;
     // A zero-token billing notice may arrive as HTTP 200; it is not a model answer.
     if(body.usage?.total_tokens===0&&typeof body.id==='string'&&body.id.startsWith('resp_')&&typeof content==='string'&&[...content.matchAll(/https:\/\/enter\.pollinations\.ai\/edit-key\?[^)\s]+/g)].some(match=>new URL(match[0]).searchParams.get('ref')==='agent_key_budget'))throw new AssistantFailure('ai-provider-limit','provider',{status:402});
     if(body.error)throw new AssistantFailure('assistant-network','provider',{status:response.status});
     timing.outcome='ok';return body.choices?.[0];
    }catch(error){
     if(budget.signal.aborted){
      if(!parent?.aborted||parent.reason?.name==='TimeoutError')throw new AssistantFailure('assistant-timeout','provider');
      throw error;
     }
     // A dropped connection before any output gets one retry. Never restart an active stream.
     if(!attempt&&!received&&error instanceof TypeError){timing.outcome='retry';continue;}
     throw error;
    }finally{timing.totalMs=Math.round(performance.now()-started);}
   }
   throw new AssistantFailure('assistant-network','provider');
  }finally{budget.dispose();}
 }
 async conversation(data:{message:string;language:string;displayName?:string;history:{role:'user'|'assistant';content:string}[]},signal?:AbortSignal,onProgress?:(progress:InferenceProgress)=>void){
  const input=conversationInput(data,data.history);
  try{return readConversationChoice(await this.complete(input,signal,onProgress),data.language).conversation;}
  catch(error){
   if((error as Error).message!=='ai-incomplete-proposal')throw error;
   return readConversationChoice(await this.complete({...input,messages:[...input.messages,{role:'user',content:'No operation has been executed. Do not imitate app history metadata or output a JSON operation plan. For a site action call request_workspace using its declared arguments; otherwise answer normally as text.'}]},signal,onProgress),data.language).conversation;
  }
 }
 async workspace(request:WorkspaceRequest,signal?:AbortSignal,onProgress?:(progress:InferenceProgress)=>void){
  const text=await runNativeWorkspace(request,request.history,(input,stepSignal)=>this.complete(input,stepSignal,onProgress),60000,signal);return {text};
 }
}
