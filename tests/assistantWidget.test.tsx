// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {afterEach,beforeEach,expect,it,vi} from 'vitest';import type {User} from 'firebase/auth';
const api=vi.hoisted(()=>({call:vi.fn(),read:vi.fn(),apply:vi.fn(),undo:vi.fn(),load:vi.fn(),dispose:vi.fn(),smoke:vi.fn(),cloud:vi.fn(),cached:vi.fn(),context:vi.fn(),exportFile:vi.fn()}));
vi.mock('../src/assistant/pollinationsClient',()=>({PollinationsAssistant:class{conversation=(payload:unknown)=>api.cloud(payload);workspace=(payload:unknown)=>api.call(payload,60000);}}));
vi.mock('../src/assistant/pollinationsAuth',()=>({pollinationsConnected:()=>true,connectPollinations:vi.fn(),disconnectPollinations:vi.fn()}));
vi.mock('../src/assistant/localModel',()=>({isLocalModelCached:api.cached,LocalAssistantModel:class{load=api.load;smoke=api.smoke;answer=api.call;dispose=api.dispose;}}));
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:{uid:'alice'}},db:null,emulatorMode:true}));
vi.mock('../src/assistant/assistantRepository',()=>({AssistantRepository:class{read=api.read;apply=api.apply;undo=api.undo;},assistantContext:()=>api.context()}));
vi.mock('../src/assistant/pdfExport',()=>({downloadAssistantFile:api.exportFile}));
import {providerReply} from './fixtures/assistantProvider';
import AssistantWidget from '../src/assistant/AssistantWidget';import {blankAssistantData} from '../src/assistant/actions';
let element:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{localStorage.setItem('wilo-assistant-local','false');vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.clearAllMocks();api.context.mockReturnValue('{"study":"account data"}');api.cloud.mockResolvedValue({text:'',needsWorkspace:true});api.read.mockResolvedValue({data:blankAssistantData(),pending:false,raw:new Map()});element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(()=>{localStorage.removeItem('wilo-assistant-local');act(()=>root.unmount());element.remove();vi.unstubAllGlobals();});
async function input(value:string){const box=element.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(box,value);box.dispatchEvent(new Event('input',{bubbles:true}));});}
async function open(language:'en'|'he'='en'){await act(async()=>root.render(<AssistantWidget user={{uid:'alice'} as User} language={language}/>));await act(async()=>(element.querySelector('button') as HTMLButtonElement).click());}
async function submit(){await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('uses one chat with account context, no mode selector or Wikipedia, and renders output as text',async()=>{
 api.call.mockResolvedValue({text:providerReply({text:'Summary: <script>not executable</script>',actions:[],files:[]})});await open();
 expect(element.querySelector('select')).toBeNull();expect(element.textContent).not.toContain('Wikipedia');
 await input('Summarize my courses');await submit();expect(api.call).toHaveBeenCalledWith(expect.objectContaining({mode:'workspace',context:expect.stringContaining('account data')}),60000);expect(JSON.parse(api.call.mock.calls[0][0].context).capabilities.every((c:{detail:string})=>typeof c.detail==='string'&&c.detail.length>30)).toBe(true);expect(element.querySelector('script')).toBeNull();expect(element.textContent).toContain('not executable');
});
it('requires review, applies a validated proposal once and supports Hebrew',async()=>{
 api.call.mockResolvedValue({text:providerReply({text:'A new course',actions:[{target:'courses',action:'create',id:'new',values:{name:'Algorithms'}}],files:[]})});api.apply.mockResolvedValue({changes:[],mutations:new Map()});await open('he');await input('Create Algorithms');await submit();expect(api.apply).not.toHaveBeenCalled();expect(element.textContent).not.toMatch(/[\u0600-\u06ff]/);
 const apply=[...element.querySelectorAll('button')].find(b=>b.textContent==='החלת שינויים')!;await act(async()=>apply.click());expect(api.apply).toHaveBeenCalledTimes(1);expect(element.textContent).toContain('השינויים הוחלו');expect(element.textContent).not.toContain('החלת שינויים');
});
it('does not call the model with incomplete data when Firebase read fails',async()=>{
 api.read.mockRejectedValue(new Error('permission-denied'));await open();await input('Summarize');await submit();expect(api.call).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();expect(element.querySelector('.assistant-message.is-assistant')?.textContent).toContain('permissions');
});
it('answers a normal question without proposals and distinguishes invalid model format from invalid edit IDs',async()=>{
 api.call.mockResolvedValue({text:'{"text":"Hello"}'});await open();await input('What is a summary?');await submit();expect(element.textContent).toContain('Hello');expect(api.apply).not.toHaveBeenCalled();
 vi.useFakeTimers();api.call.mockResolvedValue({text:'not JSON'});await input('Again');await submit();await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});expect(element.querySelectorAll('.assistant-message.is-assistant')[1]?.textContent).toContain('technical issue');expect(api.apply).not.toHaveBeenCalled();
 api.call.mockResolvedValue({text:providerReply({text:'Update',actions:[{target:'courses',action:'update',id:'missing',values:{notes:'New'}}],files:[]})});await input('Edit course');await submit();await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});vi.useRealTimers();expect(element.querySelectorAll('.assistant-message.is-assistant')[2]?.textContent).toContain('failed validation');expect(api.apply).not.toHaveBeenCalled();
});
it('sends the original simple timetable request through AI and applies its validated function arguments',async()=>{
 const data=blankAssistantData();data.study.courses=[{id:'actual-course',name:'הנדסת איכות תוכנה',url:'',notes:'',x:0,y:0,requires:[]}];
 api.read.mockResolvedValue({data,pending:false,raw:new Map()});api.apply.mockResolvedValue({changes:[],mutations:new Map()});api.call.mockResolvedValue({text:providerReply({text:'Review',actions:[{target:'lessons',action:'create',id:'new-session',values:{courseId:'actual-course',day:0,start:'17:00',end:'18:00',sessionType:'lecture',room:''}}]})});await open();
 await input('اضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء');await submit();
 expect(api.call).toHaveBeenCalledTimes(1);expect(api.call.mock.calls[0][0].message).toBe('اضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء');expect(api.apply).not.toHaveBeenCalled();expect(element.textContent).toContain('17:00');expect(element.textContent).toContain('18:00');
 const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>button.click());
 expect(api.apply).toHaveBeenCalledWith(expect.objectContaining({data}),[expect.objectContaining({target:'lessons',after:expect.objectContaining({courseId:'actual-course',day:0,start:'17:00',end:'18:00'})})]);
});
it('distinguishes a burst limit, provider quota and failed save confirmation',async()=>{
 await open();
 for(const [code,expected] of [['ai-rate-limit','Too many requests'],['ai-provider-limit','usage limit'],['assistant-confirmation','confirm the save result']]){
  api.call.mockRejectedValue(new Error(code));await input('Tell me something useful');await submit();expect(element.querySelectorAll('.assistant-message.is-assistant').length).toBeGreaterThan(0);expect(element.textContent).toContain(expected);
 }
});
it('ignores old local-model preferences and answers chat without loading models or reading records',async()=>{
 localStorage.setItem('wilo-assistant-local','true');api.cloud.mockResolvedValueOnce({text:'Hello!',needsWorkspace:false});
 await open();expect(element.querySelector('textarea')?.disabled).toBe(false);expect(api.load).not.toHaveBeenCalled();
 await input('Hello');await submit();expect(element.textContent).toContain('Hello!');expect(api.read).not.toHaveBeenCalled();expect(api.call).not.toHaveBeenCalled();expect(api.load).not.toHaveBeenCalled();
});it('announces real reading and response phases, then removes the waiting indicator when the reply arrives',async()=>{
 let finishRead!:(value:unknown)=>void,finishReply!:(value:unknown)=>void;
 api.read.mockReturnValue(new Promise(resolve=>{finishRead=resolve;}));api.call.mockReturnValue(new Promise(resolve=>{finishReply=resolve;}));
 await open();await input('Please summarize my notes');await submit();
 expect(element.querySelector('[role=status]')?.textContent).toContain('Reading your data');expect(element.querySelector('[role=dialog]')?.getAttribute('aria-busy')).toBe('true');expect(element.querySelector('progress')).toBeNull();
 await act(async()=>finishRead({data:blankAssistantData(),pending:false,raw:new Map()}));expect(element.querySelector('[role=status]')?.textContent).toContain('Preparing a reply');
 await act(async()=>finishReply({text:'{"text":"Ready","actions":[],"files":[]}'}));expect(element.querySelector('[role=status]')).toBeNull();expect(element.querySelector('[role=dialog]')?.getAttribute('aria-busy')).toBe('false');
});
it('keeps the waiting state until a reviewed change actually finishes saving',async()=>{
 let finishSave!:(value:unknown)=>void;api.apply.mockReturnValue(new Promise(resolve=>{finishSave=resolve;}));
 api.call.mockResolvedValue({text:providerReply({text:'Proposal',actions:[{target:'courses',action:'create',id:'new',values:{name:'Algorithms'}}],files:[]})});
 await open();await input('Please create Algorithms for me');await submit();
 const apply=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>apply.click());
 expect(element.querySelector('[role=status]')?.textContent).toContain('Saving your changes');expect(element.textContent).not.toContain('Changes applied to the site.');
 await act(async()=>finishSave({changes:[],mutations:new Map()}));expect(element.querySelector('[role=status]')).toBeNull();expect(element.textContent).toContain('Changes applied to the site.');
});
it('replaces a fabricated success claim with a visible no-change status and no Apply button',async()=>{
 api.call.mockResolvedValue({text:providerReply({text:'I added 14 classes successfully.',actions:[],files:[]})});await open();await input('Add my requested classes');await submit();
 expect(element.textContent).not.toContain('added 14');expect(element.textContent).toContain('No site changes were made');expect(api.apply).not.toHaveBeenCalled();
});
it('reviews ten mixed site controls, executes them, and reports verified results',async()=>{
 const controls=Array.from({length:10},(_,i)=>({kind:'appearance',values:{theme:i%2?'olive':'ocean'}}));
 api.call.mockResolvedValue({text:providerReply({text:'All changes saved!',actions:[],files:[],controls})});await open();await input('Change my theme ten times as specified');await submit();
 expect(document.documentElement.dataset.theme).not.toBe('olive');expect(element.textContent).not.toContain('All changes saved!');
 const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>button.click());
 expect(api.apply).not.toHaveBeenCalled();expect(localStorage.getItem('site-theme:alice')).toBe('olive');expect(element.textContent).toContain('Changes applied to the site.');expect(element.textContent).not.toContain('10 / 10');
});
it('uses cloud AI for non-identical course names without downloading a local model, then previews actual IDs',async()=>{
 const {timetableData,weeklyRequest,expectedSessions}=await import('./fixtures/weeklyTimetable');
 const {courseMatchRequest}=await import('../src/assistant/courseMatching');const data=timetableData();data.study.courses=data.study.courses.map(c=>({...c,name:'2026 / '+c.name+' — סמסטר א'}));
 const matching=courseMatchRequest(weeklyRequest,data,'en')!;expect(matching.requested).toHaveLength(6);api.read.mockResolvedValue({data,pending:false,raw:new Map()});
 api.call.mockResolvedValue({text:providerReply({text:'Review',actions:expectedSessions.map((values,i)=>({target:'lessons',action:'create',id:'new-'+i,values})),files:[]})});
 await open();await input(weeklyRequest);await submit();
 expect(api.call).toHaveBeenCalledWith(expect.objectContaining({mode:'workspace',message:weeklyRequest}),60000);
 expect(element.querySelectorAll('.assistant-proposal details')).toHaveLength(14);expect(api.apply).not.toHaveBeenCalled();
 api.apply.mockResolvedValue({changes:[],mutations:new Map()});const button=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;await act(async()=>button.click());
 expect(api.apply.mock.calls[0][1].map((c:{after:unknown})=>c.after)).toEqual(expectedSessions.map(s=>expect.objectContaining(s)));
});
it('keeps the entire mixed request for cloud planning instead of silently handling only timetable rows',async()=>{
 const message='Add to the timetable:\nSunday\n11:00–13:00 | Networks | Lecture\nThen create a card and summarize my notes';
 api.call.mockResolvedValue({text:providerReply({text:'Review',actions:[{target:'courses',action:'create',id:'c',values:{name:'Networks'}},{target:'lessons',action:'create',id:'l',values:{courseId:'c',day:0,start:'11:00',end:'13:00'}},{target:'projects',action:'create',id:'p',values:{name:'Read notes'}}],files:[{name:'notes.txt',content:'Summary of the supplied notes.'}]})});
 await open();await input(message);await submit();expect(api.call).toHaveBeenCalledWith(expect.objectContaining({mode:'workspace',message}),60000);expect(element.querySelectorAll('.assistant-proposal details')).toHaveLength(3);expect(element.textContent).toContain('notes.txt');expect(api.apply).not.toHaveBeenCalled();
});

