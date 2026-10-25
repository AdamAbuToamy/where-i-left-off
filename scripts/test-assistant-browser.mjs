#!/usr/bin/env node
import {createServer as createHttpServer} from 'node:http';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer as createViteServer} from 'vite';
import {chromium} from '@playwright/test';
import {acceptanceCases,acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {sourceFingerprint,reportSummary,assertLocalAcceptance,inferenceEvidenceHash,LOCAL_REPORT_KIND} from './lib/localReleaseGate.mjs';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2);
const accepted=['--resume','--headed','--software','--check','--persist','--deploy','--verify-report','--smoke','--help'];
for(const arg of args)if(!accepted.includes(arg)&&!/^--(?:limit|case|port|profile|executable)=.+/.test(arg))throw new Error('Unknown argument: '+arg);
if(args.includes('--help')){
 console.log('Usage: node scripts/test-assistant-browser.mjs --limit=618 --resume --persist [--deploy] [--headed|--software]');
 console.log('Real shipped WebLLM model. No cloud API or Ollama. --check tests browser support without downloading weights.');process.exit(0);
}
const option=(name,otherwise)=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??otherwise;
const ids=args.filter(a=>a.startsWith('--case=')).map(a=>a.slice(7));
if(ids.some(id=>!acceptanceCases.some(c=>c.id===id)))throw new Error('Unknown acceptance case');
const selected=ids.length?acceptanceCases.filter(c=>ids.includes(c.id)):acceptanceCases;
const limit=Number(option('limit',selected.length)),port=Number(option('port',8176));
if(!Number.isInteger(limit)||limit<1||limit>selected.length||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid limit or port');
if(args.includes('--deploy')&&(ids.length||limit!==acceptanceCases.length))throw new Error('Deployment requires all 618 cases');
if(args.includes('--verify-report')&&(!args.includes('--resume')||args.includes('--check')||ids.length||limit!==acceptanceCases.length))throw new Error('--verify-report requires --resume, all 618 cases and no --check');
if(args.includes('--persist')||args.includes('--deploy')){const java=spawnSync('java',['-version'],{stdio:'ignore'});if(java.status!==0)throw new Error('Java is required for Firestore persistence verification. Install openjdk-21-jre-headless first.');}
const fingerprint=sourceFingerprint(),reportPath=resolve('assistant-acceptance-browser-report.json');
let report=null;
if(args.includes('--resume')&&existsSync(reportPath)){
 report=JSON.parse(readFileSync(reportPath,'utf8'));
 if(report.fingerprint!==fingerprint||JSON.stringify(report.release)!==JSON.stringify(LOCAL_RELEASE)){
  renameSync(reportPath,reportPath.replace('.json','.previous-'+Date.now()+'.json'));report=null;
  console.log('Source/model changed: old report archived, no stale passes reused.');
 }
}
report??={kind:LOCAL_REPORT_KIND,provider:'webllm',release:LOCAL_RELEASE,model:LOCAL_RELEASE.model,fingerprint,startedAt:new Date().toISOString(),results:[]};
const save=()=>{report.summary=reportSummary(report.results,acceptanceCases.length);report.updatedAt=new Date().toISOString();writeFileSync(reportPath+'.tmp',JSON.stringify(report,null,2)+'\n');renameSync(reportPath+'.tmp',reportPath);};
const failureCategory=reason=>/assistant-local-(?:inference|smoke|load)|GPU|WebGPU|disposed|device lost|GrammarMatcher|memory/i.test(reason)?'runtime':/oracle-/i.test(reason)?'oracle':/ai-|assistant-(?:invalid|reference|format|task-coverage)/i.test(reason)?'validation':'other';
const sanitize=value=>String(value??'').replace(/(Bearer\s+)[^\s]+/gi,'$1[REDACTED]').slice(0,3000);
const writeReview=()=>{
 const rows=report.results.map(r=>({...r,category:r.status==='failed'?failureCategory(r.reason):'',reason:sanitize(r.reason),expected:acceptanceCases.find(c=>c.id===r.id)?.actions??[],expectedControls:acceptanceCases.find(c=>c.id===r.id)?.controls??[]}));
 const esc=x=>'"'+String(x??'').replaceAll('"','""').replaceAll('\r',' ').replaceAll('\n',' ')+'"';
 const csv=['id,language,status,category,reason,elapsedMs,expectedActions,expectedControls,actualReply,trace',...rows.map(r=>[r.id,r.language,r.status,r.category,r.reason,r.elapsedMs,JSON.stringify(r.expected),JSON.stringify(r.expectedControls),r.reply||'',JSON.stringify(r.trace||[])].map(esc).join(','))].join('\n')+'\n';
 writeFileSync('assistant-acceptance-results.csv',csv);
 const failed=rows.filter(r=>r.status==='failed');
 const byCategory=Object.groupBy(failed,r=>r.category);
 const markdown=['# WILO local model acceptance results','','Model: '+report.model,'Runtime: '+report.release.runtime,'Fingerprint: '+report.fingerprint,'',...Object.entries(report.summary||{}).map(([k,v])=>'- '+k+': '+v),'','## Failure categories',...Object.entries(byCategory).map(([k,v])=>'- '+k+': '+v.length),'','## Failed cases',...failed.map(r=>'### '+r.id+' ('+r.language+')\\nCategory: '+r.category+'\nReason: '+r.reason+'\nExpected actions: '+JSON.stringify(r.expected)+'\nExpected controls: '+JSON.stringify(r.expectedControls)+'\nObserved: '+String(r.reply||'').slice(0,3000)+'\n')].join('\n');
 writeFileSync('assistant-acceptance-results.md',markdown);
};
let vite,http,browser,page,interrupted=false,blockedNetwork=false;
const cancel=()=>{interrupted=true;void page?.evaluate(()=>window.wiloAcceptance?.dispose()).catch(()=>{});};
process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
let complete=false;
if(args.includes('--verify-report')){
 // Allow real browser inference on Windows, then verify the identical-source
 // saved report and run Firestore/Hosting from the existing Ubuntu session.
 // This path CANNOT generate or fabricate test results.
 assertLocalAcceptance(report,acceptanceCases,fingerprint);
 complete=true;
 console.log('REAL MODEL RESULTS VERIFIED:',JSON.stringify(reportSummary(report.results,acceptanceCases.length)));
 console.log('REPORT:',reportPath);
}else{
try{
 vite=await createViteServer({configFile:false,root:process.cwd(),server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
 http=createHttpServer((req,res)=>{
  if(req.url==='/__wilo_acceptance'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
   res.end('<!doctype html><title>WILO actual local-model acceptance</title><p>Real on-device model testing. Terminal shows progress. No Firebase login or account changes.</p><script type="module" src="/tests/browser-local/driver.ts"></script>');return;
  }
  vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
 });
 await new Promise((yes,no)=>{http.once('error',no);http.listen(port,'127.0.0.1',yes);});
 const profile=resolve(option('profile',join(homedir(),'.cache','wilo-browser-acceptance')));mkdirSync(profile,{recursive:true});
 const launchArgs=['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling'];
 if(args.includes('--software'))launchArgs.push('--use-angle=swiftshader','--enable-unsafe-swiftshader');
 const executable=option('executable',process.env.TEST_CHROMIUM_PATH||'');
 browser=await chromium.launchPersistentContext(profile,{headless:!args.includes('--headed'),...(executable?{executablePath:executable}:{}),args:launchArgs,viewport:{width:1100,height:760}});
 // Block hosted inference and Firebase writes. Public model-weight downloads remain allowed.
 await browser.route('**/*',route=>{
  const host=new URL(route.request().url()).hostname;
  if(/(?:^|\.)(?:workers\.dev|googleapis\.com|firebaseio\.com|openai\.com|groq\.com|generativelanguage\.googleapis\.com)$/.test(host)){
   blockedNetwork=true;return route.abort('blockedbyclient');
  }
  return route.continue();
 });
 page=browser.pages()[0]||await browser.newPage();
 let progress=-1;
 page.on('console',message=>{const match=message.text().match(/^WILO_MODEL_PROGRESS:(\d+)/);if(match){const next=Number(match[1]);if(next===100||next>=progress+5){progress=next;console.log('Model initialization: '+next+'%');}}});
 page.on('pageerror',error=>console.error('Browser:',error.message));
 await page.goto('http://127.0.0.1:'+port+'/__wilo_acceptance');
 await page.waitForFunction(()=>!!window.wiloAcceptance,null,{timeout:30000});
 report.browser=await page.evaluate(()=>window.wiloAcceptance.preflight());
 report.browser.softwareRequested=args.includes('--software');save();
 if(!report.browser.secure||!report.browser.adapter)throw new Error('webgpu-unavailable: use a compatible GPU/browser; no cloud fallback was used');
 if(!report.browser.shaderF16)throw new Error('webgpu-shader-f16-unavailable: the shipped model cannot run on this adapter');
 console.log('MODEL:',LOCAL_RELEASE.model,'RUNTIME:',LOCAL_RELEASE.runtime,'RELEASE:',LOCAL_RELEASE.version);
 if(args.includes('--check')){console.log(JSON.stringify(report.browser));}
 else{
  await page.evaluate(()=>window.wiloAcceptance.load());
  // Validate a genuine model completion before spending time on any corpus case.
  // This never counts as a pass for any of the 618.
  const smoke=await page.evaluate(()=>window.wiloAcceptance.smoke());
  report.smoke={status:'passed',elapsedMs:smoke.elapsedMs,at:new Date().toISOString()};
  console.log('LOCAL INFERENCE SMOKE PASS:',smoke.elapsedMs+'ms');
  save();
  if(args.includes('--smoke')){console.log('SMOKE ONLY: no acceptance cases executed.');}
  else{
  const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
  const priority=id=>id.startsWith('compound-card-')?0:id.startsWith('section-card-')?1:id.startsWith('new-course-lesson-')?2:3;
  const ordered=[...selected].sort((a,b)=>priority(a.id)-priority(b.id));
  let attempted=0;
  for(const testCase of ordered){
   if(interrupted)break;
   if(report.results.some(r=>r.id===testCase.id&&r.status==='passed'))continue;
   if(attempted++>=limit)break;
   console.log('RUN',testCase.id);
   // The browser receives ONLY the user request and synthetic account, never the oracle.
   const result=await page.evaluate(request=>window.wiloAcceptance.answer(request),{message:testCase.message,context:JSON.stringify(acceptanceContext(testCase.id)),language:testCase.language,history:[]});
   if(interrupted)break;
   const item={id:testCase.id,language:testCase.language,status:'passed',elapsedMs:result.elapsedMs,reply:result.text,trace:result.trace};
   try{if(blockedNetwork)throw new Error('unexpected-hosted-service-request');if(result.error)throw new Error(result.error);evaluateAcceptance(testCase,result.text);}
   catch(error){item.status='failed';item.reason=error.message;}
   report.results=report.results.filter(r=>r.id!==testCase.id);report.results.push(item);save();
   console.log(`${report.results.length}/${acceptanceCases.length} ${item.id}: ${item.status}${item.reason?' ['+item.reason+']':''} (${item.elapsedMs}ms)`);
   // A runtime/worker/GPU failure invalidates further inference until recovered.
   // Keep the diagnostic and stop; do not turn one crash into 618 fake model failures.
   if(result.error){console.error('STOP: first local-model runtime failure:',result.error);break;}
  }
  report.interrupted=interrupted;save();
  try{assertLocalAcceptance(report,acceptanceCases,fingerprint);complete=!interrupted;}catch{complete=false;}
  console.log(JSON.stringify(report.summary));console.log('REPORT:',reportPath);
  if(!complete)process.exitCode=2;
  }
 }
}catch(error){report.stopped=error.message;save();console.error('STOP:',error.message);console.error('No inference from another model/provider and no deployment performed.');process.exitCode=2;}
finally{writeReview();await browser?.close().catch(()=>{});await vite?.close();await new Promise(r=>http?.listening?http.close(r):r());}
}

// Replay EXACT saved model outputs through the production repository and real emulator rules.
if(complete&&(args.includes('--persist')||args.includes('--deploy'))){
 const cli=resolve('node_modules/firebase-tools/lib/bin/firebase.js');
 const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const command=['env','TEST_SUITE=security','ASSISTANT_LIVE_REPORT='+reportPath,process.execPath,resolve('node_modules/vitest/vitest.mjs'),'run','tests/assistantCorpusSecurity.test.ts'].map(quote).join(' ');
 const result=spawnSync(process.execPath,[cli,'emulators:exec','--project','demo-assistant-corpus','--only','firestore',command],{stdio:'inherit',env:{...process.env}});
 if(result.status===0){report.persistence={status:'passed',cases:acceptanceCases.length,evidenceHash:inferenceEvidenceHash(report),checkedAt:new Date().toISOString()};save();}
 else{report.persistence={status:'failed'};save();complete=false;process.exitCode=result.status||2;}
}
if(complete&&args.includes('--deploy')){
 const result=spawnSync(process.execPath,['scripts/deploy-local-release.mjs'],{stdio:'inherit'});process.exitCode=result.status||0;
}
