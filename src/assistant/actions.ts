import { validDate } from '../lib/projects';
import { parseTasks } from './taskLedger';
import type { AssistantTask } from './taskLedger';
import { parseControls } from './controlContract';
import type { AssistantControl } from './controlContract';
import { createClientId } from '../lib/clientId'
import { ProjectEntity } from '../lib/projectEntity';
import type { ProjectChanges } from '../lib/projectEntity';
import type { Project, Section } from '../types';
import { emptyUniversity } from '../university/model';
import type { UniversityState } from '../university/model';
import { parsePlanBackup } from '../university/planImport';
export type AssistantScope = { id: string; name: string; role?:'manager'|'member'; members?:{uid:string;name:string;role:string}[]; projects: Project[]; sections: Section[] };
export type AssistantData = { study: UniversityState; scopes: AssistantScope[] };
export type Action = { target: 'courses'|'tasks'|'lessons'|'projects'|'sections'; action: 'create'|'update'|'delete'|'trash'; id?: string; scope?: string; values?: Record<string, unknown> };
export type Change = { target: Action['target']; scope: string; id: string; before: unknown; after: unknown; actionIndexes?:number[] };
export type AssistantReply = { tasks?:AssistantTask[]; controls?: AssistantControl[]; text: string; actions: Action[]; files: { name: string; content: string }[] };
const fields = {
 courses: ['name','url','notes','requires','topics','x','y'], tasks: ['courseId','title','kind','due','done','notes','url'],
 lessons: ['courseId','sessionType','day','start','end','room','notes'],
 projects: ['name','nextStep','status','description','dueDate','followUpDate','checkpoint','checklist','sectionId','projectUrl','attachmentUrl','links','resourceType','progressUnits','totalUnits','kind','rank','assignedTo','coverUrl','archivedAt','trashedAt'], sections: ['name'],
};
function invalid(reason:string):never{throw new Error('assistant-invalid',{cause:new Error(reason)});}
function object(value: unknown): Record<string, unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('assistant-invalid');
 return value as Record<string,unknown>;
}
export function parseAssistantReply(text: string): AssistantReply {
 try {
  if(typeof text!=='string'||!text.trim()||text.length>48000)throw new Error('assistant-format');
  let raw:unknown;
  try{raw=JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));}catch{throw new Error('assistant-format');}
  const value=object(raw);
  // Omitted empty optional arrays are safe; malformed arrays remain an error.
  if(value.actions===undefined)value.actions=[];
  if(value.files===undefined)value.files=[];
  if(typeof value.text!=='string'||value.text.length>12000||!Array.isArray(value.actions)||value.actions.length>50||!Array.isArray(value.files)||value.files.length>3)throw new Error('assistant-format');
  for(const raw of value.actions){
   const a=object(raw);
   if(!Object.hasOwn(fields,String(a.target))||!['create','update','delete','trash'].includes(String(a.action))||Object.keys(a).some(k=>!['target','action','id','scope','values'].includes(k)))throw new Error();
   if(a.id!==undefined&&(typeof a.id!=='string'||!/^[-\w]{1,600}$/.test(a.id)))throw new Error();
   if(a.scope!==undefined&&(typeof a.scope!=='string'||!/^[-\w]{1,100}$/.test(a.scope)))throw new Error();
   const values=object(a.values||{});
   if(Object.keys(values).some(k=>!fields[a.target as Action['target']].includes(k)))invalid('assistant-fields');
  }
  const files=value.files.map(raw=>{const f=object(raw);if(typeof f.name!=='string'||typeof f.content!=='string'||f.content.length>30000||!f.name.trim()||f.name.length>100)throw new Error();return {name:Array.from(f.name).map(c=>c==='/'||c==='\\'||c.charCodeAt(0)<32?'_':c).join('').replace(/\.[^.]+$/,'')+'.txt',content:f.content};});
  const controls=parseControls(value.controls);
  const tasks=parseTasks(value.tasks,value.actions.length,controls.length);
  return {text:value.text,actions:value.actions as Action[],files,...(controls.length?{controls}:{}),...(tasks.length?{tasks}:{})};
 }catch(error) {if((error as Error).message==='assistant-format')throw error;throw new Error('assistant-invalid',{cause:error});}
}
/** Model output is a proposal. Only whitelisted domain changes reach the persistence adapter. */
export function planAssistantChanges(data: AssistantData, actions: Action[], now=Date.now(), trackActions=false): Change[] {
 if(actions.length>50)throw new Error('assistant-invalid');
 if(actions.length===0)return [];
 const working=structuredClone(data),aliases=new Map<string,string>();
 const changed=new Map<string,Change>();
 const known=new Set([...data.study.courses,...data.study.tasks,...data.study.lessons,...data.scopes.flatMap(s=>[...s.projects,...s.sections])].map(x=>x.id));
 for(const a of actions)if(a.action==='create'){
  if(!a.id||known.has(a.id)||aliases.has(a.id))invalid('assistant-alias');
  aliases.set(a.id,createClientId());
 }
 const ref=(id:unknown)=>typeof id==='string'?(aliases.get(id)||id):id;
 for(const [actionIndex,a] of actions.entries()){
  if(!Object.hasOwn(fields,a.target))throw new Error('assistant-invalid');
  const scope=a.target==='projects'||a.target==='sections'?(a.scope||'personal'):'personal';
  const workspace=working.scopes.find(s=>s.id===scope);
  if(!workspace)invalid('assistant-reference');
  const list=(a.target==='projects'?workspace.projects:a.target==='sections'?workspace.sections:working.study[a.target]) as unknown as {id:string;[key:string]:unknown}[];
  const id=String(ref(a.id)||''),index=list.findIndex(x=>x.id===id),before=index<0?null:structuredClone(list[index]);
  if(a.action==='create'?index>=0:!before)invalid('assistant-reference');
  const values=object(a.values||{});
  if(Object.keys(values).some(k=>!fields[a.target].includes(k)))invalid('assistant-fields');
  const patch={...values};
  for(const key of ['courseId','sectionId'])if(key in patch)patch[key]=ref(patch[key]);
  if(a.target==='tasks'&&'due' in patch&&patch.due!==''&&(typeof patch.due!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(patch.due)||!validDate(patch.due.slice(0,10))||!Number.isFinite(Date.parse(patch.due))))invalid('assistant-task-date');
  if(a.target==='lessons'){
   if(a.action==='create'&&['courseId','day','start','end'].some(key=>!(key in patch)))invalid('assistant-clock');
   if('day' in patch&&(!Number.isInteger(patch.day)||Number(patch.day)<0||Number(patch.day)>6))invalid('assistant-clock');
   for(const key of ['start','end'])if(key in patch&&(typeof patch[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch[key] as string)))invalid('assistant-clock');
  }
  if(['tasks','lessons'].includes(a.target)&&'courseId' in patch&&!working.study.courses.some(c=>c.id===patch.courseId)&&!aliases.has(String(values.courseId)))invalid('assistant-reference');
  if('requires' in patch){if(!Array.isArray(patch.requires))throw new Error('assistant-invalid');patch.requires=patch.requires.map(ref);}
  let after:Record<string,unknown>|null;
  if(a.action==='delete'){
   if(a.target==='projects')throw new Error('assistant-invalid');
   after=null;
  }else if(a.target==='projects'){
   if(a.action==='trash')patch.trashedAt=now;
   else if(!['create','update'].includes(a.action))throw new Error('assistant-invalid');
   after=(before?ProjectEntity.restore(before as unknown as Project).apply('edit',patch as ProjectChanges,(before as unknown as Project).revision,now)!:ProjectEntity.create(id,String(patch.name||''),String(patch.nextStep||''),now,patch as ProjectChanges,now)).snapshot() as unknown as Record<string,unknown>;

   if(patch.assignedTo&&scope!=='personal'&&workspace.members&&!workspace.members.some(m=>m.uid===patch.assignedTo))invalid('assistant-reference');
   if(data.study.tasks.some(t=>t.reminderProjectId===id)&&scope==='personal')throw new Error('assistant-linked-reminder');
  }else if(a.target==='sections'){
   if(!['create','update'].includes(a.action)||typeof patch.name!=='string'||!patch.name.trim()||patch.name.length>60)throw new Error('assistant-invalid');
   after={id,name:patch.name.trim(),revision:before?Number(before.revision||0)+1:0};
  }else{
   if(!['create','update'].includes(a.action))throw new Error('assistant-invalid');
   const defaults=a.target==='courses'?{name:'',url:'',notes:'',requires:[],topics:[],x:0,y:0}:a.target==='tasks'?{courseId:'',title:'',kind:'task',due:'',done:false,notes:'',url:''}:{courseId:'',sessionType:'lecture',day:0,start:'09:00',end:'10:00',room:''};
   after={...defaults,...before,...patch,id};
  }
  if(a.target==='tasks'&&before?.reminderProjectId)throw new Error('assistant-linked-reminder');
  if(a.target==='lessons'&&a.action==='create'&&working.study.lessons.some(l=>l.courseId===after?.courseId&&l.day===after?.day&&l.start===after?.start&&l.end===after?.end&&(l.sessionType||'lecture')===after?.sessionType))continue;
  if(index>=0)list.splice(index,1);
  if(after)list.push(after as {id:string;[key:string]:unknown});
  const key=[a.target,scope,id].join('/'),existing=changed.get(key);
  changed.set(key,{target:a.target,scope,id,before:existing?existing.before:before,after,...(trackActions?{actionIndexes:[...(existing?.actionIndexes||[]),actionIndex]}:{})});
 }
 for(const workspace of working.scopes)for(const project of workspace.projects)if(project.sectionId&&!workspace.sections.some(s=>s.id===project.sectionId))invalid('assistant-reference');
 const parsed=parsePlanBackup(working.study);
 if(parsed.courses.some(c=>!c.name.trim())||parsed.tasks.some(t=>!t.title.trim()))throw new Error('assistant-invalid');
 for(const change of changed.values())if(change.after&&['courses','tasks','lessons'].includes(change.target)){
  const item=change.after as {id:string};
  const validated=parsed[change.target as 'courses'|'tasks'|'lessons'].find(x=>x.id===item.id)!;
  change.after={...(change.after as object),...validated,...((change.after as {source?:unknown}).source?{source:(change.after as {source:unknown}).source}:{})};
 }
 return [...changed.values()].filter(c=>JSON.stringify(c.before)!==JSON.stringify(c.after));
}
export const blankAssistantData=():AssistantData=>({study:emptyUniversity(),scopes:[{id:'personal',name:'Personal',projects:[],sections:[]}]});

/** Clock sampling and ledger metadata belong to the proposal adapter, outside React rendering. */
export function planAssistantProposal(data:AssistantData,actions:Action[]):Change[]{
 return planAssistantChanges(data,actions,Date.now(),true);
}
