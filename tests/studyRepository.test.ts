import { beforeEach, expect, it, vi } from 'vitest';
import { UniversityStore, emptyUniversity } from '../src/university/model';
import type { UniversityState } from '../src/university/model';
import { UniversityRepository } from '../src/university/studyRepository';
import type { StudyRemote, StudyRecord } from '../src/university/studyRepository';
const values=new Map<string,string>();
beforeEach(()=>{values.clear();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)});});
const course=(id='a')=>({id,name:'Algorithms',url:'',notes:'',requires:[],topics:[],x:0,y:0});
function remote(){
 const docs=new Map<string,StudyRecord>();const listeners=new Set<(r:StudyRecord[])=>void>();let online=true;
 const port:StudyRemote={watch(receive){listeners.add(receive);if(online)receive([...docs.values()]);return()=>listeners.delete(receive);},async write(key,update){if(!online)throw new Error('offline');const result=update(docs.get(key)||null);docs.set(key,result);for(const fn of listeners)fn([...docs.values()]);return result;}};
 return {docs,port,broadcast(){for(const fn of listeners)fn([...docs.values()]);},online(value:boolean){online=value;}};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
it('migrates local data and synchronizes distinct edits across devices without replacing whole plans',async()=>{
 const r=remote(),s1=new UniversityStore('alice','project'),s2=new UniversityStore('alice','other-browser');
 s1.save({...emptyUniversity(),courses:[course()]});let a=emptyUniversity(),b=emptyUniversity();
 const one=new UniversityRepository(s1,r.port),two=new UniversityRepository(s2,r.port);
 one.start(state=>{a=state;});two.start(state=>{b=state;});await settle();expect(b.courses).toHaveLength(1);
 one.commit({...a,courses:[{...a.courses[0],notes:'Device one'}]});await settle();
 two.commit({...b,courses:[...b.courses,course('b')]});await settle();
 expect(a.courses).toHaveLength(2);expect(a.courses[0].notes).toBe('Device one');expect(b.courses[0].notes).toBe('Device one');one.stop();two.stop();
});
it('retains offline changes through reload and requires a choice when the same record changed remotely',async()=>{
 const r=remote(),store=new UniversityStore('alice','one');store.save({...emptyUniversity(),courses:[course()]});let state=emptyUniversity();
 let one=new UniversityRepository(store,r.port);one.start(s=>{state=s;});await settle();one.stop();
 r.online(false);one=new UniversityRepository(store,r.port);one.start(s=>{state=s;});one.commit({...state,courses:[{...state.courses[0],notes:'Offline proof'}]});one.stop();
 const old=r.docs.get('courses_a')!;r.docs.set('courses_a',{...old,payload:JSON.stringify({...course(),notes:'Remote proof'}),revision:old.revision+1,mutationId:'remote'});
 r.online(true);let conflicts:string[]=[];const reloaded=new UniversityRepository(store,r.port);reloaded.start((s,status)=>{state=s;conflicts=status.conflicts;});await settle();
 expect(state.courses[0].notes).toBe('Offline proof');expect(conflicts).toEqual(['courses_a']);expect(JSON.parse(r.docs.get('courses_a')!.payload).notes).toBe('Remote proof');
 reloaded.resolve('courses_a','local');await settle();expect(JSON.parse(r.docs.get('courses_a')!.payload).notes).toBe('Offline proof');expect(conflicts).toEqual([]);reloaded.stop();
});
it('propagates deletions and undo as revisions rather than resurrecting missing records after reload',async()=>{
 const r=remote(),store=new UniversityStore('alice','project');store.save({...emptyUniversity(),courses:[course()]});let state:UniversityState=emptyUniversity();
 const repo=new UniversityRepository(store,r.port);repo.start(s=>{state=s;});await settle();repo.commit({...state,courses:[]});await settle();expect(r.docs.get('courses_a')?.deleted).toBe(true);repo.stop();
 const next=new UniversityRepository(store,r.port);next.start(s=>{state=s;});await settle();expect(state.courses).toEqual([]);
 next.commit({...state,courses:[course()]});await settle();expect(r.docs.get('courses_a')?.deleted).toBe(false);next.stop();
});
it('does not mix local caches for different accounts',()=>{
 const a=new UniversityStore('alice','project'),b=new UniversityStore('bob','project');a.saveSync({pending:[['a',{record:{id:'private'}}]]});expect(b.loadSync()).toBeNull();
});
it('keeps a newer local edit made while an earlier write is still in flight',async()=>{
 const r=remote(),store=new UniversityStore('alice','project');let state=emptyUniversity();let release:()=>void=()=>{};let block=true;
 const port:StudyRemote={watch:r.port.watch,async write(key,update){if(block){block=false;await new Promise<void>(resolve=>{release=resolve;});}return r.port.write(key,update);}};
 const repo=new UniversityRepository(store,port);repo.start(s=>{state=s;});repo.commit({...state,courses:[course()]});repo.commit({...state,courses:[{...course(),notes:'Newest edit'}]});release();await settle();await settle();
 expect(JSON.parse(r.docs.get('courses_a')!.payload).notes).toBe('Newest edit');repo.stop();
});
