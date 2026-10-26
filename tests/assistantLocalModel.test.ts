// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {blankAssistantData} from '../src/assistant/actions';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
const engine=vi.hoisted(()=>({reload:vi.fn(),create:vi.fn(),interrupt:vi.fn(),terminate:vi.fn(),construct:vi.fn(),plan:vi.fn(),cached:vi.fn()}));
vi.mock('@mlc-ai/web-llm',()=>({
 hasModelInCache:engine.cached,
 prebuiltAppConfig:{model_list:[{model_id:'Qwen3-4B-q4f16_1-MLC'}]},
 WebWorkerMLCEngine:class{constructor(){engine.construct();}reload=engine.reload;chat={completions:{create:(input:unknown)=>JSON.stringify(input).includes('Split the user')?engine.plan(input):engine.create(input)}};interruptGenerate=engine.interrupt;}
}));
import {LocalAssistantModel,LOCAL_MODEL} from '../src/assistant/localModel';
const reply=(text='Ready')=>({name:'propose_workspace_actions',arguments:{text,actions:[],files:[],controls:[],tasks:[{title:'Answer',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}]}});
const completion=(value:unknown,finish='stop')=>({choices:[{message:{content:JSON.stringify(value)},finish_reason:finish}]});
const request=()=>({message:'Hello',context:JSON.stringify(blankAssistantData()),history:[],language:'en' as const});
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});vi.stubGlobal('Worker',class{terminate=engine.terminate;});engine.plan.mockResolvedValue(completion({steps:[{target:'projects',operation:'update',fields:['name'],instruction:'Requested card change'},{target:'sections',operation:'update',fields:['name'],instruction:'Requested section change'},{target:'profile',operation:'set',fields:['displayName'],instruction:'Requested profile change'},{target:'appearance',operation:'set',fields:['theme'],instruction:'Requested appearance change'}]}));engine.reload.mockResolvedValue(undefined);engine.create.mockResolvedValue(completion(reply()));});
afterEach(()=>vi.unstubAllGlobals());
it('downloads only on explicit activation and uses exactly the shipped model, schema, context and decoding settings',async()=>{
 const local=new LocalAssistantModel();expect(engine.construct).not.toHaveBeenCalled();await local.load(()=>{});
 expect(engine.reload).toHaveBeenCalledWith(LOCAL_MODEL,expect.objectContaining({context_window_size:LOCAL_RELEASE.contextWindow,sliding_window_size:-1,tokenizer_files:['tokenizer.json','vocab.json','merges.txt','tokenizer_config.json'],conv_template:expect.objectContaining({stop_token_ids:[151643,151645]})}));
 const result=await local.answer(request());expect(JSON.parse(result.text).text).toBe('Ready');
 const input=engine.create.mock.calls[0][0];expect(engine.plan).toHaveBeenCalledTimes(1);expect(input.messages[0].content).toContain('read request');expect(input.messages[0].content).toContain('No tasks or indexes');expect(input.messages[0].content).toContain('displayName');
 expect(input.extra_body.enable_thinking).toBe(false);expect(input.seed).toBe(LOCAL_RELEASE.seed);
 local.dispose();expect(engine.interrupt).toHaveBeenCalledTimes(1);expect(engine.terminate).toHaveBeenCalledTimes(1);
});
it('rejects unsupported GPUs, failed loads, malformed context and truncated completions without a cloud fallback',async()=>{
 vi.stubGlobal('navigator',{});await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-unsupported');expect(engine.construct).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({features:new Set(['shader-f16'])})}});engine.reload.mockRejectedValueOnce(new Error('download failed'));await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-load');
 const local=new LocalAssistantModel();await local.load(()=>{});await expect(local.answer({...request(),context:'not JSON'})).rejects.toThrow('assistant-local-context');expect(engine.create).not.toHaveBeenCalled();
 engine.create.mockResolvedValue(completion(reply(),'length'));await expect(local.answer(request())).rejects.toThrow('ai-response-too-large');local.dispose();
});
it('performs actual authorized read-tool round trips before proposing edits',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});
 const data=blankAssistantData();data.scopes[0].sections=[{id:'section-real',name:'Study',revision:0}];
 engine.create.mockResolvedValueOnce(completion({name:'read_workspace',arguments:{requests:[{target:'sections',view:'catalog',scope:'personal'}]}}));
 engine.create.mockResolvedValueOnce(completion({name:'propose_workspace_actions',arguments:{text:'Review',actions:[{target:'sections',action:'update',scope:'personal',id:'section-real',values:{name:'Work'}}],controls:[],files:[],tasks:[{title:'Rename',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]}}));
 const result=await local.answer({...request(),message:'Rename section Study to Work',context:JSON.stringify(data)});
 expect(JSON.parse(result.text).actions[0].id).toBe('section-real');
 expect(engine.create.mock.calls[1][0].messages.some((m:{content:string})=>m.content.includes('section-real'))).toBe(true);expect(data.scopes[0].sections[0].name).toBe('Study');local.dispose();
});
it('deduplicates concurrent load requests and rejects cancellation before a stale engine can become ready',async()=>{
 let finish!:()=>void;engine.reload.mockImplementation(()=>new Promise<void>(r=>{finish=r;}));
 const local=new LocalAssistantModel(),first=local.load(()=>{}),second=local.load(()=>{});
 const checks=[expect(first).rejects.toThrow('assistant-local-cancelled'),expect(second).rejects.toThrow('assistant-local-cancelled')];
 await vi.waitFor(()=>expect(engine.reload).toHaveBeenCalledTimes(1));local.dispose();finish();await Promise.all(checks);
 await expect(local.answer(request())).rejects.toThrow('assistant-local-not-ready');
});
it('cancels an in-flight generation without reporting a successful response',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});engine.create.mockImplementation(()=>new Promise(()=>{}));
 const answer=local.answer(request());const rejected=expect(answer).rejects.toThrow('assistant-local-cancelled');local.dispose();await rejected;
});
it('does not turn a named creation into an optional-details interrogation',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});
 engine.create.mockResolvedValue(completion({name:'propose_workspace_actions',arguments:{text:'Review',actions:[{target:'projects',action:'create',scope:'personal',id:'new-card',values:{name:'New card'}}],controls:[],files:[],tasks:[{title:'Create card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]}}));
 const result=await local.answer({...request(),message:'Create a card named New card'});
 expect(JSON.parse(result.text).actions).toHaveLength(1);expect(JSON.parse(result.text).clarification).toBeUndefined();local.dispose();
});

it('rejects missing shader-f16 before downloading the incompatible model',async()=>{
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({features:new Set()})}});
 await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-unsupported');
 expect(engine.construct).not.toHaveBeenCalled();expect(engine.reload).not.toHaveBeenCalled();
});
it('includes read argument definitions and the complete task envelope in plain local generation',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});await local.answer(request());
 const prompt=engine.create.mock.calls[0][0].messages[0].content;
 for(const field of ['read','catalog or details','fields','offset','No tasks or indexes','profile','appearance'])expect(prompt).toContain(field);
 local.dispose();
});it('does not mark an empty smoke completion ready and releases the engine for retry',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});
 engine.create.mockResolvedValueOnce({choices:[{message:{content:''}}]});
 await expect(local.smoke()).rejects.toThrow('assistant-smoke-empty-output');
 engine.create.mockResolvedValueOnce({choices:[{message:{content:'Hello'}}]});
 await expect(local.smoke()).resolves.toMatchObject({text:'Hello'});local.dispose();
});
it('cancels readiness inference without waiting for a dead worker and disallows overlapping generation',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});engine.create.mockImplementation(()=>new Promise(()=>{}));
 const smoke=local.smoke();const rejected=expect(smoke).rejects.toThrow('assistant-local-cancelled');
 await expect(local.answer(request())).rejects.toThrow('assistant-local-busy');local.dispose();await rejected;
});it('settles a stuck GPU request at the deadline even when interruptGenerate cannot finish',async()=>{
 vi.useFakeTimers();
 const local=new LocalAssistantModel();
 try{
  await local.load(()=>{});engine.create.mockImplementation(()=>new Promise(()=>{}));
  const answer=local.answer(request());const rejected=expect(answer).rejects.toThrow('assistant-local-timeout');
  await vi.advanceTimersByTimeAsync(LOCAL_RELEASE.requestTimeoutMs);await rejected;
  expect(engine.terminate).toHaveBeenCalled();await expect(local.answer(request())).rejects.toThrow('assistant-local-not-ready');
 }finally{local.dispose();vi.useRealTimers();}
});
it('reports cached restoration separately and retains cached weights when disposing',async()=>{
 engine.cached.mockResolvedValue(true);
 const progress=vi.fn(),model=new LocalAssistantModel();await model.load(progress);
 expect(engine.cached).toHaveBeenCalledWith(LOCAL_MODEL,expect.objectContaining({useIndexedDBCache:true}));
 model.dispose();expect(engine.terminate).toHaveBeenCalled();
});
it('accepts a real read-plus-update plan through the authorized read adapter',async()=>{
 const local=new LocalAssistantModel();await local.load(()=>{});
 const data=blankAssistantData();data.scopes[0].sections=[{id:'s-real',name:'Old',revision:0}];
 engine.create.mockResolvedValue(completion({text:'Review',read:[{target:'sections',view:'details',ids:['s-real'],fields:['name']}],actions:[{target:'sections',action:'update',id:'s-real',scope:'personal',values:{name:'New'}}],controls:[],files:[]}));
 const result=await local.answer({...request(),message:'Rename section Old to New',context:JSON.stringify(data)});
 expect(JSON.parse(result.text).actions[0].values.name).toBe('New');expect(engine.create).toHaveBeenCalledTimes(1);expect(data.scopes[0].sections[0].name).toBe('Old');local.dispose();
});
it('normalizes a real compound creation before the wire contract, retaining the later note update',async()=>{
 const {acceptanceCases,acceptanceContext}=await import('./fixtures/assistant/corpus.mjs');const {evaluateAcceptance}=await import('./fixtures/assistant/oracle');
 const c=acceptanceCases.find((c:{id:string})=>c.id==='compound-card-ar')!;
 const local=new LocalAssistantModel();await local.load(()=>{});
 engine.create.mockResolvedValue(completion({text:'Review',read:[{target:'projects',view:'details',ids:['card'],fields:['name','dueDate','description']}],actions:[{target:'projects',action:'create',id:'card',scope:'personal',values:{name:'عمار',dueDate:'2026-10-25T00:00:00Z'}},{target:'projects',action:'update',id:'card',scope:'personal',values:{description:'مرحبا نجحت'}}],controls:[],files:[]}));
 const result=await local.answer({...request(),message:c.message,language:'ar',context:JSON.stringify(acceptanceContext(c.id))});
 evaluateAcceptance(c,result.text);expect(engine.create).toHaveBeenCalledTimes(1);local.dispose();
});