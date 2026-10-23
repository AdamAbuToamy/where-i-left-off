// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const engine=vi.hoisted(()=>({reload:vi.fn(),create:vi.fn(),interrupt:vi.fn(),terminate:vi.fn(),construct:vi.fn()}));
vi.mock('@mlc-ai/web-llm',()=>({WebWorkerMLCEngine:class{constructor(){engine.construct();}reload=engine.reload;chat={completions:{create:engine.create}};interruptGenerate=engine.interrupt;}}));
import {LocalAssistantModel,LOCAL_MODEL} from '../src/assistant/localModel';
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({})}});vi.stubGlobal('Worker',class{terminate=engine.terminate;});engine.reload.mockResolvedValue(undefined);engine.create.mockResolvedValue({choices:[{message:{content:'{"text":"Ready","actions":[],"files":[]}'},finish_reason:'stop'}]});});
afterEach(()=>vi.unstubAllGlobals());
it('downloads only on explicit activation, runs in a worker and disposes resources',async()=>{
 const local=new LocalAssistantModel();expect(engine.construct).not.toHaveBeenCalled();await local.load(()=>{});expect(engine.reload).toHaveBeenCalledWith(LOCAL_MODEL);
 const result=await local.answer({message:'Summarize',context:'{}',history:[],language:'en'});expect(JSON.parse(result.text).text).toBe('Ready');expect(engine.create.mock.calls[0][0].response_format).toEqual({type:'json_object'});
 local.dispose();expect(engine.interrupt).toHaveBeenCalledTimes(1);expect(engine.terminate).toHaveBeenCalledTimes(1);
});
it('clearly rejects unsupported GPUs, failed downloads, oversize context and incomplete output',async()=>{
 vi.stubGlobal('navigator',{});await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-unsupported');expect(engine.construct).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({})}});engine.reload.mockRejectedValueOnce(new Error('download failed'));await expect(new LocalAssistantModel().load(()=>{})).rejects.toThrow('assistant-local-load');expect(engine.terminate).toHaveBeenCalledTimes(1);
 const local=new LocalAssistantModel();await local.load(()=>{});await expect(local.answer({message:'Summarize',context:'م'.repeat(6000),history:[],language:'ar'})).rejects.toThrow('assistant-local-context');expect(engine.create).not.toHaveBeenCalled();
 engine.create.mockResolvedValue({choices:[{message:{content:'{"text":'},finish_reason:'length'}]});await expect(local.answer({message:'Hi',context:'{}',history:[],language:'en'})).rejects.toThrow('assistant-format');local.dispose();
});
