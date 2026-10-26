#!/usr/bin/env node
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadEnv} from 'vite';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {sourceFingerprint,assertLocalAcceptance} from './lib/localReleaseGate.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const reportPath='assistant-acceptance-browser-report.json';
function run(file,args,extra={}){
 const result=spawnSync(file,args,{stdio:'inherit',env:{...process.env,...extra}});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error('Command failed: '+file+' '+args.join(' '));
}
try{
 if(!existsSync(reportPath))throw new Error('No real browser report. Run: node scripts/test-assistant-browser.mjs --limit=618 --resume --persist');
 const report=JSON.parse(readFileSync(reportPath,'utf8'));
 assertLocalAcceptance(report,acceptanceCases,sourceFingerprint(),{requirePersistence:true});
 // These tests validate code, not model understanding. The model gate above is independent.
 run('npm',['run','lint']);run('npm',['test']);
 let env=loadEnv('production',process.cwd(),'VITE_');
 if(!env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY){run(process.execPath,['scripts/restore-app-check-config.mjs']);env=loadEnv('production',process.cwd(),'VITE_');}
 if(env.VITE_FIREBASE_PROJECT_ID!=='where-i-left-off-b5683')throw new Error('Wrong production Firebase project');
 const flags={WILO_LAB_ONLY:'false',VITE_USE_EMULATORS:'false',VITE_TEST_OFFLINE:'false',VITE_REQUIRE_APP_CHECK:'true',VITE_REQUIRE_FIREBASE_CONFIG:'true',VITE_ASSISTANT_ENABLED:'true'};
 run('npm',['run','build'],flags);
 // Deployment can be independently checked without trusting a stale service-worker shell.
 const manifest={release:LOCAL_RELEASE,fingerprint:report.fingerprint,modelAcceptance:{total:618,passed:618,persisted:618},builtAt:new Date().toISOString()};
 writeFileSync('dist/wilo-release.json',JSON.stringify(manifest,null,2)+'\n');
 run(process.execPath,['scripts/generate-sw.mjs']);
 run(process.execPath,['node_modules/firebase-tools/lib/bin/firebase.js','deploy','--only','hosting:production','--project','where-i-left-off-b5683']);
 const response=await fetch('https://where-i-left-off.web.app/wilo-release.json?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Hosting completed but release manifest could not be verified');
 const published=await response.json();
 if(published.fingerprint!==report.fingerprint||published.release?.version!==LOCAL_RELEASE.version)throw new Error('Hosting response still serves another release. Do not assume deployment is verified.');
 console.log('LIVE VERIFIED:',LOCAL_RELEASE.version,'https://where-i-left-off.web.app');
 console.log('Admin-only WILO. Firestore rules and existing data were not changed by deployment.');
}catch(error){console.error('STOP:',error instanceof Error?error.message:String(error));process.exitCode=1;}
