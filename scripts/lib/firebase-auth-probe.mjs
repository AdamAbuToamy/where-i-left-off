import {firebaseOrigins} from '../api-protection-policy.mjs';
const PROJECT='where-i-left-off-b5683',NUMBER='166135877928',SITE='https://where-i-left-off.web.app';
/** Public configuration only: no sign-in, OAuth token, email, or account mutation. */
export async function probeFirebaseAuth(sdk,{fetch:request=fetch}={}){
 if(sdk?.projectId!==PROJECT||!new RegExp('^1:'+NUMBER+':web:[A-Za-z0-9_-]+$').test(sdk.appId||'')||!/^AIza[A-Za-z0-9_-]{30,60}$/.test(sdk.apiKey||''))throw new Error('project-mismatch');
 firebaseOrigins(sdk.authDomain,PROJECT);
 const required=[new URL(SITE).hostname,sdk.authDomain];
 const checks=await Promise.all([SITE,'https://'+sdk.authDomain].map(async origin=>{
  try{
   const r=await request('https://identitytoolkit.googleapis.com/v1/projects?'+new URLSearchParams({key:sdk.apiKey}),{headers:{Referer:origin+'/'},redirect:'manual',signal:AbortSignal.timeout(20000)}),body=await r.json();
   const reason=body?.error?.details?.map(d=>d.reason).find(v=>typeof v==='string'&&/^[A-Z_]{1,80}$/.test(v))||'';
   const projectMatches=r.ok&&[PROJECT,NUMBER].includes(String(body?.projectId));
   const missingAuthorizedDomains=r.ok&&projectMatches?required.filter(d=>!body.authorizedDomains?.includes(d)):[];
   return {origin,status:r.status,reason,projectMatches,missingAuthorizedDomains};
  }catch{return {origin,status:0,reason:'NETWORK_OR_RESPONSE_ERROR',projectMatches:false,missingAuthorizedDomains:[]};}
 }));
 const blocked=checks.some(c=>c.reason==='API_KEY_HTTP_REFERRER_BLOCKED');
 return {status:blocked?'auth-origin-blocked':checks.every(c=>c.status===200&&c.projectMatches&&!c.missingAuthorizedDomains.length)?'public-auth-checks-passed':'needs-review',checks,oauthSignInVerified:false,emailLinkVerified:false};
}
