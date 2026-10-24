import {writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function pilotWorkerConfiguration(raw){
 const config=JSON.parse(raw);
 if(config.name!=='wilo-free-push'||!/^[a-f0-9]{32}$/.test(config.account_id||'')||config.vars?.FIREBASE_PROJECT_ID!=='where-i-left-off-b5683'||config.vars?.ASSISTANT_FREE_ONLY!=='true'||!config.d1_databases?.some(d=>d.binding==='DB'&&/^[a-f0-9-]{36}$/.test(d.database_id||'')))throw new Error('Invalid existing Worker configuration; no deployment attempted.');
 return {...config,vars:{...config.vars,ASSISTANT_PROVIDER:'gemini',ASSISTANT_PILOT_EMAIL:'adam2002hosny@gmail.com'}};
}
export function deployAssistantPilot(env=process.env){
 const required=['CLOUDFLARE_API_TOKEN','CLOUDFLARE_WORKER_CONFIG','GEMINI_API_KEY'];
 const missing=required.filter(name=>!env[name]?.trim());
 if(missing.length)throw new Error('Missing repository secrets: '+missing.join(', ')+'. No Worker or website deployment attempted.');
 const config=pilotWorkerConfiguration(env.CLOUDFLARE_WORKER_CONFIG),path='push-worker/wrangler.pilot.json';
 const wrangler='push-worker/node_modules/wrangler/bin/wrangler.js';
 const childEnv={...env,WRANGLER_SEND_METRICS:'false'};delete childEnv.GEMINI_API_KEY;delete childEnv.CLOUDFLARE_WORKER_CONFIG;
 function run(args,input){const result=spawnSync(process.execPath,[wrangler,...args,'--config',path],{env:childEnv,input,stdio:input?['pipe','inherit','inherit']:'inherit'});if(result.status!==0)throw new Error('Pilot Worker deployment failed. Hosting was not changed.');}
 try{
  writeFileSync(path,JSON.stringify(config),{mode:0o600});
  run(['secret','put','GEMINI_API_KEY'],env.GEMINI_API_KEY.trim());
  run(['deploy']);
 }finally{rmSync(path,{force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{deployAssistantPilot();}catch(error){console.error(error.message);process.exitCode=1;}
}
