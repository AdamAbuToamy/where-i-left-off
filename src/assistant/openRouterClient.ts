import {routerKey} from './openRouterAuth';
import {conversationInput,readConversationChoice} from '../../push-worker/src/assistantConversation.mjs';
import {runWorkspaceTools,workspaceToolStep} from '../../push-worker/src/assistantTools.mjs';
import type {WorkspaceToolInput} from '../../push-worker/src/assistantTools.mjs';
const MODELS=['google/gemma-4-26b-a4b-it:free','nvidia/nemotron-3.5-lightning:free'];
export class OpenRouterAssistant{
 private uid:string;constructor(uid:string){this.uid=uid;}
 private async complete(input:WorkspaceToolInput,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+routerKey(this.uid),'Content-Type':'application/json','HTTP-Referer':location.origin,'X-OpenRouter-Title':'Wilo'},body:JSON.stringify({model:MODELS[0],models:MODELS,messages:input.messages,tools:input.tools,tool_choice:'auto',provider:{require_parameters:true,sort:'latency'},reasoning:{enabled:false},max_tokens:input.max_tokens||2048,temperature:0.2}),signal:AbortSignal.any([AbortSignal.timeout(25000),...(signal?[signal]:[])])});
  if(!response.ok)throw new Error(response.status===401?'assistant-connect-required':response.status===429?'ai-provider-limit':response.status===402?'ai-provider-limit':'assistant-network');
  const body=await response.json();if(body.error)throw new Error('assistant-network');return body.choices?.[0];
 }
 async conversation(data:{message:string;language:string;displayName?:string;history:{role:'user'|'assistant';content:string}[]}){
  return readConversationChoice(await this.complete(conversationInput(data,data.history))).conversation;
 }
 async workspace(request:{message:string;language:string;context:string;history:{role:'user'|'assistant';content:string}[];repair?:{reason:string;proposal:string}}){
  const text=await runWorkspaceTools(request,request.history,async(input,signal)=>workspaceToolStep(await this.complete(input,signal)),45000,false);return {text};
 }
}