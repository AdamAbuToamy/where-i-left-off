// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {afterEach,beforeEach,expect,it,vi} from 'vitest';import type {User} from 'firebase/auth';
const api=vi.hoisted(()=>({call:vi.fn(),read:vi.fn(),apply:vi.fn(),undo:vi.fn()}));
vi.mock('../src/lib/pushNotifications',()=>({pushCall:api.call}));
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{uid:'alice'}}}));
vi.mock('../src/assistant/assistantRepository',()=>({AssistantRepository:class{read=api.read;apply=api.apply;undo=api.undo;},assistantContext:()=>'{"study":"account data"}'}));
import AssistantWidget from '../src/assistant/AssistantWidget';import {blankAssistantData} from '../src/assistant/actions';
let element:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();api.read.mockResolvedValue({data:blankAssistantData(),pending:false,raw:new Map()});element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(()=>{act(()=>root.unmount());element.remove();vi.unstubAllGlobals();});
async function input(value:string){const box=element.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(box,value);box.dispatchEvent(new Event('input',{bubbles:true}));});}
async function open(language:'en'|'he'='en'){await act(async()=>root.render(<AssistantWidget user={{uid:'alice'} as User} language={language}/>));await act(async()=>(element.querySelector('button') as HTMLButtonElement).click());}
async function submit(){await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('uses one chat with account context, no mode selector or Wikipedia, and renders output as text',async()=>{
 api.call.mockResolvedValue({text:JSON.stringify({text:'Summary: <script>not executable</script>',actions:[],files:[]})});await open();
 expect(element.querySelector('select')).toBeNull();expect(element.textContent).not.toContain('Wikipedia');
 await input('Summarize my courses');await submit();expect(api.call).toHaveBeenCalledWith(expect.objectContaining({mode:'workspace',context:expect.stringContaining('account data')}),{path:'/assistant',timeout:60000});expect(element.querySelector('script')).toBeNull();expect(element.textContent).toContain('not executable');
});
it('requires review, applies a validated proposal once and supports Hebrew',async()=>{
 api.call.mockResolvedValue({text:JSON.stringify({text:'A new course',actions:[{target:'courses',action:'create',id:'new',values:{name:'Algorithms'}}],files:[]})});api.apply.mockResolvedValue({changes:[],mutations:new Map()});await open('he');await input('Create Algorithms');await submit();expect(api.apply).not.toHaveBeenCalled();expect(element.textContent).not.toMatch(/[\u0600-\u06ff]/);
 const apply=[...element.querySelectorAll('button')].find(b=>b.textContent==='החלת שינויים')!;await act(async()=>apply.click());expect(api.apply).toHaveBeenCalledTimes(1);expect(element.textContent).toContain('השינויים הוחלו');expect(element.textContent).not.toContain('החלת שינויים');
});
it('does not call the model with incomplete data when Firebase read fails',async()=>{
 api.read.mockRejectedValue(new Error('permission-denied'));await open();await input('Summarize');await submit();expect(api.call).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();expect(element.querySelector('[role=alert]')?.textContent).toContain('permission-denied');
});
it('answers a normal question without proposals and distinguishes invalid model format from invalid edit IDs',async()=>{
 api.call.mockResolvedValue({text:'{"text":"Hello"}'});await open();await input('Hi');await submit();expect(element.textContent).toContain('Hello');expect(api.apply).not.toHaveBeenCalled();
 api.call.mockResolvedValue({text:'not JSON'});await input('Again');await submit();expect(element.querySelector('[role=alert]')?.textContent).toContain('assistant-format');expect(api.apply).not.toHaveBeenCalled();
 api.call.mockResolvedValue({text:JSON.stringify({text:'Update',actions:[{target:'courses',action:'update',id:'missing',values:{notes:'New'}}],files:[]})});await input('Edit course');await submit();expect(element.querySelector('[role=alert]')?.textContent).toContain('assistant-invalid');expect(api.apply).not.toHaveBeenCalled();
});
it('previews the screenshot timetable request without calling the remote model, then applies through the repository',async()=>{
 const data=blankAssistantData();data.study.courses=[{id:'actual-course',name:'הנדסת איכות תוכנה',url:'',notes:'',x:0,y:0,requires:[]}];
 api.read.mockResolvedValue({data,pending:false,raw:new Map()});api.apply.mockResolvedValue({changes:[],mutations:new Map()});await open();
 await input('اضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء');await submit();
 expect(api.call).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();expect(element.textContent).toContain('17:00');expect(element.textContent).toContain('18:00');
 const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>button.click());
 expect(api.apply).toHaveBeenCalledWith(expect.objectContaining({data}),[expect.objectContaining({target:'lessons',after:expect.objectContaining({courseId:'actual-course',day:0,start:'17:00',end:'18:00'})})]);
});
it('distinguishes a burst limit, provider quota and failed save confirmation',async()=>{
 await open();
 for(const [code,expected] of [['ai-rate-limit','few seconds'],['ai-provider-limit','AI provider'],['assistant-confirmation','server confirmation']]){
  api.call.mockRejectedValue(new Error(code));await input('Tell me something useful');await submit();expect(element.querySelector('[role=alert]')?.textContent).toContain(expected);
 }
});
it('preserves local-only preference across reloads and never silently sends a request to the cloud',async()=>{
 localStorage.setItem('wilo-assistant-local','true');
 try{await open();await input('Give me advice on studying');await submit();expect(api.call).not.toHaveBeenCalled();expect(element.querySelector('[role=alert]')?.textContent).toContain('not automatically sent');
  const cloud=[...element.querySelectorAll('button')].find(b=>b.textContent==='Use cloud assistant')!;expect(cloud).toBeDefined();await act(async()=>cloud.click());expect(localStorage.getItem('wilo-assistant-local')).toBeNull();
 }finally{localStorage.removeItem('wilo-assistant-local');}
});
it('announces real reading and response phases, then removes the waiting indicator when the reply arrives',async()=>{
 let finishRead!:(value:unknown)=>void,finishReply!:(value:unknown)=>void;
 api.read.mockReturnValue(new Promise(resolve=>{finishRead=resolve;}));api.call.mockReturnValue(new Promise(resolve=>{finishReply=resolve;}));
 await open();await input('Please summarize my notes');await submit();
 expect(element.querySelector('[role=status]')?.textContent).toContain('Reading your data');expect(element.querySelector('[role=dialog]')?.getAttribute('aria-busy')).toBe('true');expect(element.querySelector('progress')).toBeNull();
 await act(async()=>finishRead({data:blankAssistantData(),pending:false,raw:new Map()}));expect(element.querySelector('[role=status]')?.textContent).toContain('Preparing a reply');
 await act(async()=>finishReply({text:'{"text":"Ready","actions":[],"files":[]}'}));expect(element.querySelector('[role=status]')).toBeNull();expect(element.querySelector('[role=dialog]')?.getAttribute('aria-busy')).toBe('false');
});
it('keeps the waiting state until a reviewed change actually finishes saving',async()=>{
 let finishSave!:(value:unknown)=>void;api.apply.mockReturnValue(new Promise(resolve=>{finishSave=resolve;}));
 api.call.mockResolvedValue({text:JSON.stringify({text:'Proposal',actions:[{target:'courses',action:'create',id:'new',values:{name:'Algorithms'}}],files:[]})});
 await open();await input('Please create Algorithms for me');await submit();
 const apply=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>apply.click());
 expect(element.querySelector('[role=status]')?.textContent).toContain('Saving your changes');expect(element.textContent).not.toContain('Changes applied to the site.');
 await act(async()=>finishSave({changes:[],mutations:new Map()}));expect(element.querySelector('[role=status]')).toBeNull();expect(element.textContent).toContain('Changes applied to the site.');
});
it('replaces a fabricated success claim with a visible no-change status and no Apply button',async()=>{
 api.call.mockResolvedValue({text:JSON.stringify({text:'I added 14 classes successfully.',actions:[],files:[]})});await open();await input('Add my requested classes');await submit();
 expect(element.textContent).not.toContain('added 14');expect(element.textContent).toContain('No site changes were made');expect(api.apply).not.toHaveBeenCalled();
});
it('reviews ten mixed site controls, executes them, and reports verified results',async()=>{
 const controls=Array.from({length:10},(_,i)=>({kind:'appearance',values:{theme:i%2?'olive':'ocean'}}));
 api.call.mockResolvedValue({text:JSON.stringify({text:'All changes saved!',actions:[],files:[],controls})});await open();await input('Change my theme ten times as specified');await submit();
 expect(document.documentElement.dataset.theme).not.toBe('olive');expect(element.textContent).not.toContain('All changes saved!');
 const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>button.click());
 expect(api.apply).not.toHaveBeenCalled();expect(localStorage.getItem('site-theme:alice')).toBe('olive');expect(element.textContent).toContain('10 / 10');
});
