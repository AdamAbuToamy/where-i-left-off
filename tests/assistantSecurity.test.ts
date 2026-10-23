import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:'alice'}}}));
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db;},auth:runtime.auth}));
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class{read=async()=>({projects:[],sections:[],operations:[]});}}));
import {AssistantRepository} from '../src/assistant/assistantRepository';
import {quickAssistantReply} from '../src/assistant/quickActions';
import {planAssistantChanges} from '../src/assistant/actions';
let env:RulesTestEnvironment;
const storage=new Map<string,string>();
beforeAll(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-assistant-security',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v)});vi.stubGlobal('window',{dispatchEvent:()=>true});
});
beforeEach(async()=>{
 await env.clearFirestore();storage.clear();runtime.auth.currentUser={uid:'alice'};runtime.db=env.authenticatedContext('alice',{email_verified:true}).firestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  for(const id of ['a','b'])await setDoc(doc(ctx.firestore(),`users/alice/studyRecords/courses_${id}`),{kind:'courses',id,payload:JSON.stringify({id,name:id,url:'',notes:'keep',requires:[],x:0,y:0}),deleted:false,revision:0,mutationId:'initial',updatedAt:serverTimestamp()});
 });
});
afterAll(async()=>{vi.unstubAllGlobals();await env?.cleanup();});
it('reads only the current account and applies then undoes a prerequisite link with revisions',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();expect(snapshot.data.study.courses).toHaveLength(2);
 const changes=planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'b',values:{requires:['a']}}]);const receipt=await repository.apply(snapshot,changes);
 let saved=(await getDoc(doc(runtime.db as never,'users/alice/studyRecords/courses_b'))).data()!;expect(JSON.parse(saved.payload).requires).toEqual(['a']);expect(saved.revision).toBe(1);
 await repository.undo(receipt);saved=(await getDoc(doc(runtime.db as never,'users/alice/studyRecords/courses_b'))).data()!;expect(JSON.parse(saved.payload).requires).toEqual([]);expect(saved.revision).toBe(2);
});
it('rejects a stale proposal without writing any part of its changes',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();const changes=planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'b',values:{requires:['a']}},{target:'courses',action:'update',id:'a',values:{notes:'AI'}}]);
 const ref=doc(runtime.db as never,'users/alice/studyRecords/courses_b'),old=(await getDoc(ref)).data()!;await setDoc(ref,{...old,revision:1,mutationId:'other',updatedAt:serverTimestamp()});
 await expect(repository.apply(snapshot,changes)).rejects.toThrow('assistant-conflict');const a=(await getDoc(doc(runtime.db as never,'users/alice/studyRecords/courses_a'))).data()!;expect(JSON.parse(a.payload).notes).toBe('keep');
});
it('checks account identity and refuses unsynced edits before writes',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read(),changes=planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'b',values:{requires:['a']}}]);
 snapshot.pending=true;await expect(repository.apply(snapshot,changes)).rejects.toThrow('assistant-pending');runtime.auth.currentUser={uid:'bob'};await expect(repository.read()).rejects.toThrow('account-changed');
});
it('does not undo over a subsequent manual edit',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();const receipt=await repository.apply(snapshot,planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'a',values:{notes:'AI'}}]));
 const ref=doc(runtime.db as never,'users/alice/studyRecords/courses_a'),old=(await getDoc(ref)).data()!;await setDoc(ref,{...old,payload:JSON.stringify({...JSON.parse(old.payload),notes:'Manual'}),revision:2,mutationId:'manual',updatedAt:serverTimestamp()});
 await expect(repository.undo(receipt)).rejects.toThrow('assistant-conflict');expect(JSON.parse((await getDoc(ref)).data()!.payload).notes).toBe('Manual');
});
it('group role denial rolls back personal edits in the same transaction',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await setDoc(doc(db,'groups/g'),{ownerUid:'bob',name:'Group'});await setDoc(doc(db,'groups/g/members/alice'),{role:'member'});await setDoc(doc(db,'users/alice/groupMemberships/g'),{groupName:'Group',role:'member'});await setDoc(doc(db,'groups/g/projects/card'),{name:'Card',nextStep:'',status:'active',rank:0,revision:0,updatedAt:serverTimestamp()});
 });
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();const changes=planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'a',values:{notes:'AI'}},{target:'projects',action:'update',scope:'g',id:'card',values:{name:'Forbidden rename'}}]);
 await expect(repository.apply(snapshot,changes)).rejects.toThrow();expect(JSON.parse((await getDoc(doc(runtime.db as never,'users/alice/studyRecords/courses_a'))).data()!.payload).notes).toBe('keep');
});

