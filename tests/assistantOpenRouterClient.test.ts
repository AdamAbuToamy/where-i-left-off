// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
vi.mock('../src/assistant/openRouterAuth',()=>({routerKey:(uid:string)=>'synthetic-'+uid}));
import {OpenRouterAssistant} from '../src/assistant/openRouterClient';
afterEach(()=>vi.unstubAllGlobals());
it('uses each user key with only free cloud models and optional native tools',async()=>{
 const fetch=vi.fn(async(url,init)=>{
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');expect(init.headers.Authorization).toBe('Bearer synthetic-alice');const input=JSON.parse(init.body);
  expect(input.models.every((model:string)=>model.endsWith(':free'))).toBe(true);expect(input.tool_choice).toBe('auto');expect(input.reasoning.enabled).toBe(false);expect(input.tools[0].function.name).toBe('request_workspace');
  return Response.json({choices:[{message:{content:'مرحبا!'}}]});
 });vi.stubGlobal('fetch',fetch);
 const result=await new OpenRouterAssistant('alice').conversation({message:'مرحبا',language:'ar',history:[]});expect(result).toEqual({text:'مرحبا!',needsWorkspace:false});expect(fetch).toHaveBeenCalledTimes(1);
});