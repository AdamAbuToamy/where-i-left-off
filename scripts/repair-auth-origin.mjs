import {createSign} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {probeFirebaseAuth} from './lib/firebase-auth-probe.mjs';
import {firebaseOrigins,repairAuthOrigin} from './api-protection-policy.mjs';
const PROJECT='where-i-left-off-b5683',SITE='https://where-i-left-off.web.app',fix=process.argv.includes('--fix');
let phase='credentials',status=0;
const report={mode:fix?'repair':'read-only',status:'not-complete',authDomain:'',checks:[]};
async function request(url,options={}){
 const r=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});status=r.status;
 if(!r.ok)throw new Error('http-failed');return r.json();
}
try{
 const key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'null');
 if(!key||key.project_id!==PROJECT||typeof key.private_key!=='string'||typeof key.client_email!=='string')throw new Error('credentials-unavailable');
 phase='public-config';const sdk=await request(SITE+'/__/firebase/init.json');
 if(sdk.projectId!==PROJECT||typeof sdk.apiKey!=='string'||!/^1:\d+:web:/.test(sdk.appId||''))throw new Error('project-mismatch');
 const number=sdk.appId.split(':')[1];firebaseOrigins(sdk.authDomain,PROJECT);report.authDomain=sdk.authDomain;
 phase='public-auth-probe';report.browserProbe=await probeFirebaseAuth(sdk);
 const json=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const unsigned=json({alg:'RS256',typ:'JWT'})+'.'+json({iss:key.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 phase='service-auth';const jwt=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(key.private_key,'base64url');
 const token=(await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})})).access_token;
 if(typeof token!=='string')throw new Error('service-auth-failed');
 const headers={authorization:'Bearer '+token,'content-type':'application/json'};
 phase='key-lookup';const lookup=await request('https://apikeys.googleapis.com/v2/keys:lookupKey?'+new URLSearchParams({keyString:sdk.apiKey}),{headers});
 if(!new RegExp('^projects/'+number+'/locations/global/keys/[A-Za-z0-9_-]+$').test(lookup.name||''))throw new Error('key-project-mismatch');
 phase='key-restrictions';const metadata=await request('https://apikeys.googleapis.com/v2/'+lookup.name,{headers});
 const plan=repairAuthOrigin(metadata.restrictions,sdk.authDomain);report.checks.push({label:'firebase-sdk-key',missingAuthOrigin:plan.changed,repaired:false});
 if(fix&&plan.changed){
  if(!metadata.etag)throw new Error('missing-etag');phase='repair-auth-origin';
  const operation=await request('https://apikeys.googleapis.com/v2/'+lookup.name+'?updateMask=restrictions',{method:'PATCH',headers,body:JSON.stringify({name:lookup.name,etag:metadata.etag,restrictions:plan.restrictions})});
  if(!/^operations\/[A-Za-z0-9_.~-]+$/.test(operation.name||''))throw new Error('invalid-operation');
  let done=operation;
  for(let i=0;!done.done&&i<20;i++){await new Promise(r=>setTimeout(r,1000));done=await request('https://apikeys.googleapis.com/v2/'+operation.name,{headers});}
  if(!done.done||done.error)throw new Error('repair-not-confirmed');phase='verify-restrictions';
  const after=await request('https://apikeys.googleapis.com/v2/'+lookup.name,{headers});
  if(repairAuthOrigin(after.restrictions,sdk.authDomain).changed||JSON.stringify(after.restrictions?.apiTargets||[])!==JSON.stringify(metadata.restrictions?.apiTargets||[]))throw new Error('repair-not-confirmed');
  report.checks[0].repaired=true;
 }
 report.status=plan.changed&&!fix?'needs-repair':'configuration-checked';console.log(JSON.stringify(report));
}catch{
 report.status='needs-owner-review';report.phase=phase;report.httpStatus=status;
 console.error(JSON.stringify({status:report.status,phase,httpStatus:status,browserProbe:report.browserProbe}));process.exitCode=1;
}finally{writeFileSync('auth-origin-report.json',JSON.stringify(report,null,2)+'\n');}
