import {readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {sourceFingerprint,reportSummary,LOCAL_REPORT_KIND} from './lib/localReleaseGate.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2),basic=args.includes('--basic'),resume=args.includes('--resume');
const library=process.env.WILO_WINDOWS_PLAYWRIGHT||join(homedir(),'wilo-windows-test','node_modules','playwright','index.mjs');
const {chromium}=await import(pathToFileURL(library));
const origin='http://127.0.0.1:8177',corpus=await (await fetch(origin+'/__cases')).json();
const basicIds=['update-projects-name-ar','compound-card-ar','delete-projects-ar','new-course-lesson-ar','control-theme-ar','control-language-ar'];
const cases=basic?corpus.cases.filter(c=>basicIds.includes(c.id)):corpus.cases;
if(basic&&cases.length!==6)throw new Error('basic-case-selection');
const fingerprint=sourceFingerprint(),path=resolve('assistant-acceptance-browser-report.json');
let report=resume&&existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
if(report&&(report.fingerprint!==fingerprint||JSON.stringify(report.release)!==JSON.stringify(LOCAL_RELEASE))){renameSync(path,path.replace('.json','.previous-'+Date.now()+'.json'));report=null;}
report??={kind:LOCAL_REPORT_KIND,provider:'webllm',release:LOCAL_RELEASE,model:LOCAL_RELEASE.model,fingerprint,startedAt:new Date().toISOString(),results:[]};
const save=()=>{
 report.summary=reportSummary(report.results,618);report.updatedAt=new Date().toISOString();
 writeFileSync(path+'.tmp',JSON.stringify(report,null,2));renameSync(path+'.tmp',path);
 const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
 writeFileSync('assistant-acceptance-results.csv',['id,status,reason,elapsedMs,reply',...report.results.map(r=>[r.id,r.status,r.reason,r.elapsedMs,r.reply].map(quote).join(','))].join('\n'));
};
let browser,page,stop=false;process.on('SIGINT',()=>{stop=true;void page?.evaluate(()=>window.wiloAcceptance.dispose()).catch(()=>{});});
try{
 browser=await chromium.launchPersistentContext(join(homedir(),'.cache','wilo-browser-acceptance'),{headless:true,channel:'chrome',args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--use-angle=d3d11','--force-high-performance-gpu']});
 let blocked=false;
 await browser.route('**/*',route=>{const host=new URL(route.request().url()).hostname;if(/(?:workers\.dev|googleapis\.com|firebaseio\.com|openai\.com|groq\.com|api\.z\.ai)$/.test(host)){blocked=true;return route.abort();}return route.continue();});
 page=browser.pages()[0]||await browser.newPage();
 page.on('console',m=>{if(m.text().startsWith('WILO_MODEL_PROGRESS:'))console.log(m.text());});
 await page.goto(origin+'/__model');await page.waitForFunction(()=>!!window.wiloAcceptance);
 const release=await page.evaluate(()=>window.wiloAcceptance.release);if(JSON.stringify(release)!==JSON.stringify(LOCAL_RELEASE))throw new Error('browser-model-mismatch');
 report.browser=await page.evaluate(()=>window.wiloAcceptance.preflight());save();
 console.log('MODEL',LOCAL_RELEASE.model,'GPU',JSON.stringify(report.browser.info));
 await page.evaluate(()=>window.wiloAcceptance.load());const smoke=await page.evaluate(()=>window.wiloAcceptance.smoke());report.smoke={status:'passed',elapsedMs:smoke.elapsedMs};save();
 let runtimeFailures=0,consecutiveFailures=0;
 for(const c of cases){
  if(stop)break;
  if(report.results.some(r=>r.id===c.id&&(!args.includes('--retry-failed')||r.status==='passed')))continue;
  if(sourceFingerprint()!==fingerprint)throw new Error('source-changed: finish this run before editing tested source');
  console.log('RUN',c.id);
  const r=await page.evaluate(c=>window.wiloAcceptance.answer({...c,history:[]}),c);
  let verdict;if(blocked)throw new Error('unexpected-hosted-request');
  if(r.error)verdict={status:/assistant-local-(?:timeout|inference|load|not-ready)/.test(r.error)?'blocked':'failed',reason:r.error};
  else{const response=await fetch(origin+'/__evaluate',{method:'POST',body:JSON.stringify({id:c.id,reply:r.text})});if(!response.ok)throw new Error('oracle-unavailable');verdict=await response.json();}
  report.results=report.results.filter(item=>item.id!==c.id);report.results.push({id:c.id,language:c.language,...verdict,elapsedMs:r.elapsedMs,reply:r.text,trace:r.trace});save();
  console.log(report.results.length+'/618',c.id,verdict.status,verdict.reason||'',r.elapsedMs+'ms');
  consecutiveFailures=verdict.status==='passed'?0:consecutiveFailures+1;
  if(consecutiveFailures>=5&&!args.includes('--keep-going')){report.stopped='five-consecutive-failures';console.log('STOP: five consecutive failures; inspect the report before continuing. Use --keep-going only for an intentional full diagnostic run.');break;}
  if(verdict.status==='blocked'){
   if(++runtimeFailures>=3){report.stopped='repeated-runtime-failure';break;}
   await page.evaluate(async()=>{window.wiloAcceptance.dispose();await window.wiloAcceptance.load();await window.wiloAcceptance.smoke();});
  }else runtimeFailures=0;
 }
 report.interrupted=stop;save();console.log('SUMMARY',JSON.stringify(report.summary));console.log('REPORT',path);
}catch(e){report.stopped=e.message;save();console.error('STOP',e.message);process.exitCode=2;}
finally{await browser?.close();}