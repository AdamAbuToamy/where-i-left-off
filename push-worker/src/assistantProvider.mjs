export const CLOUDFLARE_MODEL='@cf/openai/gpt-oss-120b';
export const GROQ_MODEL='openai/gpt-oss-120b';

class CloudflareInference {
 constructor(binding){this.binding=binding;this.model=CLOUDFLARE_MODEL;this.name='cloudflare';}
 run(input){return this.binding.run(this.model,input);}
}
/** Credentials stay in the Worker; endpoints and model cannot come from user input. */
class GroqInference {
 constructor(key){this.key=key;this.model=GROQ_MODEL;this.name='groq';}
 async run(input){
  const body={model:this.model,messages:input.messages,temperature:input.temperature,max_completion_tokens:input.max_tokens,reasoning_effort:'low'};
  if(input.response_format)body.response_format=input.response_format.type==='json_schema'
   ?{type:'json_schema',json_schema:{name:'wilo_reply',strict:false,schema:input.response_format.json_schema}}
   :input.response_format;
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
   method:'POST',redirect:'error',headers:{authorization:`Bearer ${this.key}`,'content-type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(40000),
  });
  // Never include upstream payloads, headers or secrets in errors/logs.
  if(!response.ok){await response.body?.cancel();const error=new Error(response.status===413?'ai-provider-context':'provider-request-failed');error.status=response.status;throw error;}
  const result=await response.json(),choice=result?.choices?.[0];
  if(choice?.finish_reason==='length')throw new Error('ai-response-too-large');
  if(typeof choice?.message?.content!=='string'||!choice.message.content.trim())throw new Error('ai-empty-response');
  return {response:choice.message.content};
 }
}
export function assistantProvider(env){
 const name=env.ASSISTANT_PROVIDER||'cloudflare';
 if(name==='groq'&&typeof env.GROQ_API_KEY==='string'&&env.GROQ_API_KEY.trim())return new GroqInference(env.GROQ_API_KEY.trim());
 if(name==='cloudflare'&&env.AI)return new CloudflareInference(env.AI);
 throw new Error('ai-not-configured');
}
