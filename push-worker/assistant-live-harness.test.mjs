import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,cpSync,writeFileSync,readFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {safeProviderFailure} from './src/assistantErrors.mjs';
import {runAcceptanceCase} from '../tests/fixtures/assistant/runCase.mjs';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
test('provider diagnostics allow only fixed labels, never raw upstream messages, parameters, keys or headers',()=>{
 const malicious={status:400,providerCode:'test-only-secret',providerParameter:'test-only-secret',message:'test-only-secret',cause:{code:'test-only-secret'}};
 assert.deepEqual(safeProviderFailure(malicious),{status:400,code:'unclassified',parameter:'',network:''});
 assert.deepEqual(safeProviderFailure({status:400,providerCode:'json_validate_failed',providerParameter:'response_format'}),{status:400,code:'json_validate_failed',parameter:'response_format',network:''});
 assert.equal(safeProviderFailure({cause:{code:'ECONNRESET'}}).network,'ECONNRESET');
});
test('shared case runner records the failing inference stage and safe HTTP diagnosis',async()=>{
 const result=await runAcceptanceCase(acceptanceCases[0],{name:'groq',model:'test',run:async()=>{const error=new Error('private payload');error.status=400;error.providerCode='json_validate_failed';throw error;}});
 assert.equal(result.error,'ai-provider-request');assert.equal(result.trace[0].stage,'inventory');assert.equal(result.trace[0].providerFailure.status,400);assert.equal(result.trace[0].providerFailure.code,'json_validate_failed');assert.equal(JSON.stringify(result).includes('private payload'),false);
});
for(const provider of ['groq','gemini'])test(`${provider} CLI tests three compound cases without Wrangler or a secret file`,()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),folder=mkdtempSync(join(tmpdir(),'wilo-direct-cli-'));
 try{
  for(const dir of ['scripts/lib','tests/fixtures','push-worker'])mkdirSync(join(folder,dir),{recursive:true});
  copyFileSync(join(root,'scripts/test-assistant-live.mjs'),join(folder,'scripts/test-assistant-live.mjs'));
  copyFileSync(join(root,'scripts/lib/assistantAcceptance.mjs'),join(folder,'scripts/lib/assistantAcceptance.mjs'));
  cpSync(join(root,'tests/fixtures/assistant'),join(folder,'tests/fixtures/assistant'),{recursive:true});cpSync(join(root,'src'),join(folder,'src'),{recursive:true});cpSync(join(root,'push-worker/src'),join(folder,'push-worker/src'),{recursive:true});
  symlinkSync(join(root,'node_modules'),join(folder,'node_modules'),'dir');writeFileSync(join(folder,'package.json'),'{"type":"module"}');
  const preload=join(folder,'mock-http.mjs');
  writeFileSync(preload,`import {acceptanceCases} from './tests/fixtures/assistant/corpus.mjs';\nglobalThis.fetch=async(url,options)=>{if(url!=='${provider==='groq'?'https://api.groq.com/openai/v1/chat/completions':'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'}')throw new Error('unexpected-network');const body=JSON.parse(options.body),content=body.messages.find(m=>m.role==='user').content,c=acceptanceCases.filter(c=>c.id.startsWith('compound-card-')).find(c=>content.includes(c.message));if(!c)throw new Error('original-request-missing');if(!body.tools||body.response_format)throw new Error('expected-native-tools');const reply={text:'Review',actions:c.actions,controls:[],files:[],tasks:c.intents.map(i=>({title:i.title,outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}))};return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(reply)}}]}}]});};`);
  const result=spawnSync(process.execPath,['--import',preload,join(folder,'scripts/test-assistant-live.mjs'),'--live','--provider='+provider,'--limit=3','--case=compound-card-ar','--case=compound-card-en','--case=compound-card-he'],{cwd:folder,encoding:'utf8',timeout:30000,env:{...process.env,GROQ_API_KEY:'test-only-secret',GEMINI_API_KEY:'test-only-secret'}});
  assert.equal(result.status,0,result.stdout+result.stderr);const report=JSON.parse(readFileSync(join(folder,'assistant-acceptance-live-report.json'),'utf8'));
  assert.equal(report.summary.passed,3,result.stdout+result.stderr);assert.equal(report.selection.summary.notRun,0);assert.equal(report.summary.notRun,acceptanceCases.length-3);assert.equal(report.provider,provider);assert.equal(report.summary.failed,0);assert.equal(report.summary.blocked,0);
  assert.equal(report.results.every(r=>r.trace.length===1&&r.trace[0].stage==='tool-plan'),true);assert.equal((result.stdout+result.stderr+JSON.stringify(report)).includes('test-only-secret'),false);assert.equal(existsSync(join(folder,'push-worker/node_modules/wrangler')),false);
  if(provider==='gemini'){
   const broken=join(folder,'broken-http.mjs');writeFileSync(broken,`import './mock-http.mjs';const real=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await real(...args),body=await r.json(),f=body.choices[0].message.tool_calls[0].function,plan=JSON.parse(f.arguments);plan.actions[0].values.description='WRONG NOTE';f.arguments=JSON.stringify(plan);return Response.json(body);};`);
   const stopped=spawnSync(process.execPath,['--import',broken,join(folder,'scripts/test-assistant-live.mjs'),'--live','--provider=gemini','--case=compound-card-ar','--case=compound-card-en','--case=compound-card-he','--stop-on-failure'],{cwd:folder,encoding:'utf8',timeout:10000,env:{...process.env,GEMINI_API_KEY:'test-only-secret'}});
   assert.equal(stopped.status,2);const failure=JSON.parse(readFileSync(join(folder,'assistant-acceptance-live-report.json'),'utf8'));assert.equal(failure.stopped,'case-failed');assert.equal(failure.results.length,1);assert.equal(failure.results[0].status,'failed');
   const missing=spawnSync(process.execPath,[join(folder,'scripts/test-assistant-live.mjs'),'--live','--provider=gemini','--case=compound-card-ar'],{cwd:folder,encoding:'utf8',timeout:10000,env:{...process.env,GEMINI_API_KEY:''}});
   assert.equal(missing.status,2);const blocked=JSON.parse(readFileSync(join(folder,'assistant-acceptance-live-report.json'),'utf8'));assert.equal(blocked.stopped,'gemini-key-required');assert.equal(blocked.results.length,0);assert.equal((missing.stdout+missing.stderr).includes('test-only-secret'),false);
  }

 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('Gemini case selection validates IDs before inference',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const listed=spawnSync(process.execPath,['scripts/test-assistant-live.mjs','--list','--provider=gemini','--case=compound-card-he'],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(listed.status,0,listed.stderr);const catalog=JSON.parse(listed.stdout);assert.equal(catalog.requests,1);assert.equal(catalog.total,acceptanceCases.length);assert.deepEqual(catalog.cases,['compound-card-he']);assert.equal(catalog.provider,'gemini');
 const unknown=spawnSync(process.execPath,['scripts/test-assistant-live.mjs','--list','--case=not-a-case'],{cwd:root,encoding:'utf8',timeout:10000});assert.notEqual(unknown.status,0);assert.match(unknown.stderr,/Unknown case ID/);
});
