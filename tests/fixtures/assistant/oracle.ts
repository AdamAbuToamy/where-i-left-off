import {checklistItems} from '../../../src/lib/taskOverview';
import {parseAssistantReply,planAssistantChanges,resolveProposalControls} from '../../../src/assistant/actions';
import type {AssistantData,Change} from '../../../src/assistant/actions';
import {acceptanceContext} from './corpus.mjs';
type Case={id:string;actions:{target:string;action:string;id:string;values?:Record<string,unknown>}[];controls:{kind:string;values:Record<string,unknown>}[];intents:unknown[]};
/** Independent corpus oracle checks values after the real domain planner, not provider prose. */
export function evaluateAcceptance(testCase:Case,text:string){
 const data=acceptanceContext(testCase.id) as AssistantData,reply=parseAssistantReply(text),changes=planAssistantChanges(data,reply.actions,1792756800000,true);
 const controls=resolveProposalControls(data,reply.actions,changes,reply.controls||[]);
 const aliases=new Map<string,string>();
 for(const action of testCase.actions.filter(a=>a.action==='create')){
  const values=action.values||{},label=values.name??values.title;
  const found=changes.filter(c=>c.target===action.target&&!c.before&&c.after&&(!label||(c.after as Record<string,unknown>).name===label||(c.after as Record<string,unknown>).title===label));
  if(found.length!==1)throw new Error('oracle-create-identity:'+action.target);
  aliases.set(action.id,found[0].id);
 }
 for(const action of testCase.actions){
  const id=aliases.get(action.id)||action.id;
  const change=changes.find(c=>c.target===action.target&&c.id===id);
  if(action.action==='delete'){if(!change||change.after!==null)throw new Error('oracle-delete');continue;}
  const baseline=action.target==='projects'||action.target==='sections'?data.scopes[0][action.target].find(r=>r.id===id):data.study[action.target as 'courses'|'tasks'|'lessons'].find(r=>r.id===id);
  const actual=(change?.after||baseline) as Record<string,unknown>|undefined;
  if(!actual)throw new Error('oracle-record-missing');
  if(action.action==='trash'&&!(Number(actual.trashedAt)>0))throw new Error('oracle-trash');
  for(const [field,value] of Object.entries(action.values||{})){
   const expected=['courseId','sectionId'].includes(field)&&typeof value==='string'?aliases.get(value)||value:value;
   if(['archivedAt','trashedAt'].includes(field)&&Number(expected)>0){if(!(Number(actual[field])>0))throw new Error('oracle-timestamp');continue;}
   if(field==='due'&&typeof actual[field]==='string'&&expected){if(Date.parse(actual[field] as string)!==Date.parse(String(expected)))throw new Error('oracle-due');continue;}
   if(field==='checklist'&&typeof expected==='string'&&typeof actual[field]==='string'){
    const rendered=(value:string)=>checklistItems(value).map(({text,done})=>({text,done}));
    if(JSON.stringify(rendered(actual[field] as string))!==JSON.stringify(rendered(expected)))throw new Error('oracle-field:projects.checklist');continue;
   }
   if(field==='topics'&&Array.isArray(expected)&&Array.isArray(actual[field])){
    const topics=actual[field] as {id:string;title:string;done:boolean}[],prior=(baseline as {topics?:{id:string}[]}|undefined)?.topics||[];
    const correct=topics.length===expected.length&&expected.every(topic=>topics.some(item=>item.title===topic.title&&item.done===topic.done&&(!prior.some(old=>old.id===topic.id)||item.id===topic.id)));
    if(!correct)throw new Error('oracle-field:'+action.target+'.'+field);continue;
   }
   if(JSON.stringify(actual[field])!==JSON.stringify(expected))throw new Error('oracle-field:'+action.target+'.'+field);
  }
 }
 for(const expected of testCase.controls)if(!controls.some(c=>c.kind===expected.kind&&Object.entries(expected.values).every(([field,value])=>JSON.stringify(c.values[field])===JSON.stringify(value))))throw new Error('oracle-control');
 // Expected mutations/controls above, not model presentation grouping, prove effects.
 // Non-mutation obligations still need explicit answer/handoff ledger entries.
 for(const outcome of ['answer','needs-input','unsupported']){
  const expected=testCase.intents.filter(i=>i&&typeof i==='object'&&'outcome' in i&&i.outcome===outcome).length;
  if((reply.tasks||[]).filter(t=>t.outcome===outcome).length<expected)throw new Error('oracle-request-omitted');
 }

 for(const actual of controls.filter(c=>c.kind!=='navigate')){
  const allowedValues=Object.assign({},...testCase.controls.filter(c=>c.kind===actual.kind).map(c=>c.values));
  if(Object.entries(actual.values).some(([field,value])=>JSON.stringify(allowedValues[field])!==JSON.stringify(value)))throw new Error('oracle-extra-control');
 }
 // Unrequested writes cannot hide among otherwise correct expected fields.
 const allowed=new Set(testCase.actions.map(a=>[a.target,aliases.get(a.id)||a.id].join('/')));
 if(changes.some(c=>!allowed.has([c.target,c.id].join('/'))))throw new Error('oracle-extra-record');
 return {data,reply,changes,controls};
}
export function assertReloaded(changes:Change[],fresh:AssistantData){
 for(const change of changes){
  const list=change.target==='projects'||change.target==='sections'?fresh.scopes.find(s=>s.id===change.scope)?.[change.target]:fresh.study[change.target];
  const saved=list?.find(r=>r.id===change.id) as unknown as Record<string,unknown>|undefined;
  if(!change.after){if(saved)throw new Error('oracle-delete-not-persisted');continue;}
  if(!saved)throw new Error('oracle-save-missing');
  for(const [field,value] of Object.entries(change.after))if(field!=='revision'&&JSON.stringify(saved[field])!==JSON.stringify(value))throw new Error('oracle-reload:'+change.target+'.'+field);
 }
}
