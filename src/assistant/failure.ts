export type AssistantStage='read'|'configuration'|'identity'|'app-check'|'request'|'account'|'database'|'provider'|'validation'|'save';
const stages=new Set<AssistantStage>(['read','configuration','identity','app-check','request','account','database','provider','validation','save']);
const codes=new Set(['permission-denied','unavailable','deadline-exceeded','account-changed','assistant-format','assistant-invalid','assistant-reference','assistant-conflict','assistant-pending','assistant-linked-reminder','assistant-too-large','assistant-confirmation','assistant-local-not-ready','assistant-local-unsupported','assistant-local-context','assistant-local-timeout','assistant-local-failed','assistant-local-load','assistant-local-response','assistant-browser-permission','assistant-read-failed','assistant-config-unavailable','assistant-auth-required','assistant-auth-refresh','assistant-app-check-unavailable','assistant-app-check-failed','assistant-network','assistant-timeout','assistant-server-response','assistant-server-rejected','assistant-save-failed','ai-context-read-limit','ai-rate-limit','ai-provider-limit','ai-provider-access','ai-provider-context','ai-unavailable-or-quota','ai-not-configured','ai-incomplete-proposal','ai-intent-format','ai-empty-response','ai-invalid-input','ai-response-too-large','ai-auth-required','ai-app-check-failed','ai-account-unavailable','ai-email-unverified','ai-service-identity','ai-service-permission','ai-service-config','ai-service-database','ai-storage-not-ready','ai-internal','ai-daily-limit','ai-user-limit']);
export class AssistantFailure extends Error {
 readonly code:string;readonly stage:AssistantStage;readonly status?:number;readonly requestId?:string;readonly protocol?:string;
 providerFailure?:{status:number;code:string;rate?:Record<string,string|number|boolean>};
 details?:unknown;
 constructor(code:string,stage:AssistantStage,metadata:{status?:number;requestId?:unknown;protocol?:unknown}={}){
  super(codes.has(code)?code:stage==='read'?'assistant-read-failed':stage==='save'?'assistant-save-failed':'assistant-server-rejected');this.name='AssistantFailure';this.code=this.message;this.stage=stage;
  this.status=Number.isInteger(metadata.status)&&metadata.status!>=100&&metadata.status!<=599?metadata.status:undefined;
  this.requestId=typeof metadata.requestId==='string'&&/^[a-f0-9-]{36}$/.test(metadata.requestId)?metadata.requestId:undefined;
  this.protocol=typeof metadata.protocol==='string'&&/^wilo-assistant-[a-z0-9-]{1,40}$/.test(metadata.protocol)?metadata.protocol:undefined;
 }
 static from(error:unknown,stage:AssistantStage):AssistantFailure{
  if(error instanceof AssistantFailure)return error;
  const e=error as {code?:unknown;message?:unknown;details?:unknown},raw=typeof e?.code==='string'?e.code.replace(/^firestore\//,''):typeof e?.message==='string'?e.message:'';
  const failure=new AssistantFailure(raw,stage);failure.details=e?.details;failure.cause=error;return failure;
 }
 static remote(body:Record<string,unknown>,status:number,requestId:string|null,protocol:string|null){
  const diagnostic=body.diagnostic as Record<string,unknown>|undefined,stage=typeof diagnostic?.stage==='string'&&stages.has(diagnostic.stage as AssistantStage)?diagnostic.stage as AssistantStage:'request';
  const failure=new AssistantFailure(typeof body.error==='string'?body.error:'assistant-server-response',stage,{status,requestId:diagnostic?.requestId||requestId,protocol:diagnostic?.protocol||protocol});
  if(failure.code==='ai-incomplete-proposal')failure.details=body.details;
  const provider=diagnostic?.providerFailure as Record<string,unknown>|undefined;
  if(provider&&Number.isInteger(provider.status)&&Number(provider.status)>=0&&Number(provider.status)<=599){
   const allowed=new Set(['unclassified','invalid_api_key','invalid_request_error','json_validate_failed','model_not_found','model_decommissioned','rate_limit_exceeded','context_length_exceeded','permission_denied']);
   failure.providerFailure={status:Number(provider.status),code:typeof provider.code==='string'&&allowed.has(provider.code)?provider.code:'unclassified'};
   const rate=provider.rate as Record<string,unknown>|undefined;
   if(rate&&['tokens-minute','tokens-day','requests-minute','requests-day'].includes(String(rate.scope))){
    const safe:Record<string,string|number|boolean>={scope:String(rate.scope)};
    for(const key of ['limit','requested','retryAfterSeconds'])if(typeof rate[key]==='number'&&Number.isFinite(rate[key])&&rate[key]>=0&&rate[key]<=1e12)safe[key]=rate[key];
    failure.providerFailure.rate=safe;
   }
  }
  return failure;
 }
 diagnostic(){return {stage:this.stage,code:this.code,...(this.status?{httpStatus:this.status}:{}),...(this.requestId?{requestId:this.requestId}:{}),...(this.protocol?{protocol:this.protocol}:{}),...(this.providerFailure?{providerFailure:this.providerFailure}:{})};}
}