it('checks actual account reads and provider inference before reporting a healthy connection',async()=>{
 api.call.mockRejectedValueOnce(new Error('assistant-invalid'));await open();await input('Add a card');await submit();
 const check=[...element.querySelectorAll('button')].find(b=>b.textContent==='Check assistant connection')!;
 api.cloud.mockResolvedValueOnce({text:'OK',needsWorkspace:false});await act(async()=>check.click());expect(api.read).toHaveBeenCalledTimes(2);expect(api.cloud).toHaveBeenCalledTimes(2);expect(element.textContent).toContain('Account reads and the assistant connection are working.');expect(api.apply).not.toHaveBeenCalled();
});it('keeps ordinary replies free of role labels, task ledgers and no-change notices; closing restores the workspace',async()=>{
 api.call.mockResolvedValue({text:JSON.stringify({text:'Happy to help!',actions:[],controls:[],files:[],tasks:[{title:'Reply to kindness',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:'Respond to the greeting'}]})});
 await open();expect(document.body.classList.contains('assistant-docked')).toBe(true);
 await input('Thank you!');await submit();
 expect(element.querySelector('.assistant-message-author')).toBeNull();expect(element.querySelector('.assistant-message.is-assistant')?.textContent).toBe('Happy to help!');
 const close=element.querySelector<HTMLButtonElement>('.assistant-close')!;await act(async()=>close.click());expect(document.body.classList.contains('assistant-docked')).toBe(false);
});
it('asks for missing details and retains the entire follow-up conversation before offering Apply',async()=>{
 const clarify=(text:string)=>JSON.stringify({text,actions:[],controls:[],files:[],tasks:[{title:'Create card',outcome:'needs-input',actionIndexes:[],controlIndexes:[],detail:text}]});
 api.call.mockResolvedValueOnce({text:clarify('What should I call the card?')}).mockResolvedValueOnce({text:clarify('A date, section, notes or link? You can skip them.')}).mockResolvedValueOnce({text:clarify('Which section?')}).mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'projects',action:'create',id:'new',scope:'personal',values:{name:'Algorithms',description:'Read chapter 1'}}],files:[]})});
 await open();await input('Add a card');await submit();expect(element.querySelector('.assistant-proposal')).toBeNull();expect(element.textContent).toContain('What should I call the card?');
 await input('Algorithms');await submit();expect(element.querySelector('.assistant-proposal')).toBeNull();await input('No date');await submit();await input('No section; note Read chapter 1');await submit();
 const last=api.call.mock.calls.at(-1)![0];expect(last.history).toHaveLength(6);expect(last.history[0].content).toBe('Add a card');expect(last.history[2].content).toBe('Algorithms');expect(last.history[4].content).toBe('No date');expect(api.apply).not.toHaveBeenCalled();expect(element.querySelector('.assistant-proposal')).not.toBeNull();
});
it('offers a clear skip-extras choice and continues the same draft without creating anything early',async()=>{
 api.call.mockResolvedValueOnce({text:JSON.stringify({text:'For Algorithms, a date, section, notes or link?',actions:[],files:[],controls:[],clarification:{kind:'creation-details',target:'projects',scope:'personal',name:'Algorithms'},tasks:[{title:'Create Algorithms',outcome:'needs-input',actionIndexes:[],controlIndexes:[],detail:'Choose or skip extras'}]})}).mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'projects',action:'create',id:'new',values:{name:'Algorithms',sectionId:'',dueDate:'',description:'',projectUrl:''}}]})});
 await open();await input('Create Algorithms');await submit();expect(api.apply).not.toHaveBeenCalled();
 const skip=[...element.querySelectorAll('button')].find(b=>b.textContent==='No extras')!;expect(skip).toBeDefined();await act(async()=>skip.click());
 expect(api.call.mock.calls[1][0].message).toBe('No extras');expect(api.call.mock.calls[1][0].history.some((turn:{content:string})=>turn.content.includes('creation-details'))).toBe(true);expect(api.apply).not.toHaveBeenCalled();expect(element.querySelectorAll('.assistant-proposal')).toHaveLength(1);
});

