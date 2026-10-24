import { localDateKey } from '../lib/projects';
import { createClientId } from '../lib/clientId'
import { collection, doc, getDocsFromServer, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { normalizedProject, normalizedSection, projectedState } from '../lib/workspaceModel';
import { IndexedDbWorkspaceStore } from '../lib/indexedDbWorkspaceStore';
import { UniversityStore } from '../university/model';
import type { AssistantData, Change } from './actions';
import { blankAssistantData } from './actions';
import { parsePlanBackup } from '../university/planImport';
export type AssistantReceipt = { changes:Change[]; mutations:Map<string,string> };
export type AssistantSnapshot = {data:AssistantData; raw:Map<string,DocumentData>; pending:boolean};
function canonical(value:unknown):string{
 if(value===undefined)return 'undefined';
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
}
const isStudy=(target:string)=>['courses','tasks','lessons'].includes(target);
function path(uid:string,c:Pick<Change,'target'|'scope'|'id'>){
 return isStudy(c.target)?`users/${uid}/studyRecords/${c.target}_${c.id}`:`${c.scope==='personal'?'users/'+uid:'groups/'+c.scope}/${c.target}/${c.id}`;
}
/** The caller can only use scopes discovered from this account's memberships. Firestore enforces roles. */
/** Retry a single transient read once; never retry permissions or unconfirmed writes. */
export async function reliableAssistantRead<T>(operation:()=>Promise<T>,pause:(ms:number)=>Promise<void>=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<T>{
 try{return await operation();}catch(error){
  const code=String((error as {code?:string})?.code||'');
  if(!['unavailable','deadline-exceeded','resource-exhausted','firestore/unavailable','firestore/deadline-exceeded'].includes(code))throw error;
  await pause(250);return operation();
 }
}
export class AssistantRepository {
 private uid:string;
 constructor(uid:string){this.uid=uid;}
 private check(){if(!db||auth?.currentUser?.uid!==this.uid)throw new Error('account-changed');}
 private studyStore(){return new UniversityStore(this.uid,db!.app.options.projectId||'local');}
 async read():Promise<AssistantSnapshot>{
  this.check();const data=blankAssistantData(),raw=new Map<string,DocumentData>();
  const [study,memberships]=await Promise.all([reliableAssistantRead(()=>getDocsFromServer(collection(db!,'users',this.uid,'studyRecords'))),reliableAssistantRead(()=>getDocsFromServer(collection(db!,'users',this.uid,'groupMemberships')))]);
  this.check();
  for(const document of study.docs){const r=document.data();raw.set(document.ref.path,r);if(!r.deleted&&['courses','tasks','lessons'].includes(r.kind)){
   const item=JSON.parse(r.payload);if(item.id!==r.id)throw new Error('assistant-invalid');
   data.study[r.kind as 'courses'|'tasks'|'lessons'].push(item);
  }}
  for(const m of memberships.docs)data.scopes.push({id:m.id,name:String(m.data().groupName||m.id),role:m.data().role==='manager'?'manager':'member',projects:[],sections:[]});
  let pending=false;
  const journal=this.studyStore().loadSync() as {pending?:unknown[]}|null;
  if(journal?.pending?.length){pending=true;data.study=this.studyStore().load();}
  await Promise.all(data.scopes.map(async scope=>{
   const base=scope.id==='personal'?`users/${this.uid}`:`groups/${scope.id}`;
   const [projects,sections]=await Promise.all([reliableAssistantRead(()=>getDocsFromServer(collection(db!,base,'projects'))),reliableAssistantRead(()=>getDocsFromServer(collection(db!,base,'sections')))]);
   this.check();
   if(scope.id!=='personal'){const members=await reliableAssistantRead(()=>getDocsFromServer(collection(db!,base,'members')));this.check();scope.members=members.docs.map(m=>({uid:m.id,name:String(m.data().name||m.id),role:String(m.data().role||'member')}));}
   scope.projects=projects.docs.map(d=>{raw.set(d.ref.path,d.data());return normalizedProject(d.id,d.data());});
   scope.sections=sections.docs.map(d=>{raw.set(d.ref.path,d.data());return normalizedSection(d.id,d.data());});
   const local=await new IndexedDbWorkspaceStore(`${db!.app.options.projectId}/${this.uid}${scope.id==='personal'?'':`/group/${scope.id}`}`).read();
   if(local.operations.length){pending=true;const projected=projectedState(local);scope.projects=projected.projects;scope.sections=projected.sections;}
  }));
  this.check();return {data,raw,pending};
 }
 async apply(snapshot:AssistantSnapshot,changes:Change[]):Promise<AssistantReceipt>{
  this.check();
  if(!changes.length||changes.length>50)throw new Error('assistant-invalid');
  // Refresh the local outboxes before committing. Never overwrite an unsent edit.
  const current=await this.read();
  if(current.pending||snapshot.pending)throw new Error('assistant-pending');
  const allowed=new Set(current.data.scopes.map(s=>s.id));
  for(const c of changes)if(!allowed.has(c.scope))throw new Error('assistant-invalid');
  const refs=changes.map(c=>doc(db!,path(this.uid,c)));
  // Reading all known courses protects prerequisite graph invariants against concurrent edits.
  const guards=new Map(refs.map(r=>[r.path,r]));
  for(const c of snapshot.data.study.courses){const p=path(this.uid,{target:'courses',scope:'personal',id:c.id});guards.set(p,doc(db!,p));}
  const guardRefs=[...guards.values()];
  if(guardRefs.length>450)throw new Error('assistant-too-large');
  const mutations=new Map(refs.map(r=>[r.path,createClientId()]));
  await runTransaction(db!,async tx=>{
   this.check();const documents=await Promise.all(guardRefs.map(r=>tx.get(r)));this.check();
   for(let i=0;i<documents.length;i++){
    const before=snapshot.raw.get(guardRefs[i].path),actual=documents[i].data();
    if(canonical(before)!==canonical(actual))throw new Error('assistant-conflict');
   }
   for(let i=0;i<changes.length;i++){
    const c=changes[i],old=snapshot.raw.get(refs[i].path),revision=old?Number(old.revision||0)+1:0;
    if(!c.after&&!isStudy(c.target)){if(c.target==='projects'&&(c.scope!=='personal'||!(c.before as {trashedAt?:number}|null)?.trashedAt))throw new Error('assistant-permanent-delete');tx.delete(refs[i]);continue;}
    const body=isStudy(c.target)?{kind:c.target,id:c.id,payload:c.after?JSON.stringify(c.after):'',deleted:!c.after,revision}: {...c.after as object,revision};
    if(!isStudy(c.target)){
     delete (body as Record<string,unknown>).id;
     // Preserve absent legacy defaults, as the normal workspace transport does.
     const baseline=c.before as Record<string,unknown>|null;
     if(old&&baseline)for(const key of Object.keys(body))if(!(key in old)&&canonical((body as Record<string,unknown>)[key])===canonical(baseline[key]))delete (body as Record<string,unknown>)[key];
    }
    tx.set(refs[i],{...body,mutationId:mutations.get(refs[i].path),updatedAt:serverTimestamp()});
   }
  });
  // A successful proposal is only announced after the server confirms every mutation.
  try{
   const saved=await Promise.all(refs.map(ref=>getDocFromServer(ref)));this.check();
   if(saved.some((document,i)=>!changes[i].after&&!isStudy(changes[i].target)?document.exists():document.data()?.mutationId!==mutations.get(refs[i].path)))throw new Error('assistant-confirmation');
  }catch(error){throw new Error('assistant-confirmation',{cause:error});}
  this.check();window.dispatchEvent(new Event('university-data-changed'));return {changes,mutations};
 }
 async undo(receipt:AssistantReceipt):Promise<void>{
  const snapshot=await this.read();
  for(const c of receipt.changes)if(!c.after&&!isStudy(c.target)?snapshot.raw.has(path(this.uid,c)):snapshot.raw.get(path(this.uid,c))?.mutationId!==receipt.mutations.get(path(this.uid,c)))throw new Error('assistant-conflict');
  if(receipt.changes.some(c=>c.target==='projects'&&!c.after))throw new Error('assistant-undo-permanent');
  const reverse=receipt.changes.map(c=>({...c,before:c.after,after:c.before}));
  const study=structuredClone(snapshot.data.study);
  for(const c of reverse)if(isStudy(c.target)){
   const target=c.target as 'courses'|'tasks'|'lessons';
   const items=study[target] as {id:string}[];
   const index=items.findIndex(x=>x.id===c.id);if(index>=0)items.splice(index,1);
   if(c.after)items.push(c.after as {id:string});
  }
  try{parsePlanBackup(study);}catch{throw new Error('assistant-conflict');}
  // New cards/sections are preserved in trash / emptied only through the UI, not permanently deleted by undo.
  if(reverse.some(c=>!c.after&&!isStudy(c.target)))throw new Error('assistant-undo-create');
  await this.apply(snapshot,reverse);
 }

}
export function assistantContext(snapshot:AssistantSnapshot,message?:string):string{
 // Imported course source can include entire Moodle pages. Send it only for content analysis,
 // while retaining IDs, notes, tasks and timetable for ordinary account operations.
 const needsSource=!message||/لخص|تلخيص|ملخص|محتو|اشرح|شرح|نصائح|نصيحه|نصيحة|summari[sz]|content|explain|advi[cs]|סכם|סיכום|תוכן|הסבר|עצה/i.test(message);
 const data=needsSource?snapshot.data:{...snapshot.data,study:{...snapshot.data.study,courses:snapshot.data.study.courses.map(c=>{const {source,...course}=c;return {...course,...(source?{sourceOmitted:true}:{})};})}};
 const context=JSON.stringify({now:new Date().toISOString(),localDate:localDateKey(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,...data,pending:snapshot.pending});
 if(context.length>44000)throw new Error('assistant-too-large');
 return context;
}
