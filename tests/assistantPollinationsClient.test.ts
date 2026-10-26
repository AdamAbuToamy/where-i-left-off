import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/assistant/pollinationsAuth',()=>({pollinationsKey:(uid:string)=>'synthetic-'+uid}));
import {PollinationsAssistant} from '../src/assistant/pollinationsClient';
import {validateWorkspaceReply} from '../src/assistant/workspaceValidation';
import {blankAssistantData} from '../src/assistant/actions';
afterEach(()=>vi.unstubAllGlobals());
it('uses the signed-in user key and optional tools for normal chat',async()=>{
 const fetch=vi.fn(async(url,init)=>{expect(url).toBe('https://gen.pollinations.ai/v1/chat/completions');expect(init.headers.Authorization).toBe('Bearer synthetic-alice');const body=JSON.parse(init.body);expect(body.tool_choice).toBe('auto');expect(body.reasoning_effort).toBe('none');return Response.json({choices:[{message:{content:'مرحباً'}}]});});vi.stubGlobal('fetch',fetch);
 expect(await new PollinationsAssistant('alice').conversation({message:'مرحبا',language:'ar',history:[]})).toEqual({text:'مرحباً',needsWorkspace:false});expect(fetch).toHaveBeenCalledTimes(1);
});
it('a provider catalog call with optional empty filters returns sections and a creation without an alias reaches the actual app planner',async()=>{
 const data=blankAssistantData();data.scopes[0].sections=[{id:'adam-section',name:'ادم'}];
 let turn=0;vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
  const body=JSON.parse(init.body);expect(init.headers.Authorization).toBe('Bearer synthetic-alice');
  if(++turn===1)return Response.json({choices:[{message:{tool_calls:[{id:'read',type:'function',function:{name:'read_workspace',arguments:JSON.stringify({requests:[{target:'sections',view:'catalog',ids:[],fields:[],query:''}]})}}]}}]});
  expect(JSON.parse(body.messages.at(-1).content).results[0].items).toEqual([{id:'adam-section',name:'ادم'}]);
  return Response.json({choices:[{message:{tool_calls:[{id:'propose',type:'function',function:{name:'create_card',arguments:JSON.stringify({name:'عمار',sectionId:'adam-section',description:'مروان',dueDate:'2026-10-27'})}}]}}]});
 }));
 const message='اضف بطاقة عمار لقسم ادم مع ملاحظة مروان بتاريخ 27 الشهر';const result=await new PollinationsAssistant('alice').workspace({message,language:'ar',context:JSON.stringify(data),history:[]});
 const {changes}=validateWorkspaceReply(message,data,result.text);expect(turn).toBe(2);expect(changes).toHaveLength(1);expect(changes[0].after).toMatchObject({name:'عمار',sectionId:'adam-section',description:'مروان',dueDate:'2026-10-27'});
});
it('retries one transient provider failure without saving anything or changing credentials',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({error:'temporary'},{status:503})).mockResolvedValueOnce(Response.json({choices:[{message:{content:'مرحبا'}}]}));vi.stubGlobal('fetch',fetch);
 expect(await new PollinationsAssistant('alice').conversation({message:'مرحبا',language:'ar',history:[]})).toEqual({text:'مرحبا',needsWorkspace:false});expect(fetch).toHaveBeenCalledTimes(2);
});
it('retries a network interruption once and keeps the same user key',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(Response.json({choices:[{message:{content:'Hi'}}]}));vi.stubGlobal('fetch',fetch);
 expect((await new PollinationsAssistant('alice').conversation({message:'Hello',language:'en',history:[]})).text).toBe('Hi');expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-alice');
});
it('an already-cancelled request never sends an inference request',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const controller=new AbortController();controller.abort();
 await expect(new PollinationsAssistant('alice').conversation({message:'Hello',language:'en',history:[]},controller.signal)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
});
it('recognizes a provider zero-token HTTP 200 budget notice instead of showing it as a model answer',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({id:'resp_synthetic',usage:{total_tokens:0},choices:[{message:{content:'Budget: https://enter.pollinations.ai/edit-key?id=synthetic&ref=agent_key_budget'}}]}));vi.stubGlobal('fetch',fetch);
 await expect(new PollinationsAssistant('alice').conversation({message:'Hello',language:'en',history:[]})).rejects.toMatchObject({code:'ai-provider-limit',status:402});expect(fetch).toHaveBeenCalledTimes(1);
});
it('repairs a router response that imitates app metadata rather than claiming an unexecuted save',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{content:JSON.stringify({text:'Saved',status:'saved',proposal:{actions:[]}})}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{tool_calls:[{id:'routing-call',type:'function',function:{name:'request_workspace',arguments:'{}'}}]}}]}));vi.stubGlobal('fetch',fetch);
 expect(await new PollinationsAssistant('alice').conversation({message:'Finish the card',language:'en',history:[]})).toEqual({text:'',needsWorkspace:true});expect(fetch).toHaveBeenCalledTimes(2);
});
it('routes PDF export to the workspace after format classification',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({choices:[{message:{tool_calls:[{id:'routing-call',type:'function',function:{name:'request_workspace',arguments:JSON.stringify({requirements:[],outputFormat:'pdf'})}}]}}]}));vi.stubGlobal('fetch',fetch);
 const reply=await new PollinationsAssistant('alice').conversation({message:'give me pdf of all my courses',language:'en',history:[]});expect(reply.needsWorkspace).toBe(true);expect(reply.outputFormat).toBe('pdf');expect(reply.text).toBe('');expect(fetch).toHaveBeenCalledTimes(1);
});it('lets a valid 14-second generation finish without aborting it and starting over',async()=>{
 vi.useFakeTimers();
 const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const c=new AbortController();setTimeout(()=>c.abort(new DOMException('Request timed out','TimeoutError')),ms);return c.signal;});
 try{
  const fetch=vi.fn((_url,init)=>new Promise<Response>((resolve,reject)=>{
   const timer=setTimeout(()=>resolve(Response.json({choices:[{message:{content:'Ready'}}]})),14000);
   init.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(init.signal.reason);},{once:true});
  }));vi.stubGlobal('fetch',fetch);
  const pending=new PollinationsAssistant('alice').conversation({message:'Hello',language:'en',history:[]});
  const assertion=expect(pending).resolves.toMatchObject({text:'Ready'});
  await vi.advanceTimersByTimeAsync(14000);await assertion;expect(fetch).toHaveBeenCalledTimes(1);
 }finally{timeout.mockRestore();vi.useRealTimers();}
});
it('still enforces the overall provider deadline without starting a doomed second generation',async()=>{
 vi.useFakeTimers();
 const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const c=new AbortController();setTimeout(()=>c.abort(new DOMException('Request timed out','TimeoutError')),ms);return c.signal;});
 try{
  const fetch=vi.fn((_url,init)=>new Promise<Response>((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})));vi.stubGlobal('fetch',fetch);
  const pending=new PollinationsAssistant('alice').conversation({message:'Hello',language:'en',history:[]});
  const assertion=expect(pending).rejects.toMatchObject({code:'assistant-timeout',stage:'provider'});
  await vi.advanceTimersByTimeAsync(26000);await assertion;expect(fetch).toHaveBeenCalledTimes(1);
 }finally{timeout.mockRestore();vi.useRealTimers();}
});