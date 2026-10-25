#!/usr/bin/env node
import {existsSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
import {runAcceptanceCase} from '../tests/fixtures/assistant/runCase.mjs';
import {OllamaAcceptanceProvider} from './lib/ollamaAcceptance.mjs';
import {assistantSample} from './lib/assistantSample.mjs';
import {acceptanceSummary} from './lib/assistantAcceptance.mjs';
import {blockedProviderCodes} from '../push-worker/src/assistantErrors.mjs';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2);
const value=key=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3);
const model=value('model')||'qwen3:4b';
const selectedIds=args.filter(a=>a.startsWith('--case=')).map(a=>a.slice(7));
const sample=value('sample')===undefined?undefined:Number(value('sample'));
if(sample!==undefined&&selectedIds.length)throw new Error('Choose --sample or --case');
const selected=selectedIds.length?acceptanceCases.filter(c=>selectedIds.includes(c.id)):sample===undefined?acceptanceCases:assistantSample(acceptanceCases,sample);
if(selectedIds.some(id=>!selected.some(c=>c.id===id)))throw new Error('Unknown case ID');
const limit=value('limit')===undefined?selected.length:Number(value('limit'));
if(!Number.isInteger(limit)||limit<1||limit>selected.length)throw new Error('Invalid --limit; use 1..'+selected.length);
if(args.includes('--list')){console.log(JSON.stringify({count:acceptanceCases.length,cases:acceptanceCases.map(c=>c.id)},null,2));process.exit(0);}
const provider=new OllamaAcceptanceProvider({model});
const fingerprint=createHash('sha256');
for(const path of [
 'scripts/test-assistant-ollama.mjs','scripts/lib/ollamaAcceptance.mjs','tests/fixtures/assistant/runCase.mjs',
 'tests/fixtures/assistant/corpus.mjs','tests/fixtures/assistant/oracle.ts',
 'push-worker/src/assistant.mjs','push-worker/src/assistantTools.mjs',
 'push-worker/src/assistantContext.mjs','push-worker/src/assistantContract.mjs',
 'shared/assistantDialogue.mjs','push-worker/src/assistantIntents.mjs',
])fingerprint.update(readFileSync(path));
const suiteFingerprint=fingerprint.digest('hex');
const reportPath=resolve('assistant-acceptance-ollama-'+model.replace(/[^a-zA-Z0-9-]/g,'-')+'.json');
let prior=null;
if(args.includes('--resume')&&existsSync(reportPath)){
 try{prior=JSON.parse(readFileSync(reportPath,'utf8'));}catch{throw new Error('Existing report invalid; back up before retrying.');}
 if(prior.fingerprint!==suiteFingerprint||prior.model!==model){
  renameSync(reportPath,reportPath.replace('.json','.previous-'+Date.now()+'.json'));
  prior=null;console.log('Suite changed: previous report archived.');
 }
}
const report=prior||{model,provider:'ollama',kind:'real-local-llm-with-synthetic-account',fingerprint:suiteFingerprint,startedAt:new Date().toISOString(),results:[]};
function save(){
 report.summary=acceptanceSummary(report.results,acceptanceCases.length);
 report.updatedAt=new Date().toISOString();
 const temp=reportPath+'.tmp';
 writeFileSync(temp,JSON.stringify(report,null,2)+'\n');
 renameSync(temp,reportPath);
}
const aborter=new AbortController();
for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>aborter.abort());
let vite;
try{
 const ready=await provider.ready();
 console.log('LOCAL inference:,ready.model,'on',ready.endpoint,'(no Cloudflare or API key)');
 const {createServer}=await import('vite');
 vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 const priority=id=>id.startsWith('compound-card')?0:id.startsWith('new-course-lesson')?1:id.startsWith('ten-cards')?2:3;
 const ordered=[...selected].sort((a,b)=>priority(a.id)-priority(b.id));
 let attempted=0,stoppedForError=false;
 for(const testCase of ordered){
  if(aborter.signal.aborted)break;
  if(report.results.some(r=>r.id===testCase.id&&r.status==='passed'))continue;
  if(attempted>=limit)break;
  attempted++;
  const result=await runAcceptanceCase(testCase,provider);
  if(aborter.signal.aborted)break;
  const item={id:testCase.id,language:testCase.language,status:'passed',elapsedMs:result.elapsedMs,trace:result.trace,reply:result.text};
  try{
   if(result.error)throw new Error(result.error);
   evaluateAcceptance(testCase,result.text);
  }catch(error){
   item.status=blockedProviderCodes.has(result.error)?'blocked':'failed';
   item.reason=error.message;
   item.details=result.details;
  }
  report.results=report.results.filter(r=>r.id!==testCase.id);
  report.results.push(item);save();
  const progress=report.results.filter(r=>r.status==='passed').length;
  console.log('['+attempted+'/'+limit+'] '+testCase.id+': '+item.status+(item.reason?' ['+item.reason+']':'')+' ('+result.elapsedMs+'ms) | total passed='+progress);
  if(item.status==='blocked'||(item.status==='failed'&&args.includes('--stop-on-failure'))){
   stoppedForError=true;break;
  }
 }
 const chosen=new Set(selected.map(c=>c.id));
 const counted=report.results.filter(r=>chosen.has(r.id));
 report.selection={requested:limit,passed:counted.filter(r=>r.status==='passed').length,failed:counted.filter(r=>r.status==='failed').length,blocked:counted.filter(r=>r.status==='blocked').length,notRun:selected.length-counted.length};
 report.stopped=aborter.signal.aborted?'interrupted':stoppedForError?'error':undefined;
 save();
 const reportBase=reportPath.slice(0,-5);
 const failed=report.results.filter(item=>item.status!=='passed');
 const categorise=reason=>/^ollama-|harness-failed|timeout|connection|memory|device lost/i.test(reason||'')?'runtime':/^oracle-/.test(reason||'')?'oracle':/format|incomplete/.test(reason||'')?'format':'validation';
 const header=['id','language','status','category','reason','elapsedMs','expectedActions','expectedControls','reply','trace'];
 const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const rows=report.results.map(item=>{
  const expected=acceptanceCases.find(entry=>entry.id===item.id);
  return [item.id,item.language,item.status,item.status==='passed'?'':categorise(item.reason),item.reason,item.elapsedMs,JSON.stringify(expected?.actions||[]),JSON.stringify(expected?.controls||[]),item.reply||'',JSON.stringify(item.trace||[])].map(quote).join(',');
 });
 writeFileSync(reportBase+'.csv','\\uFEFF'+[header.join(','),...rows].join('\\r\\n')+'\\r\\n');
 writeFileSync(reportBase+'.md',['# Local WILO acceptance report','','Model: '+model,'Source fingerprint: '+suiteFingerprint,'',...Object.entries(report.summary).map(([key,v])=>'- '+key+': '+v),'','## Failures',...failed.flatMap(item=>['### '+item.id,'Reason: '+(item.reason||item.status),'Category: '+categorise(item.reason),'Trace: '+JSON.stringify(item.trace||[]).slice(0,5000),''])].join('\\n'));
 console.log('REPORT:',reportPath,reportBase+'.csv',reportBase+'.md');
 console.log(JSON.stringify(report.selection));
 if(report.selection.failed||report.selection.blocked||report.stopped||(!selectedIds.length&&limit===selected.length&&report.selection.notRun))process.exitCode=2;
}catch(error){
 report.stopped=aborter.signal.aborted?'interrupted':error.message;
 save();
 console.error(error.message);
 console.error('If Ollama is missing: install from https://ollama.com/download/linux, run ollama pull '+model+', and ensure ollama serve is available.');
 process.exitCode=2;
}finally{await vite?.close();}
