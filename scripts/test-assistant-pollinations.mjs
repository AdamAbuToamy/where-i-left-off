import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {acceptanceCases,acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
import {reportSummary} from './lib/localReleaseGate.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2),value=(name,fallback)=>args.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=')||fallback;
const config=JSON.parse(readFileSync('src/assistant/pollinationsConfig.json','utf8'));
const selected=acceptanceCases.filter(c=>!value('case','')||value('case','').split(',').includes(c.id)).slice(0,Number(value('limit',618)));
const reportPath=resolve(value('report','assistant-acceptance-pollinations.json'));
const fingerprint=createHash('sha256').update(['push-worker/src/assistantNativeTools.mjs','push-worker/src/assistantContract.mjs','tests/fixtures/assistant/corpus.mjs','src/assistant/pollinationsClient.ts','push-worker/src/assistantConversation.mjs','push-worker/src/assistantTools.mjs','push-worker/src/assistantContext.mjs','shared/assistantDialogue.mjs','src/assistant/workspaceValidation.ts','tests/fixtures/assistant/oracle.ts','src/assistant/pollinationsConfig.json'].map(p=>readFileSync(p,'utf8')).join('\0')).digest('hex');
let report=args.includes('--resume')&&existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
if(report&&report.fingerprint!==fingerprint){writeFileSync(reportPath+'.previous-'+Date.now()+'.json',JSON.stringify(report,null,2));report=null;}
report||={kind:'live-pollinations-production-client-synthetic-data',model:config.model,fingerprint,productionWrites:0,persistenceTested:false,startedAt:new Date().toISOString(),results:[]};
const save=()=>{report.updatedAt=new Date().toISOString();report.summary=reportSummary(report.results,acceptanceCases.length);writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');writeFileSync(reportPath.replace(/\.json$/,'.csv'),'id,status,reason,elapsedMs\n'+report.results.map(r=>[r.id,r.status,r.reason||'',r.elapsedMs].map(v=>JSON.stringify(v)).join(',')).join('\n'));writeFileSync(reportPath.replace(/\.json$/,'.md'),'# Wilo live Pollinations acceptance\n\nModel: '+config.model+'\n\n'+JSON.stringify(report.summary)+'\n\nSynthetic data only; no production database writes or persistence checks. Each case uses the shipped cloud conversation and proposal client, then the actual domain planner and independent oracle.\n\n| Case | Status | Reason | ms |\n|---|---|---|---|\n'+report.results.map(r=>`| ${r.id} | ${r.status} | ${r.reason||''} | ${r.elapsedMs} |`).join('\n'));};
if(args.includes('--list')){console.log(JSON.stringify({model:config.model,count:selected.length,cases:selected.map(c=>c.id)},null,2));process.exit(0);}
if(!args.includes('--live'))throw new Error('Use --live to consume only the restricted test key free allowance.');
const key=process.env.POLLINATIONS_TEST_KEY||JSON.parse(readFileSync(value('key-file','.wrangler/polli-suite.private.json'),'utf8')).key;
if(typeof key!=='string'||!key.startsWith('sk_'))throw new Error('test-key-required');
globalThis.sessionStorage={getItem:name=>name==='wilo-pollinations:synthetic-acceptance'?key:null};
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'});
let stopped=false,active=0,completed=0,ratePauseUntil=0;const attempts=new Map();process.once('SIGINT',()=>{stopped=true;report.stopped='interrupted';save();});
try{
 const {PollinationsAssistant}=await vite.ssrLoadModule('/src/assistant/pollinationsClient.ts');
 const {AssistantProposalClient}=await vite.ssrLoadModule('/src/assistant/proposalClient.ts');
 const {validateWorkspaceReply}=await vite.ssrLoadModule('/src/assistant/workspaceValidation.ts');
 const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 const client=new PollinationsAssistant('synthetic-acceptance');
 const pending=selected.filter(c=>!report.results.some(r=>r.id===c.id&&(args.includes('--retry-failed')?r.status==='passed':r.status==='passed'||r.status==='failed')));
 const blocked=new Set(['ai-provider-limit','ai-provider-access','assistant-connect-required','assistant-network']);
 const worker=async()=>{while(!stopped){if(Date.now()<ratePauseUntil)await new Promise(r=>setTimeout(r,ratePauseUntil-Date.now()));if(stopped)return;const c=pending.shift();if(!c)return;active++;const start=Date.now(),item={id:c.id,status:'passed'};
 try{
 const route=await client.conversation({message:c.message,language:c.language,history:[]});item.route=route;
 if(!route.needsWorkspace)throw new Error('route-missed-workspace');
 const context=JSON.stringify(acceptanceContext(c.id));
 const result=await new AssistantProposalClient(payload=>client.workspace(payload)).prepare({mode:'workspace',message:c.message,language:c.language,context,history:[],requirements:route.requirements},text=>{validateWorkspaceReply(c.message,acceptanceContext(c.id),text);return text;},()=>{item.repaired=true;});
 item.reply=result;evaluateAcceptance(c,result);
 }catch(error){item.status=blocked.has(error.message)?'blocked':'failed';item.reason=error.message;item.httpStatus=error.status;if(error.status===429&&(attempts.get(c.id)||0)<3){attempts.set(c.id,(attempts.get(c.id)||0)+1);pending.push(c);ratePauseUntil=Date.now()+30000;item.rateRetry=true;}else if(item.status==='blocked'&&error.message!=='assistant-network'){stopped=true;report.stopped=error.message;}}
 item.elapsedMs=Date.now()-start;report.results=report.results.filter(r=>r.id!==c.id);report.results.push(item);save();active--;completed++;
 console.log(`${report.results.length}/${acceptanceCases.length} ${c.id} ${item.status}${item.reason?' '+item.reason:''} ${item.elapsedMs}ms`);
 }};
 console.log(`LIVE ${config.model}: ${pending.length} pending, concurrency=${value('concurrency',4)}, synthetic data, no production writes.`);
 await Promise.all(Array.from({length:Math.max(1,Math.min(8,Number(value('concurrency',4))))},worker));save();console.log(JSON.stringify(report.summary));
 if(report.summary.failed||report.summary.blocked||report.summary.notRun)process.exitCode=2;
}finally{await vite.close();}