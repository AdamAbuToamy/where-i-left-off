#!/usr/bin/env node
// Deploy a temporary owner-only WILO preview; NEVER deploy the live channel.
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const project='where-i-left-off-b5683';
const readEnv=()=>{const e={};for(const f of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(f))Object.assign(e,parseEnv(readFileSync(f,'utf8')));return e;};
function command(file,args,extra={}){const run=spawnSync(file,args,{stdio:'inherit',shell:false,env:{...process.env,...extra}});if(run.error)throw run.error;if(run.status!==0)process.exit(run.status||1);}
if(process.argv.includes('--help')){console.log('node scripts/deploy-owner-preview.mjs — host WILO owner pilot without touching live');process.exit(0);}
let env=readEnv();
if(!env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY){
 console.log('Recovering existing public Firebase/App Check configuration.');
 command('node',['scripts/prepare-hosting-config.mjs']);
 env=readEnv();
}
const keys=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
if(keys.some(k=>!env[k])||env.VITE_FIREBASE_PROJECT_ID!==project)throw new Error('Preview blocked: incomplete or wrong Firebase project/App Check configuration');
console.log('Checking source and owner-only access gate.');
command('npm',['run','lint']);
command('npm',['test','--','tests/cloudAppNavigation.test.tsx','tests/assistantWidget.test.tsx']);
console.log('Building owner-only preview. No emulator, no demo accounts.');
command('npm',['run','build'],{
 VITE_USE_EMULATORS:'false',VITE_TEST_OFFLINE:'false',
 VITE_REQUIRE_FIREBASE_CONFIG:'true',VITE_REQUIRE_APP_CHECK:'true',
 VITE_ASSISTANT_ENABLED:'true'
});
console.log('Deploying Firebase Hosting preview channel only; NOT production.');
command('npx',['firebase','hosting:channel:deploy','wilo-owner','--only','production','--project',project,'--expires','7d']);
console.log('Open the printed Preview URL; only the verified admin email can see WILO. This preview uses REAL Firebase account data: review actions carefully.');
