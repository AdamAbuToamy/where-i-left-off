// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {blankAssistantData} from '../src/assistant/actions';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
const engine=vi.hoisted(()=>({reload:vi.fn(),create:vi.fn(),interrupt:vi.fn(),terminate:vi.fn(),construct:vi.fn()}));
vi.mock('@mlc-ai/web-llm',()=>({
 prebuiltAppConfig:{model_list:[{model_id:'Qwen3-4B-q4f16_1-MLC'}]},
 WebWorkerMLCEngine:class{constructor(){engine.construct();}reload=engine.reload;chat={completions:{create:engine.create}};interruptGenerate=engine.interrupt;}
}));
import {LocalAssistantModel,LOCAL_MODEL} from '../src/assistant/localModel';
const reply=(text='Ready')=>({name:'propose_workspace_actions',arguments:{text,actions:[],files:[],controls:[],tasks:[{title:'Answer',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}]}});
const completion=(value:unknown,finish='stop')=>({choices:[{message:{content:JSON.stringify(value)},finish_reason:finish}]});
const request=()=>({message:'Hello',context:JSON.stringify(blankAssistantData()),history:[],language:'en' as const});
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({})}});vi.stubGlobal('Worker',class{terminate=engine.terminate;});engine.reload.mockResolvedValue(undefined);engine.create.mockResolvedValue(completion(reply()));});
afterEach(()=>vi.unstubAllGlobals());
it('downloads only on explicit activation and uses exactly the shipped model, schema, context and decoding settings',async()=>{
 const local=new LocalAssistantModel();expect(engine.construct).not.toHaveBeenCalled();await local.load(()=>{});
 expect(engine.reload).toHaveBeenCalledWith(LOCAL_MODEL,{context_window_size:LOCAL_RELEASE.contextWindow});
 const result=await local.answer(request());expect(JSON.parse(result.text).text).toBe('Ready');
 const input=engine.create.mock.calls[0][0];expect(input.response_format.type).toBe('json_object');expect(JSON.parse(input.response_format.schema).anyOf).toHaveLength(2);
 expect(input.extra_body.enable_thinking).toBe(false);expect(input.seed).toBe(LOCAL_RELEASE.seed);
 local.dispose();expect(engine.interrupt).toHaveBeenCalledTimes(1);expect(engine.terminate).toHaveBeenCalledTimes(1);
});
it('rejects unsupported GPUs, failed loads, malformed context and truncated completions without a cloud fallback',async()=>{
 vi.stubGlobal('navigator',{});await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-unsupported');expect(engine.construct).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({})}});engine.reload.mockRejectedValueOnce(new Error('download failed'));await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-load');
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
