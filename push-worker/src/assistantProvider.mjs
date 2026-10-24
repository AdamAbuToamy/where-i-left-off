import {workspaceToolArguments} from './assistantTools.mjs';
import {groqRateLimit,minuteRetry} from './groqLimits.mjs';
export const CLOUDFLARE_MODEL='@cf/openai/gpt-oss-120b';
export const GROQ_MODEL='openai/gpt-oss-120b';

class CloudflareInference {
 constructor(binding){this.binding=binding;this.model=CLOUDFLARE_MODEL;this.name='cloudflare';}
 run(input){return this.binding.run(this.model,input);}
}
/** Credentials stay in the Worker; endpoints and model cannot come from user input. */
class GroqInference {
 constructor(key,signal){this.signal=signal;this.key=key;this.model=GROQ_MODEL;this.name='groq';this.workspaceTools=true;}
 async run(input,{compactOutput=false}={}){
  const body={model:this.model,messages:input.messages,temperature:input.temperature,max_completion_tokens:compactOutput?Math.min(input.max_tokens,3072):input.max_tokens,reasoning_effort:'low'};
  if(input.tools){body.tools=input.tools;body.tool_choice=input.tool_choice;body.parallel_tool_calls=false;}
  if(input.response_format)body.response_format=input.response_format.type==='json_schema'
   ?{type:'json_object'}
   :input.response_format;
  const signal=this.signal?AbortSignal.any([this.signal,AbortSignal.timeout(40000)]):AbortSignal.timeout(40000);
  for(let attempt=0;attempt<2;attempt++){
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
   method:'POST',redirect:'error',headers:{authorization:`Bearer ${this.key}`,'content-type':'application/json'},
   body:JSON.stringify(body),signal,
  });
  // Never include upstream payloads, headers or secrets in errors/logs.
  if(!response.ok){
   let failure;try{failure=(await response.json())?.error;}catch{/* Non-JSON errors still retain their HTTP status. */}
   const rate=response.status===429?groqRateLimit(failure?.message,response.headers.get('retry-after')):undefined;
   if(attempt===0&&rate&&minuteRetry(rate)){await waitForRetry(rate.retryAfterSeconds,signal);continue;}
   const error=new Error(response.status===413||rate?.oversized?'ai-provider-context':'provider-request-failed');error.providerRate=rate;
   error.status=response.status;error.providerCode=failure?.code;error.providerParameter=failure?.param;throw error;
  }
  const result=await response.json(),choice=result?.choices?.[0];
  if(choice?.finish_reason==='length')throw new Error('ai-response-too-large');
  if(input.tools)return {response:workspaceToolArguments(choice)};
  if(typeof choice?.message?.content!=='string'||!choice.message.content.trim())throw new Error('ai-empty-response');
  return {response:choice.message.content};
  }
 }
}
export function assistantProvider(env,{signal}={}){
 const name=env.ASSISTANT_PROVIDER||'cloudflare';
 if(name==='groq'&&typeof env.GROQ_API_KEY==='string'&&env.GROQ_API_KEY.trim())return new GroqInference(env.GROQ_API_KEY.trim(),signal);
 if(name==='cloudflare'&&env.AI)return new CloudflareInference(env.AI);
 throw new Error('ai-not-configured');
}

function waitForRetry(seconds,signal){
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const finish=()=>{signal.removeEventListener('abort',abort);resolve();},timer=setTimeout(finish,seconds*1000);
  const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};signal.addEventListener('abort',abort,{once:true});
 });
}
