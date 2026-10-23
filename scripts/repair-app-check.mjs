import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chooseAttestation,domainRepair} from './app-check-repair.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const require=createRequire(import.meta.url),PROJECT='where-i-left-off-b5683';
let phase='login';
function errorCode(error){const code=error?.status||error?.statusCode||error?.context?.response?.statusCode||error?.original?.status;return Number.isInteger(Number(code))?String(code):'failed';}
try{
 const {getProjectDefaultAccount,getGlobalDefaultAccount}=require('firebase-tools/lib/auth');
 const {requireAuth}=require('firebase-tools/lib/requireAuth');
 const {needProjectNumber}=require('firebase-tools/lib/projectUtils');
 const {Client}=require('firebase-tools/lib/apiv2');
 const api=require('firebase-tools/lib/appcheck/api');
 const account=getProjectDefaultAccount(process.cwd())||getGlobalDefaultAccount();
 if(!account)throw new Error('firebase-login-required');
 const options={project:PROJECT,user:account.user,tokens:account.tokens,nonInteractive:true};
 await requireAuth(options);
 phase='project';const number=String(await needProjectNumber(options));
 const response=await fetch('https://where-i-left-off.web.app/__/firebase/init.json',{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('hosting-config-unavailable');
 const sdk=await response.json();
 if(sdk.projectId!==PROJECT||typeof sdk.appId!=='string'||!new RegExp(`^1:${number}:web:[A-Za-z0-9_-]+$`).test(sdk.appId))throw new Error('project-app-mismatch');
 let local={};for(const name of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(name))local={...local,...parseEnv(readFileSync(name,'utf8'))};
 async function provider(name){try{return await api.getProviderConfig(number,sdk.appId,name);}catch(e){if(errorCode(e)==='404')return null;throw e;}}
 phase='provider-config';const [enterprise,v3]=await Promise.all([provider('recaptcha-enterprise'),provider('recaptcha-v3')]);
 const plan=chooseAttestation({enterprise,v3,localSiteKey:local.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY});
 if(!/^[A-Za-z0-9_-]{20,200}$/.test(plan.siteKey))throw new Error('invalid-site-key');
 const audit={version:1,project:PROJECT,provider:plan.provider,clientKeyChanged:local.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY!==plan.siteKey,providerRegistered:false,domainsUpdated:false};
 const recaptcha=new Client({urlPrefix:'https://recaptchaenterprise.googleapis.com',apiVersion:'v1',auth:true});
 if(plan.provider==='recaptcha-enterprise'){
  phase='recaptcha-key';const keyName=`projects/${number}/keys/${plan.siteKey}`;
  const key=(await recaptcha.get(keyName)).body;
  if(key.name!==keyName&&key.name!==`projects/${PROJECT}/keys/${plan.siteKey}`)throw new Error('foreign-key');
  const update=domainRepair(key,['where-i-left-off.web.app','where-i-left-off.firebaseapp.com']);
  if(update){phase='allowed-domains';await recaptcha.patch(keyName,update,{queryParams:{updateMask:'webSettings.allowedDomains'}});audit.domainsUpdated=true;}
  if(plan.register){phase='register-provider';await api.updateProviderConfig(number,sdk.appId,'recaptcha-enterprise',{siteKey:plan.siteKey},['siteKey']);audit.providerRegistered=true;}
  const verified=await provider('recaptcha-enterprise');if(verified?.siteKey!==plan.siteKey)throw new Error('provider-verification-failed');
 }
 phase='local-config';const path='.env.production.local';
 if(existsSync(path))copyFileSync(path,`${path}.backup-${Date.now()}`);
 const values={...local,...(existsSync(path)?parseEnv(readFileSync(path,'utf8')):{}),VITE_FIREBASE_PROJECT_ID:PROJECT,VITE_FIREBASE_APP_ID:sdk.appId,VITE_FIREBASE_API_KEY:sdk.apiKey,VITE_FIREBASE_AUTH_DOMAIN:sdk.authDomain,VITE_RECAPTCHA_ENTERPRISE_SITE_KEY:plan.siteKey,VITE_APP_CHECK_PROVIDER:plan.provider,VITE_USE_EMULATORS:'false',VITE_TEST_OFFLINE:'false'};
 // Only public browser settings go into the build-specific file. Server environment variables are never copied.
 const publicKeys=['VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_RECAPTCHA_ENTERPRISE_SITE_KEY','VITE_APP_CHECK_PROVIDER','VITE_USE_EMULATORS','VITE_TEST_OFFLINE'];
 writeFileSync(path,publicKeys.map(k=>`${k}=${JSON.stringify(values[k])}`).join('\n')+'\n',{mode:0o600});
 writeFileSync('app-check-repair-report.json',JSON.stringify({...audit,providerConfigurationRead:true,enterpriseSettingsVerified:plan.provider==='recaptcha-enterprise',browserAttestationVerified:false},null,2)+'\n');
 console.log(`تم فحص إعداد App Check ومطابقة إعداد البناء: ${plan.provider}.`);
 console.log('لم نغيّر قواعد الوصول أو enforcement أو درجة الحماية أو الفوترة.');
 console.log('انشر الواجهة الآن ثم أعد فتحها مرة واحدة. نجاح إعداد الخادم لا يثبت اجتياز تحقق المتصفح؛ التقرير محفوظ في app-check-repair-report.json.');
}catch(error){
 const known=['firebase-login-required','missing-site-key','not-a-score-web-key','project-app-mismatch','foreign-key','invalid-site-key'];
 const reason=known.includes(error?.message)?error.message:errorCode(error);
 const detail=error?.context?.body?.error;const serviceReason=(detail?.details||[]).map(d=>d?.reason).find(r=>typeof r==='string'&&/^[A-Z_]{1,80}$/.test(r))||(/^[A-Z_]{1,80}$/.test(String(detail?.status||''))?detail.status:'');
 writeFileSync('app-check-repair-report.json',JSON.stringify({version:1,status:'failed',project:PROJECT,phase,code:reason,serviceReason},null,2)+'\n');
 console.error(`توقف فحص App Check: ${phase} / ${reason}${serviceReason?" / "+serviceReason:""}. لم نعطّل الحماية. أرسل هذا السطر فقط.`);
 if(reason==='firebase-login-required')console.error('شغّل npx firebase login ثم أعد الأمر.');
 process.exitCode=1;
}
