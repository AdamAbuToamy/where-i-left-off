import {getToken} from 'firebase/app-check';
import {auth,db,appCheck,emulatorMode} from '../lib/firebase';
import {AssistantFailure} from './failure';
type Dependencies={uid:()=>string|undefined;identity:(refresh:boolean)=>Promise<string>;attestation:(refresh:boolean)=>Promise<string>;endpoint:()=>Promise<string>;fetch:typeof fetch};
/** The assistant has its own transport boundary; push subscription support is irrelevant. */
export class AssistantApi {
 private readonly dependencies:Dependencies;
 constructor(dependencies:Dependencies){this.dependencies=dependencies;}
 async request<T>(payload:Record<string,unknown>,timeout=60000):Promise<T>{
  const d=this.dependencies,uid=d.uid();if(!uid)throw new AssistantFailure('assistant-auth-required','identity');
  const signal=AbortSignal.timeout(timeout);let endpoint:string;
  try{endpoint=await d.endpoint();}catch(e){throw AssistantFailure.from(e,'configuration');}
  for(let attempt=0;attempt<2;attempt++){
   let identity:string,appcheck:string;
   try{identity=await d.identity(attempt===1);}catch{throw new AssistantFailure('assistant-auth-refresh','identity');}
   try{appcheck=await d.attestation(attempt===1);}catch(error){if(error instanceof AssistantFailure)throw error;throw new AssistantFailure('assistant-app-check-failed','app-check');}
   if(d.uid()!==uid)throw new AssistantFailure('account-changed','identity');
   let response:Response;
   try{response=await d.fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${identity}`,'X-Firebase-AppCheck':appcheck},body:JSON.stringify(payload),signal});}
   catch{throw new AssistantFailure(signal.aborted?'assistant-timeout':'assistant-network','request');}
   if(d.uid()!==uid)throw new AssistantFailure('account-changed','identity');
   let body:Record<string,unknown>;try{body=await response.json();if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{throw new AssistantFailure('assistant-server-response','request',{status:response.status});}
   if(!response.ok){
    if(response.status===401&&attempt===0)continue;
    throw AssistantFailure.remote(body,response.status,response.headers.get('x-wilo-request-id'),response.headers.get('x-wilo-assistant-version'));
   }
   if(!Object.hasOwn(body,'result'))throw new AssistantFailure('assistant-server-response','request',{status:response.status});
   return body.result as T;
  }
  throw new AssistantFailure('assistant-auth-refresh','identity');
 }
}
let endpointPromise:Promise<string>|undefined;
async function endpoint(){return endpointPromise ||= fetch('/assistant-config.json',{cache:'no-store'}).catch(()=>{throw new AssistantFailure('assistant-network','configuration');}).then(async response=>{
 // Transitional fallback is only for an absent config, never malformed or refused settings.
 if(response.status===404){const legacy=await fetch('/push-config.json',{cache:'no-store'}).catch(()=>{throw new AssistantFailure('assistant-network','configuration');});if(!legacy.ok)throw new Error();const value=await legacy.json();return validateEndpoint(new URL('/assistant',value.endpoint).href);}
 if(!response.ok)throw new Error();const value=await response.json();return validateEndpoint(value.endpoint);
}).catch(error=>{endpointPromise=undefined;if(error instanceof AssistantFailure)throw error;throw new AssistantFailure('assistant-config-unavailable','configuration');});}
function validateEndpoint(value:unknown){
 if(typeof value!=='string')throw new Error();const url=new URL(value);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/assistant')throw new Error();return url.href;
}
const api=new AssistantApi({uid:()=>db?auth?.currentUser?.uid:undefined,identity:async refresh=>{if(!auth?.currentUser)throw new Error();return auth.currentUser.getIdToken(refresh);},attestation:async refresh=>{if(emulatorMode)return 'local-browser-test-only';if(!appCheck)throw new AssistantFailure('assistant-app-check-unavailable','app-check');return (await getToken(appCheck,refresh)).token;},endpoint,fetch:(...args)=>fetch(...args)});
export function assistantRequest<T>(data:Record<string,unknown>,timeout?:number){return api.request<T>(data,timeout);}
