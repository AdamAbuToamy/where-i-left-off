import {assistantProvider} from './assistantProvider.mjs';
import {safeProviderFailure} from './assistantErrors.mjs';
import {ASSISTANT_PROTOCOL} from '../../shared/assistantProtocol.mjs';
export {ASSISTANT_PROTOCOL};
/** Public error labels only: never return exception text, JWTs or upstream payloads. */
export function assistantFailure(error,stage,requestId){
 if(error?.assistantStage==='configuration')stage='configuration';
 const message=String(error?.message||'');let code='ai-internal',status=500;
 if(error?.authStage==='app-check'){code='ai-app-check-failed';status=401;stage='app-check';}
 else if(stage==='identity'){code='ai-auth-required';status=401;}
 else if(message==='account-unavailable'){code='ai-account-unavailable';status=403;}
 else if(message==='reader-auth-failed'){code='ai-service-identity';status=503;}
 else if(message==='auth-lookup-failed'){code='ai-service-permission';status=503;}
 else if(message==='wrong-project'){code='ai-service-config';status=503;}
 else if(message==='database-unavailable'){code='ai-service-database';status=503;}
 else if(message==='invalid-size'){code='ai-invalid-input';status=413;}
 else if(/^ai-[a-z-]+$/.test(message)){
  code=message;
  status=/provider-limit|rate-limit|daily-limit|user-limit/.test(code)?429:/provider-access/.test(code)?502:/provider-context|response-too-large/.test(code)?413:/not-configured|storage-not-ready|unavailable-or-quota/.test(code)?503:/email-unverified/.test(code)?403:400;
 }
 else if(stage==='database'){code='ai-storage-not-ready';status=503;}
 else if(stage==='account'){code='ai-service-identity';status=503;}
 else if(stage==='request'){code='ai-invalid-input';status=400;}
 const metadata={stage,requestId,protocol:ASSISTANT_PROTOCOL};
 const provider=error?.cause;if(provider)metadata.providerFailure=safeProviderFailure(provider);
 return {status,body:{error:code,diagnostic:metadata,...(code==='ai-incomplete-proposal'?{details:error.details}:{} )}};
}
export async function assistantHealth(env){
 if(env.ASSISTANT_FREE_ONLY!=='true')throw Object.assign(new Error('ai-not-configured'),{assistantStage:'configuration'});
 let provider;try{provider=assistantProvider(env);}catch(error){error.assistantStage='configuration';throw error;}
 try{await env.DB.prepare('SELECT day FROM ai_budget LIMIT 1').first();await env.DB.prepare('SELECT day FROM ai_usage LIMIT 1').first();}
 catch{throw new Error('ai-storage-not-ready');}
 return {status:'ready',protocol:ASSISTANT_PROTOCOL,provider:provider.name,model:provider.model,inferenceTested:false};
}
