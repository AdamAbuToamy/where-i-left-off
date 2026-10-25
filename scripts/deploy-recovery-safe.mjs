#!/usr/bin/env node
// Fail closed if an operator attempts a live deployment without App Check.
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const env = {};
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')));
}
const required = ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'];
const missing = required.filter(k => !env[k]?.trim());
if (missing.length || env.VITE_FIREBASE_PROJECT_ID !== 'where-i-left-off-b5683' || !/^[A-Za-z0-9_-]{20,200}$/.test(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '')) {
  console.error('STOP: production Firebase/App Check configuration incomplete or wrong project. Missing: ' + missing.join(', '));
  process.exit(1);
}
if (env.VITE_ASSISTANT_ENABLED === 'true') {
  console.error('STOP: WILO pilot must remain off during core site recovery.');
  process.exit(1);
}
const run = (bin,args,extra={})=>{
  const result=spawnSync(bin,args,{stdio:'inherit',env:{...process.env,...extra},shell:false});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
};
run('npm',['run','lint']);
run('npm',['run','build'],{VITE_USE_EMULATORS:'false',VITE_TEST_OFFLINE:'false',VITE_REQUIRE_FIREBASE_CONFIG:'true',VITE_REQUIRE_APP_CHECK:'true',VITE_ASSISTANT_ENABLED:'false'});
run('npx',['firebase','deploy','--only','hosting:production','--project','where-i-left-off-b5683']);
