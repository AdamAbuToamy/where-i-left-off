import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {assistant} from '../push-worker/src/assistant.mjs';
import {assistantProvider} from '../push-worker/src/assistantProvider.mjs';
import {safeProviderFailure} from '../push-worker/src/assistantErrors.mjs';
import {acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
const report={kind:'live-dialogue-synthetic-data',provider:'gemini',productionWrites:0,persistenceTested:false,inferenceCalls:0,results:[]};
const path='assistant-acceptance-live-report.json';const save=()=>writeFileSync(path,JSON.stringify(report,null,2));
let vite;
try{
 if(!process.env.GEMINI_API_KEY?.trim())throw new Error('gemini-key-required');
 vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 const {conversationHistory}=await vite.ssrLoadModule('/src/assistant/conversationHistory.ts');
 const {parseAssistantReply,planAssistantProposal}=await vite.ssrLoadModule('/src/assistant/actions.ts');
 const context=acceptanceContext('dialogue');context.scopes[0].projects.push({...context.scopes[0].projects[0],id:'robot-b',name:'Robot B'});
 const provider=assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:process.env.GEMINI_API_KEY});
 const traced={...provider,name:provider.name,model:provider.model,workspaceTools:true,run:async(...args)=>{if(++report.inferenceCalls>28)throw new Error('dialogue-call-budget');return provider.run(...args);}};
 const runtime={ASSISTANT_FREE_ONLY:'true',DB:{prepare:()=>({bind(){return this;},async run(){return {};},async all(){return {results:[{used:1}]};}})}};
 const needsInput=(reply,changes)=>{assert.equal(changes.length,0);assert.ok(reply.tasks?.some(t=>t.outcome==='needs-input'));assert.ok(reply.text.trim());};
 const threads=[
  {id:'create-card-followup-ar',language:'ar',turns:[
   ['أضف بطاقة',needsInput],
   ['اسمها مراجعة خوارزميات',needsInput],
   ['في قسم Study، بدون موعد، والملاحظة راجع الفصل الأول، والرابط https://example.test/algorithms',(r,c)=>{assert.equal(c.length,1);assert.equal(c[0].target,'projects');assert.equal(c[0].before,null);assert.equal(c[0].after.name,'مراجعة خوارزميات');assert.equal(c[0].after.sectionId,'section');assert.equal(c[0].after.dueDate||'','');assert.ok(c[0].after.description.includes('راجع الفصل الأول'));assert.equal(c[0].after.projectUrl,'https://example.test/algorithms');}],
  ]},
  {id:'edit-followup-ar',language:'ar',turns:[['عدل البطاقة',needsInput],['بطاقة عمار، خلي الخطوة القادمة حل تمرينين',(r,c)=>{assert.equal(c.length,1);assert.equal(c[0].id,'card');assert.equal(c[0].after.nextStep,'حل تمرينين');assert.equal(c[0].after.name,'عمار');}]]},
  {id:'delete-followup-ar',language:'ar',turns:[['احذف البطاقة',needsInput],['أقصد Robot B فقط',(r,c)=>{assert.equal(c.length,1);assert.equal(c[0].id,'robot-b');assert.ok(c[0].after.trashedAt>0);}]]},
  {id:'skip-extras-ar',language:'ar',turns:[['أضف بطاقة باسم Quick بدون أي إضافات، لا تسأل عن خيارات إضافية',(r,c)=>{assert.equal(c.length,1);assert.equal(c[0].after.name,'Quick');}]]},
  {id:'missing-name-en',language:'en',turns:[['Add a card',needsInput]]},
  {id:'missing-name-he',language:'he',turns:[['הוסף כרטיס',needsInput]]},
 ];
 for(const thread of threads){const history=[];for(const [index,[message,verify]] of thread.turns.entries()){
  const id=thread.id+'-'+(index+1),start=Date.now();let output;
  try{
   output=await assistant(runtime,'synthetic-dialogue',{mode:'workspace',language:thread.language,message,context:JSON.stringify(context),history:conversationHistory(history)},traced);
   const reply=parseAssistantReply(output.text),changes=planAssistantProposal(context,reply.actions);verify(reply,changes);
   history.push({role:'user',text:message},{role:'assistant',text:reply.text,reply,changes});
   report.results.push({id,status:'passed',elapsedMs:Date.now()-start});console.log(id+': passed ('+(Date.now()-start)+'ms)');save();
  }catch(error){report.results.push({id,status:'failed',reason:String(error.message).slice(0,300),providerFailure:safeProviderFailure(error.cause||error),...(output?{syntheticReply:output.text}:{}),elapsedMs:Date.now()-start});save();throw error;}
 }}
 console.log(JSON.stringify({passed:report.results.length,inferenceCalls:report.inferenceCalls,productionWrites:0}));
}catch(error){save();console.error('dialogue-canary-failed: '+String(error.message).slice(0,300));process.exitCode=1;}
finally{await vite?.close();}
