#!/usr/bin/env node
// Read the already-registered public App Check site key using the owner's
// existing Firebase CLI session. Never create a key or loosen enforcement.
// Keep all credentials and provider responses out of logs.
import {createRequire} from 'node:module';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const PROJECT='where-i-left-off-b5683';
const require=createRequire(import.meta.url);
const files=['.env','.env.local','.env.production','.env.production.local'];
const config={};
for(const file of files)if(existsSync(file))Object.assign(config,parseEnv(readFileSync(file,'utf8')));
const validKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(value);
try{
  if(config.VITE_FIREBASE_PROJECT_ID!==PROJECT)throw new Error('firebase-project-mismatch');
  if(!/^\d+:\d+:web:[A-Za-z0-9_-]+$/.test(config.VITE_FIREBASE_APP_ID||''))throw new Error('firebase-app-id-missing');
  if(validKey(config.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY)){
    console.log('Existing App Check site key found. No configuration changes.');
    process.exit(0);
  }
  const {getProjectDefaultAccount,getGlobalDefaultAccount}=require('firebase-tools/lib/auth');
  const {requireAuth}=require('firebase-tools/lib/requireAuth');
  const {needProjectNumber}=require('firebase-tools/lib/projectUtils');
  const account=getProjectDefaultAccount(process.cwd())||getGlobalDefaultAccount();
  if(!account)throw new Error('firebase-cli-login-required');
  const options={project:PROJECT,user:account.user,tokens:account.tokens,nonInteractive:true};
  await requireAuth(options);
  const number=String(await needProjectNumber(options));
  if(!/^\d+$/.test(number)||!config.VITE_FIREBASE_APP_ID.startsWith('1:'+number+':web:'))throw new Error('firebase-app-project-mismatch');
  const appCheckApi=require('firebase-tools/lib/appcheck/api');
  let siteKey,provider;
  for(const candidate of ['recaptcha-enterprise','recaptcha-v3']){
    try{
      const registered=await appCheckApi.getProviderConfig(number,config.VITE_FIREBASE_APP_ID,candidate);
      if(validKey(registered?.siteKey)){siteKey=registered.siteKey;provider=candidate;break;}
    }catch(error){
      const status=Number(error?.status||error?.context?.response?.statusCode||0);
      if(status===404)continue;
      throw new Error('app-check-api-access-'+(status||'failed'));
    }
  }
  if(!siteKey)throw new Error('app-check-registered-site-key-not-found');
  const env={
    VITE_FIREBASE_API_KEY:config.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN:config.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID:PROJECT,
    VITE_FIREBASE_APP_ID:config.VITE_FIREBASE_APP_ID,
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY:siteKey,
    VITE_APP_CHECK_PROVIDER:provider,
    VITE_USE_EMULATORS:'false',
    VITE_TEST_OFFLINE:'false',
  };
  if(Object.values(env).some(v=>typeof v!=='string'||!v||/[\r\n\0]/.test(v)))throw new Error('firebase-public-config-incomplete');
  // Only public build identifiers; never dump tokens, account data or secrets.
  writeFileSync('.env.production.local',Object.entries(env).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});
  console.log('Existing Firebase App Check configuration restored locally ('+provider+'). No server configuration changed.');
}catch(error){
  console.error('STOP: automatic App Check recovery failed: '+(error instanceof Error?error.message:'unknown-error'));
  console.error('No deployment attempted. Check App Check provider registration/permissions for the existing Firebase project.');
  process.exitCode=1;
}
