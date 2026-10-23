// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';
import {readFileSync,writeFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';import type {User} from 'firebase/auth';
const runtime=vi.hoisted(()=>({db:null as unknown,auth:{currentUser:{uid:'acceptance'}},call:vi.fn()}));
vi.mock('../src/lib/firebase',()=>({get db(){return runtime.db;},auth:runtime.auth}));
vi.mock('../src/lib/pushNotifications',()=>({pushCall:runtime.call}));
vi.mock('../src/lib/indexedDbWorkspaceStore',()=>({IndexedDbWorkspaceStore:class{read=async()=>({projects:[],sections:[],operations:[]});}}));
import AssistantWidget from '../src/assistant/AssistantWidget';import {AssistantRepository} from '../src/assistant/assistantRepository';
let env:RulesTestEnvironment;
beforeAll(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 env=await initializeTestEnvironment({projectId:'demo-assistant-acceptance',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();runtime.db=env.authenticatedContext('acceptance',{email_verified:true}).firestore();
 runtime.call.mockRejectedValue(new Error('Model must not be needed for these clear tasks'));
});
afterAll(async()=>{await env?.cleanup();vi.unstubAllGlobals();});
it('accepts natural-language tasks through the actual chat Apply button and verifies server data, with timings',async()=>{
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
   await idle();expect(element.querySelector('[role=alert]')).toBeNull();
   const buttons=[...element.querySelectorAll('button')].filter(b=>b.textContent==='تطبيق التغييرات');expect(buttons).toHaveLength(1);
   const proposalMs=performance.now()-start,saveStart=performance.now();await act(async()=>buttons[0].click());await idle();
   expect(element.querySelector('[role=alert]')).toBeNull();expect(element.textContent).toContain('تم تطبيق التغييرات في الموقع.');
   const saved=await repo.read();verify(saved.data);timings.push({task:message,proposalMs:Math.round(proposalMs),saveAndReadMs:Math.round(performance.now()-saveStart)});
  }
  await run('انشئ كورس باسم Algorithms',data=>expect(data.study.courses[0].name).toBe('Algorithms'));
  await run('اضف الكورس اللي عندي الى البرنامج يوم احد من الخمسة للستة مساء',data=>expect(data.study.lessons).toEqual([expect.objectContaining({day:0,start:'17:00',end:'18:00',courseId:data.study.courses[0].id})]));
  await run('أنشئ بطاقة باسم مراجعة الخوارزميات والخطوة القادمة حل تمرينين',data=>expect(data.scopes[0].projects[0]).toMatchObject({name:'مراجعة الخوارزميات',nextStep:'حل تمرينين'}));
  await run('عدل بطاقة مراجعة الخوارزميات الخطوة القادمة حل خمسة تمارين',data=>expect(data.scopes[0].projects[0].nextStep).toBe('حل خمسة تمارين'));
  expect(runtime.call).not.toHaveBeenCalled();
  writeFileSync('/tmp/wilo-task-benchmark.json',JSON.stringify({environment:'jsdom chat UI + real local Firestore emulator; no model inference or production network',tasks:timings},null,2));
  console.info('assistant.task.acceptance',timings.map(t=>({proposalMs:t.proposalMs,saveAndReadMs:t.saveAndReadMs})));
 }finally{await act(async()=>root.unmount());element.remove();}
},30000);