it('offers cloud chat on first visit without any model download',async()=>{
 localStorage.removeItem('wilo-assistant-local');api.cloud.mockResolvedValueOnce({text:'Welcome',needsWorkspace:false});await open();
 expect(element.querySelector('[data-local-activation]')).toBeNull();await input('مرحبا');await submit();expect(api.read).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();expect(api.load).not.toHaveBeenCalled();
});it('sends follow-up requests and confirmed references to the model instead of matching fixed phrases',async()=>{
 const data=blankAssistantData();
 api.read.mockImplementation(async()=>({data:structuredClone(data),pending:false,raw:new Map()}));
 api.call.mockResolvedValue({text:providerReply({text:'Review',actions:[
  {target:'sections',action:'create',id:'new-section',scope:'personal',values:{name:'Section A'}},
  {target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'Card A',sectionId:'new-section',dueDate:'2026-10-26'}}
 ],files:[]})});
 api.apply.mockImplementation(async(_snapshot,changes)=>{
  for(const c of changes){if(c.target==='projects')data.scopes[0].projects.push(c.after);if(c.target==='sections')data.scopes[0].sections.push(c.after);}
  return {changes,mutations:new Map()};
 });
 await open();await input('Create a card Card A in new section Section A for October 26, 2026');await submit();
 const apply=[...element.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!;
 await act(async()=>apply.click());
 expect(data.scopes[0].projects).toHaveLength(1);expect(data.scopes[0].sections).toHaveLength(1);
 api.call.mockResolvedValue({text:providerReply({text:'Review removal',actions:[
  {target:'projects',action:'trash',scope:'personal',id:data.scopes[0].projects[0].id,values:{}},
  {target:'sections',action:'delete',scope:'personal',id:data.scopes[0].sections[0].id,values:{}}
 ],files:[]})});
 await input('delete them');await submit();
 expect(JSON.stringify(api.call.mock.calls[1][0].history)).toContain(data.scopes[0].projects[0].id);
 expect(api.call).toHaveBeenCalledTimes(2);expect(api.apply).toHaveBeenCalledTimes(1);
 expect(element.querySelectorAll('.assistant-proposal details')).toHaveLength(2);
});

