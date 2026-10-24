import {afterEach,expect,it,vi} from 'vitest';
import {checkAssistantDeployment} from '../scripts/check-assistant-deployment.mjs';
afterEach(()=>vi.unstubAllGlobals());
const headers={'access-control-allow-origin':'https://where-i-left-off.web.app','access-control-allow-headers':'authorization,content-type,x-firebase-appcheck','access-control-allow-methods':'POST,OPTIONS','x-wilo-assistant-version':'wilo-assistant-2026-10-v2'};
it('checks the actual deployed preflight contract without keys, identity tokens or inference',async()=>{
 const fetcher=vi.fn(async()=>new Response(null,{status:204,headers}));vi.stubGlobal('fetch',fetcher);
 expect(await checkAssistantDeployment('https://worker.test.workers.dev/assistant')).toEqual({protocol:'wilo-assistant-2026-10-v2',cors:true,inferenceTested:false});
 const options=fetcher.mock.calls[0][1] as RequestInit;expect(options.method).toBe('OPTIONS');expect(JSON.stringify(options)).not.toMatch(/Bearer|api.key|context|GROQ/);
});
it.each(['access-control-allow-origin','access-control-allow-headers','access-control-allow-methods','x-wilo-assistant-version'])('refuses frontend rollout when deployment lacks %s',async key=>{
 const partial={...headers} as Record<string,string>;delete partial[key];vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:204,headers:partial})));await expect(checkAssistantDeployment('https://worker.test.workers.dev/assistant')).rejects.toThrow();
});
it('rejects an invalid endpoint before any network transmission',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(checkAssistantDeployment('https://evil.test/assistant')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