it('persists a quick timetable proposal in real Firestore and undoes it with the same guarded repository',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();
 const reply=quickAssistantReply('Add a to the timetable on Sunday from 5 to 6 pm',snapshot.data,'en')!;
 const changes=planAssistantChanges(snapshot.data,reply.actions),receipt=await repository.apply(snapshot,changes);
 const saved=await repository.read();expect(saved.data.study.lessons).toEqual([expect.objectContaining({courseId:'a',day:0,start:'17:00',end:'18:00'})]);
 await repository.undo(receipt);expect((await repository.read()).data.study.lessons).toEqual([]);
});
it('compares a baseline by values, even when Firestore map keys arrive in a different order',async()=>{
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();
 for(const [key,value] of snapshot.raw)snapshot.raw.set(key,Object.fromEntries(Object.entries(value).reverse()));
 await repository.apply(snapshot,planAssistantChanges(snapshot.data,[{target:'courses',action:'update',id:'a',values:{notes:'Reordered map'}}]));
 expect((await repository.read()).data.study.courses.find(c=>c.id==='a')?.notes).toBe('Reordered map');
});
it('updates a permitted group member card without introducing unchanged legacy defaults',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await setDoc(doc(db,'groups/g'),{ownerUid:'bob',name:'Group'});await setDoc(doc(db,'groups/g/members/alice'),{role:'member'});await setDoc(doc(db,'users/alice/groupMemberships/g'),{groupName:'Group',role:'member'});await setDoc(doc(db,'groups/g/projects/card'),{name:'Legacy card',nextStep:'Old',assignedTo:'alice',status:'active',rank:0,revision:0,updatedAt:serverTimestamp()});
 });
 const repository=new AssistantRepository('alice'),snapshot=await repository.read();
 await repository.apply(snapshot,planAssistantChanges(snapshot.data,[{target:'projects',action:'update',scope:'g',id:'card',values:{nextStep:'New'}}]));
 expect((await getDoc(doc(runtime.db as never,'groups/g/projects/card'))).data()?.nextStep).toBe('New');
});
it('creates and edits actual personal cards and courses with timetable sessions, then reads persisted results',async()=>{
 const repository=new AssistantRepository('alice');let snapshot=await repository.read();
 const changes=planAssistantChanges(snapshot.data,[{target:'projects',action:'create',id:'new-card',values:{name:'Review graphs',nextStep:'Read two pages'}},{target:'courses',action:'create',id:'new-course',values:{name:'Algorithms'}},{target:'lessons',action:'create',id:'new-lesson',values:{courseId:'new-course',day:0,start:'17:00',end:'18:00'}}]);
 await repository.apply(snapshot,changes);snapshot=await repository.read();
 const card=snapshot.data.scopes[0].projects.find(c=>c.name==='Review graphs')!,course=snapshot.data.study.courses.find(c=>c.name==='Algorithms')!,lesson=snapshot.data.study.lessons.find(l=>l.courseId===course.id)!;
 expect(card.nextStep).toBe('Read two pages');expect(lesson.start).toBe('17:00');
 await repository.apply(snapshot,planAssistantChanges(snapshot.data,[{target:'projects',action:'update',id:card.id,values:{name:'Review trees',nextStep:'Solve three problems'}},{target:'courses',action:'update',id:course.id,values:{notes:'Midterm revision'}},{target:'lessons',action:'update',id:lesson.id,values:{start:'18:00',end:'19:00',room:'104'}}]));
 const saved=await repository.read();expect(saved.data.scopes[0].projects.find(c=>c.id===card.id)).toMatchObject({name:'Review trees',nextStep:'Solve three problems'});expect(saved.data.study.lessons.find(l=>l.id===lesson.id)).toMatchObject({start:'18:00',end:'19:00',room:'104'});expect(saved.data.study.courses.find(c=>c.id===course.id)?.notes).toBe('Midterm revision');
});
