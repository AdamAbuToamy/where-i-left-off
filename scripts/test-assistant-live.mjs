import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createServer as createNetServer} from 'node:net';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
import {assistantSample} from './lib/assistantSample.mjs';
import {syntheticProviderDiagnostic} from './lib/providerDiagnostic.mjs';
import {acceptanceSummary,providerStop} from './lib/assistantAcceptance.mjs';
import {blockedProviderCodes} from '../push-worker/src/assistantErrors.mjs';
import {ASSISTANT_MODEL} from '../push-worker/src/assistant.mjs';
import {runAcceptanceCase} from '../tests/fixtures/assistant/runCase.mjs';
import {assistantProvider,GROQ_MODEL,GEMINI_MODEL} from '../push-worker/src/assistantProvider.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2),provider=args.find(a=>a.startsWith('--provider='))?.split('=')[1]||'cloudflare';
const settings={cloudflare:{model:ASSISTANT_MODEL},groq:{model:GROQ_MODEL,key:'GROQ_API_KEY',label:'Groq'},gemini:{model:GEMINI_MODEL,key:'GEMINI_API_KEY',label:'Gemini'}}[provider];
if(!settings)throw new Error('Unknown provider.');
const model=settings.model,requestedIds=args.filter(a=>a.startsWith('--case=')).map(a=>a.slice(7));
if(requestedIds.some(id=>!acceptanceCases.some(c=>c.id===id)))throw new Error('Unknown case ID. Use --list to see the case catalog.');
const sampleArg=args.find(a=>a.startsWith('--sample='));
if(sampleArg&&requestedIds.length)throw new Error('Use either --sample or --case.');
const selected=sampleArg?assistantSample(acceptanceCases,Number(sampleArg.slice(9))):requestedIds.length?acceptanceCases.filter(c=>requestedIds.includes(c.id)):acceptanceCases;
const limitArg=args.find(a=>a.startsWith('--limit=')),limit=limitArg?Number(limitArg.split('=')[1]):selected.length;
if(args.includes('--list')){console.log(JSON.stringify({requests:selected.length,total:acceptanceCases.length,cases:selected.map(c=>c.id),unique:new Set(selected.map(c=>c.message)).size,languages:['ar','en','he'],provider,model,mode:'catalog-only; no inference'},null,2));process.exit(0);}
if(!args.includes('--live')||!Number.isInteger(limit)||limit<1||limit>acceptanceCases.length)throw new Error('Use --live --limit=618 (or --list). Real inference consumes the selected provider allowance.');
const fingerprint=createHash('sha256').update(provider).update(readFileSync('scripts/test-assistant-live.mjs')).update(readFileSync('tests/fixtures/assistant/runCase.mjs')).update(readFileSync('push-worker/src/assistantProvider.mjs')).update(readFileSync('push-worker/src/assistantGemini.mjs')).update(readFileSync('push-worker/src/assistantTools.mjs')).update(readFileSync('push-worker/src/assistantContext.mjs')).update(readFileSync('tests/fixtures/assistant/corpus.mjs')).update(readFileSync('push-worker/src/assistantContract.mjs')).update(readFileSync('push-worker/src/groqLimits.mjs')).update(JSON.stringify(acceptanceCases)).update(readFileSync('push-worker/src/assistant.mjs')).update(readFileSync('push-worker/src/assistantIntents.mjs')).update(readFileSync('tests/fixtures/assistant/oracle.ts')).digest('hex');
const reportPath=resolve('assistant-acceptance-live-report.json');let old=args.includes('--resume')&&existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
if(old&&(old.model!==model||old.provider!==provider||old.fingerprint!==fingerprint)){writeFileSync(reportPath.replace('.json','.previous-'+Date.now()+'.json'),JSON.stringify(old,null,2)+'\n');old=null;console.log('Previous report archived; starting the updated suite.');}
const report=old||{model,fingerprint,provider,kind:'live-provider-synthetic-data',startedAt:new Date().toISOString(),results:[]};
const save=()=>{report.summary=acceptanceSummary(report.results,acceptanceCases.length);report.updatedAt=new Date().toISOString();writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');};
const cancellation=new AbortController();process.once('SIGINT',()=>cancellation.abort());process.once('SIGTERM',()=>cancellation.abort());
const folder=mkdtempSync(join(tmpdir(),'wilo-ai-live-')),token=randomUUID();let child,vite;
try{
 if(settings.key&&!process.env[settings.key]?.trim())throw new Error(provider+'-key-required');
 let executeCase;
 if(settings.key){
  const inference=assistantProvider({ASSISTANT_PROVIDER:provider,[settings.key]:process.env[settings.key]},{signal:cancellation.signal,onSyntheticDiagnostic:diagnostic=>console.error('synthetic-provider-diagnostic',JSON.stringify(syntheticProviderDiagnostic(diagnostic,process.env[settings.key])))});
  executeCase=testCase=>runAcceptanceCase(testCase,inference);
  console.log(settings.label+' transport: direct Node HTTPS; no local Worker or secret file.');
 }else{
 const cli=resolve('push-worker/node_modules/wrangler/bin/wrangler.js');if(!existsSync(cli))throw new Error('Install push-worker dependencies first.');
 const identity=spawnSync(process.execPath,[cli,'whoami'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},timeout:15000});
 if(/not authenticated|wrangler login/i.test((identity.stdout||'')+(identity.stderr||'')))throw new Error('cloudflare-authentication-required');
 if(identity.status!==0)throw new Error('cloudflare-authentication-check-failed');
 const server=createNetServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});const port=server.address().port;await new Promise(yes=>server.close(yes));
 const config=join(folder,'wrangler.json');
 writeFileSync(config,JSON.stringify({name:'wilo-local-ai-acceptance',main:resolve('tests/fixtures/assistant/live-worker.mjs'),compatibility_date:'2026-10-23',ai:{binding:'AI',remote:true},vars:{TEST_TOKEN:token}}));
 const childEnv={...process.env,WRANGLER_SEND_METRICS:'false'};delete childEnv.GROQ_API_KEY;delete childEnv.GEMINI_API_KEY;
 child=spawn(process.execPath,[cli,'dev','--config',config,'--ip','127.0.0.1','--port',String(port),'--show-interactive-dev-session=false'],{stdio:['ignore','pipe','pipe'],env:childEnv});
 let diagnostics='';for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{diagnostics=(diagnostics+d).slice(-6000);});
 const origin=`http://127.0.0.1:${port}`,deadline=Date.now()+30000;
 while(true){
  cancellation.signal.throwIfAborted();
  if(child.exitCode!==null||child.signalCode!==null)throw new Error(/auth|log.?in|CLOUDFLARE_API_TOKEN/i.test(diagnostics)?'cloudflare-authentication-required':'live-worker-startup-failed');
  try{await fetch(origin,{signal:AbortSignal.timeout(500)});break;}catch{if(Date.now()>deadline)throw new Error('live-worker-startup-timeout');await new Promise(r=>setTimeout(r,250));}
 }
 executeCase=async testCase=>{const response=await fetch(origin,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({id:testCase.id}),signal:AbortSignal.any([cancellation.signal,AbortSignal.timeout(120000)])});return response.json();};
 }
 const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 let attempted=0,consecutiveUnavailable=0;
 // Diagnose the reported compound-card failure before spending quota on the larger matrix.
 const priority=id=>id.startsWith('compound-card')?0:id.startsWith('new-course-lesson')?1:id.startsWith('ten-cards')?2:3;
 const ordered=[...selected].sort((a,b)=>priority(a.id)-priority(b.id));
 for(const testCase of ordered){
  if(report.results.some(r=>r.id===testCase.id&&r.status==='passed'))continue;if(attempted++>=limit)break;
  cancellation.signal.throwIfAborted();
  const result=await executeCase(testCase);cancellation.signal.throwIfAborted();
  if(blockedProviderCodes.has(result.error)){
   const item={id:testCase.id,status:'blocked',reason:result.error,elapsedMs:result.elapsedMs,trace:result.trace,details:result.details};
   report.results=report.results.filter(r=>r.id!==testCase.id);report.results.push(item);save();
   consecutiveUnavailable++;
   console.log(`${testCase.id}: blocked (${result.error})`,JSON.stringify(result.trace?.at(-1)?.providerFailure||{}));
   if(providerStop(result.error,consecutiveUnavailable)){report.stopped=result.error;save();process.exitCode=2;break;}
   continue;
  }
  consecutiveUnavailable=0;
  const item={id:testCase.id,status:'passed',elapsedMs:result.elapsedMs,trace:result.trace,reply:result.text};
  try{if(result.error){if(settings.key)console.error('synthetic-case-trace',JSON.stringify(syntheticProviderDiagnostic({status:0,body:JSON.stringify(result.trace)},process.env[settings.key])));throw new Error(result.error);}evaluateAcceptance(testCase,result.text);}catch(error){item.status='failed';item.reason=error.message;item.details=result.details;if(result.text&&settings.key)console.error('synthetic-plan-rejected',JSON.stringify(syntheticProviderDiagnostic({status:200,body:result.text},process.env[settings.key])));}
  report.results=report.results.filter(r=>r.id!==testCase.id);report.results.push(item);save();
  console.log(`${report.results.length}/${acceptanceCases.length} ${testCase.id}: ${item.status}${item.reason?' ['+item.reason+']':''} (${result.elapsedMs}ms)`);
  if(item.status==='failed'&&args.includes('--stop-on-failure')){report.stopped='case-failed';save();process.exitCode=2;break;}
 }
 report.selection={ids:selected.map(c=>c.id),summary:acceptanceSummary(report.results.filter(r=>selected.some(c=>c.id===r.id)),selected.length)};
 save();if(report.selection.summary.failed||report.selection.summary.blocked||report.selection.summary.notRun)process.exitCode=2;
 console.log(JSON.stringify(report.summary));
}catch(error){report.stopped=cancellation.signal.aborted?'interrupted':/^cloudflare-|^live-worker-|^(groq|gemini)-key-required$/.test(error.message)?error.message:'local-harness-unavailable';save();console.error(report.stopped);process.exitCode=cancellation.signal.aborted?130:2;}
finally{await vite?.close();child?.kill('SIGTERM');rmSync(folder,{recursive:true,force:true});}
