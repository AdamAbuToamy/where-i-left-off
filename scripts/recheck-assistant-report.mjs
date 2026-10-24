import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
let vite;
try{
 const source=resolve(process.argv[2]||'assistant-acceptance-live-report.json'),original=JSON.parse(readFileSync(source,'utf8'));
 const output=resolve(dirname(source),'assistant-acceptance-rechecked-report.json');
 if(output===source)throw new Error('Use the original live report, not a rechecked report.');
 const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
 const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 const results=[];
 for(const row of original.results||[]){
  const c=acceptanceCases.find(c=>c.id===row.id),trace=row.trace?.findLast(t=>t.stage==='tool-plan'&&typeof t.text==='string'&&!t.error);
  if(!c||!trace||row.status==='blocked')continue;
  const item={id:c.id,status:'passed'};
  try{const checked=evaluateAcceptance(c,trace.text);item.operations=checked.changes.length+checked.controls.length;item.planItems=checked.reply.tasks?.length||0;item.verifiedFields=c.actions.flatMap(a=>Object.keys(a.values||{}).map(field=>a.target+'.'+field));}
  catch(error){item.status='failed';item.reason=error.message;}
  results.push(item);console.log(`${item.id}: ${item.status}${item.reason?' ['+item.reason+']':''}`);
 }
 const summary={checked:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,liveInferenceCalls:0};
 writeFileSync(output,JSON.stringify({kind:'offline-synthetic-domain-recheck',sourceReport:basename(source),checkedAt:new Date().toISOString(),summary,results},null,2)+'\n');
 console.log(JSON.stringify(summary));console.log('Original report unchanged. This validates saved proposals, not production persistence.');
 if(!results.length||summary.failed)process.exitCode=2;
}catch(error){console.error(error.code==='ENOENT'?'Live report not found. Run in the project containing assistant-acceptance-live-report.json.':error.message);process.exitCode=1;}
finally{await vite?.close();}
