// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';
import {readFileSync,writeFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';import type {User} from 'firebase/auth';
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:'acceptance'}},call:vi.fn()}));
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db;},auth:runtime.auth}));
vi.mock('../src/assistant/api',()=>({assistantRequest:runtime.call}));
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class{read=async()=>({projects:[],sections:[],operations:[]});}}));
import {providerReply} from './fixtures/assistantProvider';
import AssistantWidget from '../src/assistant/AssistantWidget';import {AssistantRepository} from '../src/assistant/assistantRepository';
let env:RulesTestEnvironment;
beforeAll(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 env=await initializeTestEnvironment({projectId:'demo-assistant-acceptance',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();runtime.db=env.authenticatedContext('acceptance',{email_verified:true}).firestore();
 runtime.call.mockRejectedValue(new Error('Unexpected provider call in this fixture'));
});
afterAll(async()=>{await env?.cleanup();vi.unstubAllGlobals();});
it('persists injected provider proposals through the actual chat Apply button and verifies server data, with timings',async()=>{
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element),repo=new AssistantRepository('acceptance');
 const timings:{task:string;proposalMs:number;saveAndReadMs:number}[]=[];
 try{
  await act(async()=>root.render(<AssistantWidget user={{uid:'acceptance'} as User} language="ar"/>));await act(async()=>(element.querySelector('button') as HTMLButtonElement).click());
  async function idle(){
   const deadline=Date.now()+10000;
   while(element.querySelector('.assistant-actions button')?.textContent==='جارٍ المعالجة…'){
    if(Date.now()>deadline)throw new Error('Chat did not finish within ten seconds on the local emulator');
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
   }
  }
  async function run(message:string,verify:(data:Awaited<ReturnType<AssistantRepository['read']>>['data'])=>void){
   const start=performance.now();const box=element.querySelector('textarea')!;
   await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(box,message);box.dispatchEvent(new Event('input',{bubbles:true}));});
   await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   await idle();expect(element.querySelector('[role=alert]')).toBeNull();expect(runtime.call).toHaveBeenLastCalledWith(expect.objectContaining({mode:'workspace',message}),60000);
   const buttons=[...element.querySelectorAll('button')].filter(b=>b.textContent==='تطبيق التغييرات');expect(buttons).toHaveLength(1);
   const proposalMs=performance.now()-start,saveStart=performance.now();await act(async()=>buttons[0].click());await idle();
   expect(element.querySelector('[role=alert]')).toBeNull();expect(element.textContent).toContain('تم تطبيق التغييرات في الموقع.');
   const saved=await repo.read();verify(saved.data);timings.push({task:message,proposalMs:Math.round(proposalMs),saveAndReadMs:Math.round(performance.now()-saveStart)});
  }
  runtime.call.mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'courses',action:'create',id:'new-course',values:{name:'Algorithms'}}]})});
  await run('انشئ كورس باسم Algorithms',data=>expect(data.study.courses[0].name).toBe('Algorithms'));
  runtime.call.mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'lessons',action:'create',id:'new-class',values:{courseId:(await repo.read()).data.study.courses[0].id,day:0,start:'17:00',end:'18:00',sessionType:'lecture',room:''}}]})});
  await run('اضف الكورس اللي عندي الى البرنامج يوم احد من الخمسة للستة مساء',data=>expect(data.study.lessons).toEqual([expect.objectContaining({day:0,start:'17:00',end:'18:00',courseId:data.study.courses[0].id})]));
  runtime.call.mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'مراجعة الخوارزميات',nextStep:'حل تمرينين'}}]})});
  await run('أنشئ بطاقة باسم مراجعة الخوارزميات والخطوة القادمة حل تمرينين',data=>expect(data.scopes[0].projects[0]).toMatchObject({name:'مراجعة الخوارزميات',nextStep:'حل تمرينين'}));
  runtime.call.mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'projects',action:'update',id:(await repo.read()).data.scopes[0].projects[0].id,scope:'personal',values:{nextStep:'حل خمسة تمارين'}}]})});
  await run('عدل بطاقة مراجعة الخوارزميات الخطوة القادمة حل خمسة تمارين',data=>expect(data.scopes[0].projects[0].nextStep).toBe('حل خمسة تمارين'));
  expect(runtime.call).toHaveBeenCalledTimes(4);
  writeFileSync('/tmp/wilo-task-benchmark.json',JSON.stringify({environment:'jsdom chat UI + real local Firestore emulator; injected provider responses; no model inference or production network',tasks:timings},null,2));
  console.info('assistant.task.acceptance',timings.map(t=>({proposalMs:t.proposalMs,saveAndReadMs:t.saveAndReadMs})));
 }finally{await act(async()=>root.unmount());element.remove();}
},30000);
it('imports all fourteen real requested classes through Apply, remounts chat and reads persisted data without duplicates',async()=>{
 const {weeklyRequest,timetableData,expectedSessions}=await import('./fixtures/weeklyTimetable');
 const {planAssistantChanges}=await import('../src/assistant/actions');
 await env.clearFirestore();localStorage.clear();
 const repo=new AssistantRepository('acceptance');const snapshot=await repo.read();
 const data=timetableData();
 const receipt=await repo.apply(snapshot,planAssistantChanges(snapshot.data,data.study.courses.map(c=>({target:'courses' as const,action:'create' as const,id:c.id,values:{name:c.name}}))));
 const actual=await repo.read();const ids=new Map(actual.data.study.courses.map(c=>[c.name,c.id]));
 const element=document.createElement('div');document.body.append(element);let root=createRoot(element);
 async function mount(){await act(async()=>root.render(<AssistantWidget user={{uid:'acceptance'} as User} language="ar"/>));await act(async()=>(element.querySelector('button') as HTMLButtonElement).click());}
 async function idle(){const deadline=Date.now()+15000;while(element.querySelector('[role=dialog]')?.getAttribute('aria-busy')==='true'){if(Date.now()>deadline)throw new Error('Timed out saving timetable');await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});}}
 runtime.call.mockImplementation(async()=>({text:providerReply({text:'Review',actions:(await repo.read()).data.study.lessons.length?[]:expectedSessions.map((values,i)=>({target:'lessons',action:'create',id:'new-'+i,values:{...values,courseId:ids.get(data.study.courses.find(c=>c.id===values.courseId)!.name)}}))})}));
 async function ask(){const box=element.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(box,weeklyRequest);box.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await idle();}
 try{
  await mount();await ask();expect(element.querySelector('[role=alert]')).toBeNull();expect(element.querySelectorAll('.assistant-proposal details')).toHaveLength(14);
  expect((await repo.read()).data.study.lessons.filter(l=>[...ids.values()].includes(l.courseId))).toHaveLength(0);
  const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='تطبيق التغييرات')!;await act(async()=>button.click());await idle();
  expect(element.querySelector('[role=alert]')).toBeNull();expect(element.textContent).toContain('الحصص التي أُضيفت وحُفظت: 14');
  await act(async()=>root.unmount());root=createRoot(element);await mount();
  const saved=await new AssistantRepository('acceptance').read();
  const classes=saved.data.study.lessons.filter(l=>receipt.changes.some(c=>c.id===l.courseId));
  expect(classes.map(({courseId,day,start,end,sessionType,room,notes})=>({courseId,day,start,end,sessionType,room,...(notes?{notes}:{})}))).toEqual(expect.arrayContaining(expectedSessions.map(s=>({...s,courseId:ids.get(data.study.courses.find(c=>c.id===s.courseId)!.name)}))));expect(classes).toHaveLength(14);
  await ask();expect(element.querySelector('.assistant-proposal')).toBeNull();expect((await repo.read()).data.study.lessons.filter(l=>receipt.changes.some(c=>c.id===l.courseId))).toHaveLength(14);
 }finally{await act(async()=>root.unmount());element.remove();}
},45000);