it('never restores an installed local model when opening the cloud assistant',async()=>{
 api.cached.mockResolvedValueOnce(true);localStorage.setItem('wilo-assistant-local','true');await open();expect(api.cached).not.toHaveBeenCalled();expect(api.load).not.toHaveBeenCalled();
});
it('offers reconnection after an expired provider credential without reading or writing account data',async()=>{
 api.cloud.mockRejectedValueOnce(new Error('ai-provider-access'));await open();await input('Hello');await submit();
 expect(element.textContent).toContain('Reconnect your assistant account');expect([...element.querySelectorAll('button')].some(b=>b.textContent==='Connect assistant')).toBe(true);expect(api.read).not.toHaveBeenCalled();expect(api.apply).not.toHaveBeenCalled();
});
it('retries the original failed request with one click without applying any changes',async()=>{
 api.cloud.mockRejectedValueOnce(new Error('assistant-network')).mockResolvedValueOnce({text:'Hello again',needsWorkspace:false});await open();await input('Hello');await submit();
 const retry=[...element.querySelectorAll('button')].find(b=>b.textContent==='Try again')!;expect(retry).toBeDefined();await act(async()=>retry.click());expect(api.cloud).toHaveBeenCalledTimes(2);expect(api.cloud.mock.calls[1][0].message).toBe('Hello');expect(element.textContent).toContain('Hello again');expect(api.apply).not.toHaveBeenCalled();
});
it('keeps an unsaved card across why/clarification and supersedes it only when the completed replacement draft arrives',async()=>{
 const original='اضف بطاقة عمار لقسم ادم مع ملاحظة مروان ورابط https://example.test/video وضع البطاقة بتاريخ 28 الشهر';
 api.call.mockResolvedValueOnce({text:providerReply({text:'Review',actions:[{target:'projects',action:'create',id:'new-card',values:{name:'عمار',description:'مروان',projectUrl:'https://example.test/video',dueDate:'2026-10-28'}}],files:[]})});
 await open();await input(original);await submit();expect([...element.querySelectorAll('button')].filter(b=>b.textContent==='Apply changes')).toHaveLength(1);
 api.call.mockResolvedValueOnce({text:providerReply({text:'Section Adam is missing. Create it?',actions:[],files:[]})});await input('لماذا لم تضعها في قسم ادم؟');await submit();
 expect([...element.querySelectorAll('button')].filter(b=>b.textContent==='Apply changes')).toHaveLength(1);
 api.call.mockResolvedValueOnce({text:providerReply({text:'Review complete',actions:[{target:'sections',action:'create',id:'new-section',values:{name:'ادم'}},{target:'projects',action:'create',id:'new-card',values:{name:'عمار',description:'مروان',projectUrl:'https://example.test/video',dueDate:'2026-10-28',sectionId:'new-section'}}],files:[]})});
 await input('قسم جديد باسم ادم ضع فيه البطاقة بالتفاصيل التي طلبتها منك');await submit();
 const history=api.call.mock.calls[2][0].history;expect(history[0].content).toBe(original);expect(JSON.stringify(history)).toContain('مروان');expect(JSON.stringify(history)).toContain('https://example.test/video');expect(JSON.stringify(history)).toContain('2026-10-28');expect([...element.querySelectorAll('button')].filter(b=>b.textContent==='Apply changes')).toHaveLength(1);expect(api.apply).not.toHaveBeenCalled();
});it('sends a large local snapshot through paged workspace inference without rejecting it',async()=>{
 api.context.mockReturnValue(JSON.stringify({study:{courses:[{id:'large-course',source:{description:'x'.repeat(200000)}}]}}));
 api.call.mockResolvedValue({text:providerReply({text:'Your courses summary',actions:[],files:[]})});
 await open();await input('Summarize my courses');await submit();
 expect(api.call).toHaveBeenCalledTimes(1);expect(element.textContent).toContain('Your courses summary');expect(api.apply).not.toHaveBeenCalled();
});it('downloads the requested PDF through the renderer without applying database changes',async()=>{
 api.call.mockResolvedValue({text:providerReply({text:'PDF ready',actions:[],files:[{name:'courses.pdf',content:'# Courses'}]})});
 await open();await input('give me pdf of all my courses');await submit();
 const download=[...element.querySelectorAll('button')].find(b=>b.textContent?.includes('courses.pdf'))!;
 expect(download).toBeTruthy();await act(async()=>download.click());
 expect(api.exportFile).toHaveBeenCalledWith({name:'courses.pdf',content:'# Courses'},'en');expect(api.apply).not.toHaveBeenCalled();
});
it('suggestions fill the composer without sending a request',async()=>{
 await open();const suggestion=element.querySelector<HTMLButtonElement>('.assistant-suggestions button')!;await act(async()=>suggestion.click());
 expect(element.querySelector('textarea')!.value).toBe('Summarize my courses');expect(api.cloud).not.toHaveBeenCalled();
});
it('stops a pending request and ignores a late provider reply without applying anything',async()=>{
 let finish!:(value:unknown)=>void;api.cloud.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await open();await input('Create a card');await submit();
 const stop=element.querySelector<HTMLButtonElement>('.assistant-stop')!;expect(stop).toBeTruthy();await act(async()=>stop.click());
 expect(element.textContent).toContain('Request stopped');expect(element.querySelector('.assistant-waiting')).toBeNull();
 await act(async()=>finish({text:'Late reply must not appear',needsWorkspace:false}));
 expect(element.textContent).not.toContain('Late reply must not appear');expect(api.apply).not.toHaveBeenCalled();
});
it('renders readable Markdown and tables while blocking HTML and remote images',async()=>{
 api.cloud.mockResolvedValue({text:'## Course overview\n\n**Math**\n\n| Course | Date |\n| --- | --- |\n| Math | 28 Oct |\n\n![remote](https://example.test/tracker.png)\n\n<script>alert(1)</script>',needsWorkspace:false});
 await open();await input('Summary');await submit();
 expect(element.querySelector('.assistant-rich-text h2')?.textContent).toBe('Course overview');expect(element.querySelector('.assistant-rich-text strong')?.textContent).toBe('Math');
 expect(element.querySelector('.assistant-rich-text table')).toBeTruthy();expect(element.querySelector('script')).toBeNull();expect(element.querySelector('img')).toBeNull();
});
