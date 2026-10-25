import {LocalAssistantModel,LOCAL_MODEL} from './localModel';
import {evaluateAcceptance} from '../../tests/fixtures/assistant/oracle';
import {acceptanceCases,acceptanceContext} from '../../tests/fixtures/assistant/corpus.mjs';
import {buildStressCorpus} from '../../tests/fixtures/assistant/stressCorpus.mjs';

type LabCase={id:string;sourceId?:string;language:'ar'|'he'|'en';message:string;actions:{target:string;action:string;id:string;values?:Record<string,unknown>}[];controls:{kind:string;values:Record<string,unknown>}[];intents:unknown[]};
type Result={id:string;language:string;status:'passed'|'failed';reason?:string;ms:number;message:string};
const byId=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const load=byId<HTMLButtonElement>('load'),run=byId<HTMLButtonElement>('run'),stop=byId<HTMLButtonElement>('stop'),exp=byId<HTMLButtonElement>('export');
const state=byId<HTMLElement>('state'),stats=byId<HTMLElement>('stats'),failures=byId<HTMLElement>('failures'),progress=byId<HTMLProgressElement>('progress');
const suite=byId<HTMLSelectElement>('suite'),limit=byId<HTMLInputElement>('limit');
suite.onchange=()=>{limit.value=String(suite.value==='smoke'?3:suite.value==='original'?acceptanceCases.length:2000);};
let engine:LocalAssistantModel|null=null,running=false,stopRequested=false;
const results:Result[]=[];
function show(){
 const passed=results.filter(x=>x.status==='passed').length;
 stats.textContent=JSON.stringify({model:LOCAL_MODEL,attempted:results.length,passed,failed:results.length-passed,notRun:'depends on selected suite'},null,2);
 failures.textContent=results.filter(x=>x.status==='failed').slice(-12).map(x=>x.id+' — '+x.reason).join('\n')||'No failures recorded';
}
load.onclick=async()=>{
 if(engine)return;
 load.disabled=true;state.textContent='Checking WebGPU and loading model…';
 const next=new LocalAssistantModel();
 try{
  await next.load(f=>{progress.value=f;state.textContent='Loading local model: '+Math.round(f*100)+'%';});
  engine=next;state.textContent='Local model ready. Running tests will use actual WebGPU inference.';run.disabled=false;
 }catch(error){next.dispose();load.disabled=false;state.textContent='Model unavailable: '+String(error);}
};
run.onclick=async()=>{
 if(!engine||running)return;
 const all:LabCase[]=suite.value==='smoke'?(acceptanceCases as LabCase[]).filter(c=>c.id.startsWith('compound-card-')).slice(0,3):suite.value==='original'?acceptanceCases as LabCase[]:buildStressCorpus().filter((c:LabCase)=>suite.value==='stress-'+c.language);
 const requested=Math.max(1,Math.min(all.length,Math.floor(Number(limit.value)||3)));
 results.length=0;show();running=true;stopRequested=false;run.disabled=true;stop.disabled=false;suite.disabled=true;
 try{
  for(const testCase of all.slice(0,requested)){
   if(stopRequested)break;
   const start=performance.now();state.textContent='Testing '+(results.length+1)+'/'+requested+' — '+testCase.id;
   try{
    const context=JSON.stringify(acceptanceContext(testCase.sourceId||testCase.id));
    const reply=await engine.answer({message:testCase.message,context,language:testCase.language,history:[]});
    evaluateAcceptance(testCase,reply.text);
    results.push({id:testCase.id,language:testCase.language,status:'passed',ms:Math.round(performance.now()-start),message:testCase.message});
   }catch(error){
    results.push({id:testCase.id,language:testCase.language,status:'failed',reason:error instanceof Error?error.message:String(error),ms:Math.round(performance.now()-start),message:testCase.message});
   }
   progress.value=results.length/requested;show();
   // Give the browser an opportunity to refresh the UI between GPU runs.
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
 }finally{running=false;run.disabled=false;stop.disabled=true;suite.disabled=false;state.textContent=stopRequested?'Stopped by user':'Finished '+results.length+'/'+requested+' real model attempts';}
};
stop.onclick=()=>{stopRequested=true;state.textContent='Stopping after current inference…';};
exp.onclick=()=>{
 const selected=suite.value,total=selected==='smoke'?3:selected==='original'?acceptanceCases.length:2000;
 const report={kind:'real-webgpu-synthetic-account',model:LOCAL_MODEL,suite:selected,total,completed:results.length,notRun:Math.max(0,total-results.length),createdAt:new Date().toISOString(),browser:navigator.userAgent,results};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='wilo-local-lab-results.json';a.click();URL.revokeObjectURL(url);
};
show();
