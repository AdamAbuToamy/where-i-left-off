import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createServer as createNetServer} from 'node:net';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
import {ASSISTANT_MODEL} from '../push-worker/src/assistant.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2),limitArg=args.find(a=>a.startsWith('--limit=')),limit=limitArg?Number(limitArg.split('=')[1]):acceptanceCases.length;
if(args.includes('--list')){console.log(JSON.stringify({requests:acceptanceCases.length,unique:new Set(acceptanceCases.map(c=>c.message)).size,languages:['ar','en','he'],model:ASSISTANT_MODEL,mode:'catalog-only; no inference'},null,2));process.exit(0);}
if(!args.includes('--live')||!Number.isInteger(limit)||limit<1||limit>acceptanceCases.length)throw new Error('Use --live --limit=618 (or --list). Real inference consumes the existing Cloudflare allowance.');
const fingerprint=createHash('sha256').update(JSON.stringify(acceptanceCases)).update(readFileSync('push-worker/src/assistant.mjs')).update(readFileSync('push-worker/src/assistantIntents.mjs')).update(readFileSync('tests/fixtures/assistant/oracle.ts')).digest('hex');
const reportPath=resolve('assistant-acceptance-live-report.json'),old=args.includes('--resume')&&existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
if(old&&(old.model!==ASSISTANT_MODEL||old.fingerprint!==fingerprint))throw new Error('Resume suite/model mismatch. Move the old report before testing a different model.');
const report=old||{model:ASSISTANT_MODEL,fingerprint,kind:'live-provider-synthetic-data',startedAt:new Date().toISOString(),results:[]};
const save=()=>{const done=report.results.filter(r=>r.status==='passed');report.summary={passed:done.length,failed:report.results.filter(r=>r.status==='failed').length,notRun:acceptanceCases.length-new Set(report.results.map(r=>r.id)).size,slowOver20s:done.filter(r=>r.elapsedMs>20000).length};report.updatedAt=new Date().toISOString();writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');};
const cancellation=new AbortController();process.once('SIGINT',()=>cancellation.abort());process.once('SIGTERM',()=>cancellation.abort());
const folder=mkdtempSync(join(tmpdir(),'wilo-ai-live-')),token=randomUUID();let child,vite;
try{
 const cli=resolve('push-worker/node_modules/wrangler/bin/wrangler.js');if(!existsSync(cli))throw new Error('Install push-worker dependencies first.');
 const identity=spawnSync(process.execPath,[cli,'whoami'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},timeout:15000});
 if(/not authenticated|wrangler login/i.test((identity.stdout||'')+(identity.stderr||'')))throw new Error('cloudflare-authentication-required');
 if(identity.status!==0)throw new Error('cloudflare-authentication-check-failed');
 const server=createNetServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});const port=server.address().port;await new Promise(yes=>server.close(yes));
 const config=join(folder,'wrangler.json');
 writeFileSync(config,JSON.stringify({name:'wilo-local-ai-acceptance',main:resolve('tests/fixtures/assistant/live-worker.mjs'),compatibility_date:'2026-10-23',ai:{binding:'AI',remote:true},vars:{TEST_TOKEN:token}}));
 child=spawn(process.execPath,[cli,'dev','--config',config,'--ip','127.0.0.1','--port',String(port),'--show-interactive-dev-session=false'],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 let diagnostics='';for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{diagnostics=(diagnostics+d).slice(-6000);});
 const origin=`http://127.0.0.1:${port}`,deadline=Date.now()+30000;
 while(true){
  cancellation.signal.throwIfAborted();
  if(child.exitCode!==null||child.signalCode!==null)throw new Error(/auth|log.?in|CLOUDFLARE_API_TOKEN/i.test(diagnostics)?'cloudflare-authentication-required':'live-worker-startup-failed');
  try{await fetch(origin,{signal:AbortSignal.timeout(500)});break;}catch{if(Date.now()>deadline)throw new Error('live-worker-startup-timeout');await new Promise(r=>setTimeout(r,250));}
 }
 const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 let attempted=0;
 for(const testCase of acceptanceCases){
  if(report.results.some(r=>r.id===testCase.id&&r.status==='passed'))continue;if(attempted++>=limit)break;
  const response=await fetch(origin,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({id:testCase.id}),signal:AbortSignal.any([cancellation.signal,AbortSignal.timeout(120000)])}),result=await response.json();
  if(result.error==='ai-provider-limit'){report.stopped='provider-free-quota';save();console.log('Stopped at provider quota; no upgrade or paid fallback. Resume after quota resets.');process.exitCode=2;break;}
  const item={id:testCase.id,status:'passed',elapsedMs:result.elapsedMs,trace:result.trace};
  try{if(result.error)throw new Error(result.error);evaluateAcceptance(testCase,result.text);}catch(error){item.status='failed';item.reason=error.message;item.details=result.details;}
  report.results=report.results.filter(r=>r.id!==testCase.id);report.results.push(item);save();
  console.log(`${report.results.length}/${acceptanceCases.length} ${testCase.id}: ${item.status} (${result.elapsedMs}ms)`);
 }
 save();if(report.summary.failed||report.summary.notRun)process.exitCode=2;
 console.log(JSON.stringify(report.summary));
}catch(error){report.stopped=cancellation.signal.aborted?'interrupted':/^cloudflare-|^live-worker-/.test(error.message)?error.message:'local-harness-unavailable';save();console.error(report.stopped);process.exitCode=cancellation.signal.aborted?130:2;}
finally{await vite?.close();child?.kill('SIGTERM');rmSync(folder,{recursive:true,force:true});}
