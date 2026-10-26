const KEY_PREFIX='wilo-openrouter-key:';
const FLOW_PREFIX='wilo-openrouter-flow:';
export function routerConnected(uid:string):boolean{return !!localStorage.getItem(KEY_PREFIX+uid);}
export function routerKey(uid:string):string{const key=localStorage.getItem(KEY_PREFIX+uid);if(!key)throw new Error('assistant-connect-required');return key;}
export function disconnectRouter(uid:string){localStorage.removeItem(KEY_PREFIX+uid);}
function randomToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export async function connectRouter(uid:string){
 const verifier=randomToken(),state=randomToken(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 sessionStorage.setItem(FLOW_PREFIX+uid,JSON.stringify({verifier,state,createdAt:Date.now(),returnHash:location.hash}));
 const url=new URL('https://openrouter.ai/auth');url.searchParams.set('callback_url',location.origin+'/?wilo_openrouter=1');url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');url.searchParams.set('state',state);url.searchParams.set('key_label','Wilo');location.assign(url.href);
}
export async function finishRouterConnection(uid:string):Promise<boolean>{
 const url=new URL(location.href);if(url.searchParams.get('wilo_openrouter')!=='1')return false;
 const code=url.searchParams.get('code'),state=url.searchParams.get('state'),raw=sessionStorage.getItem(FLOW_PREFIX+uid);
 const clean=()=>{for(const k of ['wilo_openrouter','code','state'])url.searchParams.delete(k);history.replaceState(null,'',url.pathname+url.search+url.hash);};
 if(!code||!raw){clean();throw new Error('assistant-connect-invalid');}
 const flow=JSON.parse(raw);
 if(!flow.verifier||flow.state!==state||Date.now()-flow.createdAt>600000){clean();throw new Error('assistant-connect-invalid');}
 const response=await fetch('https://openrouter.ai/api/v1/auth/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:flow.verifier,code_challenge_method:'S256'}),signal:AbortSignal.timeout(20000)});
 clean();if(!response.ok)throw new Error('assistant-connect-failed');const body=await response.json();
 if(typeof body.key!=='string'||!body.key.startsWith('sk-or-'))throw new Error('assistant-connect-failed');
 localStorage.setItem(KEY_PREFIX+uid,body.key);sessionStorage.removeItem(FLOW_PREFIX+uid);
 if(typeof flow.returnHash==='string'&&flow.returnHash.startsWith('#/')){url.hash=flow.returnHash;history.replaceState(null,'',url.pathname+url.search+url.hash);}
 return true;
}