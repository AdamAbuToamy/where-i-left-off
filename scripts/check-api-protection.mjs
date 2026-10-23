import {createRequire} from 'node:module';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectRestrictions,repairRestrictions} from './api-protection-policy.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const PROJECT='where-i-left-off-b5683', require=createRequire(import.meta.url);
const fix=process.argv.includes('--fix');let phase='login',accessToken;
const report={version:1,project:PROJECT,mode:fix?'repair':'read-only',checks:[],browserAttestationVerified:false};
function failure(code,reason=''){const e=new Error(code);e.reason=reason;return e;}
async function request(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${accessToken}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok){const reason=data?.error?.details?.map(x=>x.reason).find(x=>typeof x==='string'&&/^[A-Z_]{1,80}$/.test(x))||'';throw failure('http-'+response.status,reason);}
 return data;
}
async function poll(operation){
 if(!/^operations\/[A-Za-z0-9_.~-]+$/.test(operation.name||''))throw failure('invalid-operation');
 for(let i=0;i<15;i++){
  const state=await request('https://apikeys.googleapis.com/v2/'+operation.name);
  if(state.done){if(state.error)throw failure('update-failed');return;}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw failure('update-still-pending');
}
try {
 const {getProjectDefaultAccount,getGlobalDefaultAccount}=require('firebase-tools/lib/auth');
 const {requireAuth}=require('firebase-tools/lib/requireAuth');
 const {needProjectNumber}=require('firebase-tools/lib/projectUtils');
 const account=getProjectDefaultAccount(process.cwd())||getGlobalDefaultAccount();
 if(!account)throw failure('firebase-login-required');
 const options={project:PROJECT,user:account.user,tokens:account.tokens,nonInteractive:true};
 await requireAuth(options);const number=String(await needProjectNumber(options));
 accessToken=await require('firebase-tools/lib/apiv2').getAccessToken();
 phase='public-config';
 let local={};for(const file of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(file))local={...local,...parseEnv(readFileSync(file,'utf8'))};
 if(local.VITE_FIREBASE_PROJECT_ID&&local.VITE_FIREBASE_PROJECT_ID!==PROJECT)throw failure('local-project-mismatch');
 async function publicRead(path,json=false){const r=await fetch('https://where-i-left-off.web.app'+path,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw failure('public-config-http-'+r.status);if(path==='/')report.hostedReferrerPolicy=r.headers.get('referrer-policy');return json?r.json():r.text();}
 const sdk=await publicRead('/__/firebase/init.json',true);if(sdk.projectId!==PROJECT||!new RegExp(`^1:${number}:web:[A-Za-z0-9_-]+$`).test(sdk.appId||''))throw failure('hosted-project-mismatch');
 report.localReferrerPolicy=JSON.parse(readFileSync('firebase.json','utf8')).hosting.headers.find(x=>x.source==='**')?.headers.find(x=>x.key==='Referrer-Policy')?.value;
 const html=await publicRead('/');const entry=html.match(/<script\b[^>]*\bsrc="(\/assets\/[^"?#]+\.js)"/i)?.[1];
 if(!entry)throw failure('hosted-entry-missing');
 const bundle=await publicRead(entry);
 const deployedKey=bundle.match(/VITE_FIREBASE_API_KEY\s*:\s*[`"'](AIza[A-Za-z0-9_-]+)[`"']/)?.[1];
 if(!deployedKey)throw failure('hosted-api-key-unreadable');
 const localKey=local.VITE_FIREBASE_API_KEY||sdk.apiKey;
 report.localAndDeployedKeyMatch=localKey===deployedKey;
 const keys=localKey===deployedKey?[['local-and-deployed',localKey]]:[['local-build',localKey],['deployed',deployedKey]];
 for(const [label,keyString] of keys){
  if(!/^AIza[A-Za-z0-9_-]{30,60}$/.test(keyString||''))throw failure('invalid-public-key');
  phase='key-lookup-'+label;
  const lookup=await request('https://apikeys.googleapis.com/v2/keys:lookupKey?'+new URLSearchParams({keyString}));
  if(!new RegExp(`^projects/${number}/locations/global/keys/[A-Za-z0-9_-]+$`).test(lookup.name||''))throw failure('key-project-mismatch');
  phase='key-restrictions-'+label;
  const metadata=await request('https://apikeys.googleapis.com/v2/'+lookup.name);
  const before=inspectRestrictions(metadata.restrictions);const check={label,...before,repaired:false};report.checks.push(check);
  console.log(`${label}: missing APIs=${before.missingServices.join(',')||'none'}; missing site domains=${before.missingOrigins.join(',')||'none'}; method limits=${before.methodRestricted.join(',')||'none'}; wrong key type=${before.incompatibleApplication}`);
  if(fix){
   phase='repair-plan-'+label;
   const plan=repairRestrictions(metadata.restrictions);
   if(plan.changed){
    if(!metadata.etag)throw failure('missing-key-etag');
    phase='repair-'+label;
    const operation=await request('https://apikeys.googleapis.com/v2/'+lookup.name+'?updateMask=restrictions','PATCH',{name:lookup.name,etag:metadata.etag,restrictions:plan.restrictions});
    await poll(operation);
    const verified=inspectRestrictions((await request('https://apikeys.googleapis.com/v2/'+lookup.name)).restrictions);
    if(verified.missingServices.length||verified.missingOrigins.length)throw failure('repair-not-verified');
    check.repaired=true;check.after=verified;
   }
  }
 }
 phase='app-check';const api=require('firebase-tools/lib/appcheck/api');
 for(const name of ['recaptcha-enterprise','recaptcha-v3']){
  try{const c=await api.getProviderConfig(number,sdk.appId,name);report[name]={registered:Boolean(c?.siteKey||c?.siteSecretSet),localSiteKeyMatches:c?.siteKey?c.siteKey===local.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY:null};}
  catch(e){const status=e?.status||e?.context?.response?.statusCode;if(Number(status)===404)report[name]={registered:false};else throw failure('provider-read-failed');}
 }
 report.status=report.checks.some(x=>x.incompatibleApplication||x.methodRestricted.length||(!x.repaired&&(x.missingServices.length||x.missingOrigins.length)))?'needs-review':'configuration-checked';
 console.log('فحص الإعدادات انتهى. تفاصيل آمنة في api-protection-report.json. لم نغيّر enforcement أو القواعد أو الفوترة.');
 console.log('هذا الفحص لا يثبت نجاح reCAPTCHA في المتصفح. إذا استمر الخطأ أرسل التقرير فقط، ولا ترسل ملفات env أو مفاتيح خاصة.');
 if(report.status==='needs-review')process.exitCode=2;
}catch(error){
 report.status='failed';report.phase=phase;report.code=/^(?:[a-z][a-z0-9-]{0,100})$/.test(error.message)?error.message:'request-failed';report.reason=error.reason||'';if(error instanceof TypeError)report.code='script-type-error';
 console.error(`توقف فحص الحماية: ${phase} / ${report.code}${report.reason?' / '+report.reason:''}`);
 if(report.code==='firebase-login-required')console.error('شغّل npx firebase login ثم أعد الفحص.');
 process.exitCode=1;
}finally{writeFileSync('api-protection-report.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});}
