import {AssistantFailure} from './failure';
export type InferenceProgress='waiting'|'receiving';
/** A quiet connection expires; an answer that is arriving gets time to finish. */
export function inferenceBudget(parent?:AbortSignal){
 const controller=new AbortController();
 const abort=(reason:unknown)=>controller.abort(reason);
 const timeout=()=>abort(new DOMException('Assistant request timed out','TimeoutError'));
 let idle:ReturnType<typeof setTimeout>;
 const activity=()=>{clearTimeout(idle);idle=setTimeout(timeout,25000);};
 const hard=setTimeout(timeout,60000),cancel=()=>abort(parent?.reason);
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 activity();
 return {signal:controller.signal,activity,dispose(){clearTimeout(idle);clearTimeout(hard);parent?.removeEventListener('abort',cancel);}};
}
type ToolCall={id:string;type:'function';function:{name:string;arguments:string}};
type Completion={id?:string;usage?:{total_tokens?:number};error?:unknown;choices?:{message:{role:'assistant';content:string|null;tool_calls?:ToolCall[]};finish_reason?:string}[]};
/** Assemble SSE completely before validating or offering any app operation. */
export async function readInferenceResponse(response:Response,signal:AbortSignal,onDelta:()=>void):Promise<Completion>{
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return completionFromJson(await readBoundedJson(response,signal));
 if(!response.body)throw new AssistantFailure('assistant-network','provider');
 const reader=response.body.getReader(),decoder=new TextDecoder(),calls=new Map<number,ToolCall>();
 let buffer='',content='',finish='',done=false,bytes=0,size=0;
 const result:Completion={choices:[]};
 const invalid=()=>new Error('ai-incomplete-proposal');
 const event=(raw:string)=>{
  const payload=raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(!payload)return;if(payload.trim()==='[DONE]'){done=true;return;}
  let packet:unknown;try{packet=JSON.parse(payload);}catch{throw invalid();}
  if(!isRecord(packet))throw invalid();
  if(packet.error)throw new AssistantFailure('assistant-network','provider');
  if(typeof packet.id==='string')result.id=packet.id;
  if(packet.usage!=null){if(!isRecord(packet.usage)||typeof packet.usage.total_tokens!=='number'||!Number.isFinite(packet.usage.total_tokens)||packet.usage.total_tokens<0)throw invalid();result.usage={total_tokens:packet.usage.total_tokens};}
  if(!Array.isArray(packet.choices))throw invalid();
  const choices:unknown[]=packet.choices;
  for(const choice of choices){
   if(!isRecord(choice))throw invalid();
   if(choice.index!==undefined&&choice.index!==0)continue;
   const delta=choice.delta||{};if(!isRecord(delta))throw invalid();
   if(typeof delta.content==='string'&&delta.content){content+=delta.content;size+=delta.content.length;onDelta();}
   if(delta.tool_calls!==undefined&&delta.tool_calls!==null){
    if(!Array.isArray(delta.tool_calls))throw invalid();
    const parts:unknown[]=delta.tool_calls;
    for(const part of parts){
     if(!isRecord(part)||typeof part.index!=='number'||!Number.isInteger(part.index)||part.index<0||part.index>=50)throw invalid();
     const call=calls.get(part.index)||{id:'',type:'function',function:{name:'',arguments:''}};
     if(part.id){if(typeof part.id!=='string'||call.id&&call.id!==part.id)throw invalid();call.id=part.id;}
     const fn=part.function;if(fn!==undefined&&!isRecord(fn))throw invalid();
     if(fn?.name){if(typeof fn.name!=='string')throw invalid();if(call.function.name!==fn.name)call.function.name+=fn.name;onDelta();}
     if(fn?.arguments){if(typeof fn.arguments!=='string')throw invalid();call.function.arguments+=fn.arguments;size+=fn.arguments.length;onDelta();}
     calls.set(part.index,call);
    }
   }
   if(choice.finish_reason){if(typeof choice.finish_reason!=='string')throw invalid();finish=choice.finish_reason;}
  }
  if(size>160000)throw new AssistantFailure('ai-response-too-large','provider');
 };
 const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  for(;;){
   signal.throwIfAborted();
   const chunk=await reader.read();signal.throwIfAborted();
   if(chunk.done)break;
   bytes+=chunk.value.byteLength;if(bytes>2000000)throw new AssistantFailure('ai-response-too-large','provider');
   buffer+=decoder.decode(chunk.value,{stream:true});
   let boundary;while((boundary=/\r?\n\r?\n/.exec(buffer))){event(buffer.slice(0,boundary.index));buffer=buffer.slice(boundary.index+boundary[0].length);}
   if(buffer.length>200000)throw invalid();
   if(done)break;
  }
  buffer+=decoder.decode();if(buffer.trim())event(buffer);
  if(!done||!['stop','tool_calls'].includes(finish))throw invalid();
  const toolCalls=[...calls.entries()].sort(([a],[b])=>a-b).map(([,call])=>call);
  if(toolCalls.some(call=>!call.id||!call.function.name))throw invalid();
  result.choices=[{message:{role:'assistant',content:content||null,...(toolCalls.length?{tool_calls:toolCalls}:{})},finish_reason:finish}];
  return result;
 }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}

function isRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function completionFromJson(value:unknown):Completion{
 const invalid=()=>new Error('ai-incomplete-proposal');
 if(!isRecord(value))throw invalid();
 if(value.error)return {error:value.error};
 if(!Array.isArray(value.choices)||value.choices.length>2)throw invalid();
 const result:Completion={};
 if(typeof value.id==='string')result.id=value.id;
 if(value.usage!=null){
  if(!isRecord(value.usage)||typeof value.usage.total_tokens!=='number'||!Number.isFinite(value.usage.total_tokens)||value.usage.total_tokens<0)throw invalid();
  result.usage={total_tokens:value.usage.total_tokens};
 }
 const choices:unknown[]=value.choices;
 result.choices=choices.map(choice=>{
  if(!isRecord(choice)||!isRecord(choice.message))throw invalid();
  const message=choice.message;
  if(message.content!=null&&typeof message.content!=='string')throw invalid();
  let tool_calls:ToolCall[]|undefined;
  if(message.tool_calls!=null){
   if(!Array.isArray(message.tool_calls)||message.tool_calls.length>50)throw invalid();
   const calls:unknown[]=message.tool_calls;
   tool_calls=calls.map(call=>{
    if(!isRecord(call)||typeof call.id!=='string'||!isRecord(call.function)||typeof call.function.name!=='string'||typeof call.function.arguments!=='string')throw invalid();
    return {id:call.id,type:'function',function:{name:call.function.name,arguments:call.function.arguments}};
   });
  }
  return {message:{role:'assistant',content:message.content||null,...(tool_calls?{tool_calls}:{})}};
 });
 return result;
}

async function readBoundedJson(response:Response,signal:AbortSignal):Promise<unknown>{
 if(!response.body)throw new AssistantFailure('assistant-network','provider');
 const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
 const cancel=()=>{void reader.cancel(signal.reason).catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  for(;;){
   signal.throwIfAborted();const chunk=await reader.read();signal.throwIfAborted();if(chunk.done)break;
   bytes+=chunk.value.byteLength;if(bytes>2000000)throw new AssistantFailure('ai-response-too-large','provider');
   text+=decoder.decode(chunk.value,{stream:true});
  }
  text+=decoder.decode();return JSON.parse(text) as unknown;
 }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
