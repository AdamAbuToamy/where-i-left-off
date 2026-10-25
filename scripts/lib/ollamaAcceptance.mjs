import {workspaceToolStep} from '../../push-worker/src/assistantTools.mjs';

/** Loopback-only, real local inference for the acceptance harness. No API key, no cloud fallback. */
export class OllamaAcceptanceProvider {
 constructor({model='qwen3:8b',origin='http://127.0.0.1:11434',fetcher=fetch}={}){
  const url=new URL(origin);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','::1'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.port&&url.port!=='11434'||url.pathname!=='/')throw new Error('ollama-loopback-only');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:\/-]{0,100}$/.test(model)||model.includes('cloud'))throw new Error('ollama-local-model-required');
  this.name='ollama';this.model=model;this.workspaceTools=true;this.origin=url.origin;this.fetcher=fetcher;
 }
 async ready(){
  let response;
  try{response=await this.fetcher(this.origin+'/api/tags',{signal:AbortSignal.timeout(5000)});}
  catch{throw new Error('ollama-not-running: start Ollama on Ubuntu (ollama serve)');}
  if(!response.ok)throw new Error('ollama-api-http-'+response.status);
  const data=await response.json();
  const names=(data.models||[]).map(item=>item.name||item.model);
  if(!names.includes(this.model)&&!names.includes(this.model+':latest'))throw new Error('ollama-model-missing: ollama pull '+this.model);
  return {model:this.model,endpoint:this.origin};
 }
 async run(input,{signal}={}){
  const body={
   model:this.model,messages:input.messages,stream:false,
   temperature:input.temperature??0,
   max_tokens:Math.min(input.max_tokens||4096,8192),
  };
  if(input.tools)body.tools=input.tools;
  if(input.response_format)body.response_format=input.response_format.type==='json_schema'?{type:'json_object'}:input.response_format;
  const signals=[AbortSignal.timeout(300000),signal].filter(Boolean);
  let response;
  try{
   response=await this.fetcher(this.origin+'/v1/chat/completions',{
    method:'POST',headers:{'content-type':'application/json'},redirect:'manual',
    body:JSON.stringify(body),signal:AbortSignal.any(signals),
   });
  }catch(error){
   throw new Error(error?.name==='TimeoutError'||error?.name==='AbortError'?'ollama-timeout':'ollama-connection-error',{cause:error});
  }
  if(!response.ok){
   // Do not emit raw provider responses: they may contain user context.
   throw new Error('ollama-http-'+response.status);
  }
  const data=await response.json();
  const choice=data?.choices?.[0];
  if(!choice)throw new Error('ollama-empty-response');
  if(choice.finish_reason==='length')throw new Error('ai-response-too-large');
  if(input.tools){
   const normalized=structuredClone(choice);
   if(Array.isArray(normalized.message?.tool_calls)){
    normalized.message.tool_calls=normalized.message.tool_calls.map((call,index)=>({
     ...call,
     id:call.id||'ollama-call-'+(index+1),
     type:'function',
     function:{
      ...call.function,
      arguments:typeof call.function?.arguments==='string'?call.function.arguments:JSON.stringify(call.function?.arguments??{}),
     },
    }));
   }
   return workspaceToolStep(normalized);
  }
  if(typeof choice.message?.content!=='string'||!choice.message.content.trim())throw new Error('ollama-empty-response');
  return {response:choice.message.content};
 }
}
