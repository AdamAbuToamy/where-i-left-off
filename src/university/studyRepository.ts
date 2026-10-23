import { createClientId } from '../lib/clientId'
import { emptyUniversity } from './model';
import type { Course, Lesson, StudyTask, UniversityState, UniversityStore } from './model';
export type StudyKind='courses'|'tasks'|'lessons';
export type StudyRecord={kind:StudyKind;id:string;payload:string;deleted:boolean;revision:number;mutationId:string};
type Pending={base:StudyRecord|null;record:StudyRecord};
export type StudySyncStatus={ready:boolean;pending:number;conflicts:string[];error:string};
export interface StudyRemote {
  watch(receive:(records:StudyRecord[])=>void,fail:(error:unknown)=>void):()=>void;
  write(key:string,update:(current:StudyRecord|null)=>StudyRecord):Promise<StudyRecord>;
}
const keyOf=(r:{kind:StudyKind;id:string})=>r.kind+'_'+r.id;
function records(state:UniversityState):Map<string,StudyRecord>{
  const result=new Map<string,StudyRecord>();
  for(const kind of ['courses','tasks','lessons'] as const)for(const item of state[kind]){
    const record:StudyRecord={kind,id:item.id,payload:JSON.stringify(item),deleted:false,revision:0,mutationId:''};
    result.set(keyOf(record),record);
  }
  return result;
}
const equal=(a:StudyRecord|null|undefined,b:StudyRecord|null|undefined)=>!!a&&!!b&&a.deleted===b.deleted&&(a.deleted||a.payload===b.payload);
const errorText='تعذرت المزامنة. تعديلاتك محفوظة على الجهاز؛ أعد المحاولة عند توفر الاتصال والصلاحيات.';
export function studySyncError(error:unknown):string {
 const code=String((error as {code?:string})?.code||'').replace(/^firestore\//,'');
 if(code==='permission-denied')return 'رفض Firebase الوصول إلى خطة الجامعة (permission-denied). تحقّق من تفعيل البريد ونشر قواعد Firestore الحديثة وإعداد App Check؛ نسختك المحلية محفوظة.';
 if(code==='unauthenticated')return 'انتهت جلسة Firebase (unauthenticated). سجّل الدخول مجددًا؛ نسختك المحلية محفوظة.';
 if(code==='resource-exhausted')return 'نفدت حصة Firebase (resource-exhausted). نسختك المحلية محفوظة؛ أعد المحاولة بعد تجدد الحصة.';
 if(code==='unavailable')return 'تعذّر الاتصال بخادم Firebase (unavailable). نسختك المحلية محفوظة؛ تحقّق من الشبكة وأعد المحاولة.';
 return errorText;
}

/** Each item has its own revision. Concurrent edits to the same item require an explicit choice. */
export class UniversityRepository {
  private state:UniversityState;
  private base=new Map<string,StudyRecord>();
  private pending=new Map<string,Pending>();
  private inflight=new Map<string,Pending>();
  private conflicts=new Set<string>();
  private ready=false;
  private active=false;
  private flushing=false;
  private error='';
  private stopWatch=()=>{};
  private notify:(state:UniversityState,status:StudySyncStatus)=>void=()=>{};
  private store:UniversityStore;
  private remote:StudyRemote;
  private invalid=false;
  constructor(store:UniversityStore,remote:StudyRemote){
    this.store=store;this.remote=remote;
    try{this.state=store.load();}catch{this.state=emptyUniversity();this.invalid=true;this.error='تعذر قراءة النسخة المحلية. لم نكتب فوق بياناتك.';return;}
    const saved=store.loadSync() as {base?:[string,StudyRecord][];pending?:[string,Pending][]}|null;
    if(saved){this.base=new Map(saved.base||[]);this.pending=new Map(saved.pending||[]);}
    // Migrate existing local records once. An existing cloud record is compared, never blindly overwritten.
    for(const [key,record] of records(this.state))if(!this.base.has(key)&&!this.pending.has(key))this.pending.set(key,{base:null,record:{...record,mutationId:createClientId()}});
  }
  start(notify:(state:UniversityState,status:StudySyncStatus)=>void){
    this.active=true;this.notify=notify;this.publish();
    if(this.invalid)return;
    this.stopWatch=this.remote.watch(incoming=>this.receive(incoming),error=>{if(this.active){this.ready=false;this.error=studySyncError(error);this.publish();}});
  }
  stop(){this.active=false;this.stopWatch();}
  private persist(){this.store.saveSync({base:[...this.base],pending:[...this.pending]});}
  private publish(){if(this.active)this.notify(this.state,{ready:this.ready,pending:this.pending.size,conflicts:[...this.conflicts],error:this.error});}
  commit(next:UniversityState){
    if(!this.active||this.invalid)throw new Error('انتهت جلسة الدخول');
    const before=records(this.state),after=records(next),pending=new Map(this.pending);
    for(const key of new Set([...before.keys(),...after.keys()])){
      if(equal(before.get(key),after.get(key)))continue;
      const value=after.get(key)||{...before.get(key)!,payload:'',deleted:true};
      if(new TextEncoder().encode(value.payload).length>600000)throw new Error('هذا السجل كبير جدًا للمزامنة. قلّل المواد أو الملاحظات فيه ثم احفظه.');
      pending.set(key,{base:pending.get(key)?.base||this.base.get(key)||null,record:{...value,mutationId:createClientId()}});
    }
    // Persist the outbox and state as one local journal before publishing a successful edit.
    this.store.saveSync({base:[...this.base],pending:[...pending],state:next});
    this.pending=pending;this.state=next;this.store.save(next);this.publish();void this.flush();
  }
  private receive(incoming:StudyRecord[]){
    if(!this.active)return;
    this.base=new Map(incoming.map(r=>[keyOf(r),r]));this.ready=true;this.error='';this.conflicts.clear();
    for(const [key,change] of this.pending){
      const current=this.base.get(key)||null;
      if(equal(current,change.record)){this.pending.delete(key);continue;}
      const flight=this.inflight.get(key);
      if(flight&&current?.mutationId===flight.record.mutationId){change.base=current;continue;}
      if((current?.revision??-1)!==(change.base?.revision??-1))this.conflicts.add(key);
    }
    this.compose();this.persist();this.publish();void this.flush();
  }
  private compose(){
    const all=new Map(this.base);for(const [key,change] of this.pending)all.set(key,change.record);
    const next={...emptyUniversity(),importedAt:this.state.importedAt};
    for(const record of all.values())if(!record.deleted){
      const item=JSON.parse(record.payload);
      if(item.id!==record.id)throw new Error('سجل سحابي غير صالح');
      if(record.kind==='courses')next.courses.push(item as Course);
      else if(record.kind==='tasks')next.tasks.push(item as StudyTask);
      else next.lessons.push(item as Lesson);
    }
    this.state=next;this.store.save(next);
  }
  async flush(){
    if(!this.active||!this.ready||this.flushing)return;
    this.flushing=true;
    try{
      for(const [key,change] of [...this.pending]){
        if(!this.active)break;
        if(this.conflicts.has(key)||this.pending.get(key)!==change)continue;
        this.inflight.set(key,change);
        try{
          const written=await this.remote.write(key,current=>{
            if(equal(current,change.record))return current!;
            if((current?.revision??-1)!==(change.base?.revision??-1))throw new Error('study-conflict');
            return {...change.record,revision:(current?.revision??-1)+1};
          });
          this.base.set(key,written);
          const latest=this.pending.get(key);
          if(latest?.record.mutationId===change.record.mutationId)this.pending.delete(key);
          else if(latest)latest.base=written;
          this.error='';
        }catch(e){
          if((e as Error).message==='study-conflict')this.conflicts.add(key);
          else {this.error=studySyncError(e);break;}
        }finally{this.inflight.delete(key);}
        this.persist();this.publish();
      }
    }finally{this.flushing=false;this.persist();this.publish();}
    // A newer local edit can arrive while the previous write is in flight.
    if(!this.error&&[...this.pending.keys()].some(k=>!this.conflicts.has(k)))void this.flush();
  }
  resolve(key:string,choice:'local'|'cloud'){
    const pending=this.pending.get(key);if(!pending)return;
    if(choice==='cloud')this.pending.delete(key);
    else this.pending.set(key,{base:this.base.get(key)||null,record:{...pending.record,mutationId:createClientId()}});
    this.conflicts.delete(key);this.compose();this.persist();this.publish();void this.flush();
  }
  retry(){if(this.invalid)return;this.error='';this.stopWatch();this.stopWatch=this.remote.watch(incoming=>this.receive(incoming),error=>{if(this.active){this.ready=false;this.error=studySyncError(error);this.publish();}});void this.flush();}
}
