import {expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({auth:null,db:null,appCheck:null,emulatorMode:false}));
import {assistantValidationHint} from '../src/assistant/validationHint';
import {AssistantApi} from '../src/assistant/api';import {AssistantFailure} from '../src/assistant/failure';
function fixture(fetcher:typeof fetch){const uid={value:'alice'},identity=vi.fn<(refresh:boolean)=>Promise<string>>().mockResolvedValue('test-identity-secret'),attestation=vi.fn<(refresh:boolean)=>Promise<string>>().mockResolvedValue('test-appcheck-secret');return {uid,identity,attestation,api:new AssistantApi({uid:()=>uid.value,identity,attestation,endpoint:async()=> 'https://worker.test/assistant',fetch:fetcher})};}
it('sends the unchanged request with separate identity and App Check headers',async()=>{
 const fetcher=vi.fn(async(_url:unknown,options?:RequestInit)=>{expect(options?.headers).toMatchObject({Authorization:'Bearer test-identity-secret','X-Firebase-AppCheck':'test-appcheck-secret'});expect(JSON.parse(String(options?.body))).toEqual({message:'Create card and note'});return Response.json({result:{text:'proposal'}});});
 const {api}=fixture(fetcher as typeof fetch);expect(await api.request({message:'Create card and note'})).toEqual({text:'proposal'});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('refreshes both credentials once on HTTP 401 without changing or duplicating the model proposal',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'ai-auth-required'},{status:401})).mockResolvedValueOnce(Response.json({result:{text:'ready'}}));
 const {api,identity,attestation}=fixture(fetcher);await api.request({mode:'workspace'});expect(identity.mock.calls.map(c=>c[0])).toEqual([false,true]);expect(attestation.mock.calls.map(c=>c[0])).toEqual([false,true]);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not relabel a server service-account permission failure as a model or generic network failure',async()=>{
 const {api}=fixture(vi.fn(async()=>Response.json({error:'ai-service-permission',diagnostic:{stage:'account',requestId:'11111111-1111-1111-1111-111111111111',protocol:'wilo-assistant-2026-10-v2'}},{status:503})) as typeof fetch);
 await expect(api.request({mode:'workspace'})).rejects.toMatchObject({code:'ai-service-permission',stage:'account',status:503,requestId:'11111111-1111-1111-1111-111111111111'});
});
it.each([429,403,503])('never retries a non-auth HTTP failure %s',async status=>{
 const fetcher=vi.fn(async()=>Response.json({error:'ai-provider-limit'},{status})),{api}=fixture(fetcher as typeof fetch);await expect(api.request({})).rejects.toBeInstanceOf(AssistantFailure);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('never sends the request if App Check acquisition fails',async()=>{
 const fetcher=vi.fn(),{api,attestation}=fixture(fetcher);attestation.mockRejectedValue(new Error('private provider text'));await expect(api.request({})).rejects.toMatchObject({code:'assistant-app-check-failed',stage:'app-check'});expect(fetcher).not.toHaveBeenCalled();
});
it('rejects a reply after account change and never exports credentials or server payload text in diagnostics',async()=>{
 const state=fixture(vi.fn(async()=>{state.uid.value='bob';return Response.json({result:{text:'private account reply'}});}) as typeof fetch);
 try{await state.api.request({});throw new Error('expected rejection');}catch(e){const error=e as AssistantFailure;expect(error.code).toBe('account-changed');expect(JSON.stringify(error.diagnostic())).not.toMatch(/test-identity-secret|test-appcheck-secret|private account/);}
 const malicious=AssistantFailure.remote({error:'test-identity-secret',diagnostic:{stage:'secret-stage',requestId:'private-value',protocol:'private-value'}},400,null,null);expect(JSON.stringify(malicious.diagnostic())).not.toMatch(/secret-stage|private-value|test-identity-secret/);
});
it('distinguishes an HTML/malformed server response from a transport failure',async()=>{
 await expect(fixture(vi.fn(async()=>new Response('<html>error</html>',{status:502})) as typeof fetch).api.request({})).rejects.toMatchObject({code:'assistant-server-response',status:502});
 await expect(fixture(vi.fn(async()=>{throw new TypeError('private URL');}) as typeof fetch).api.request({})).rejects.toMatchObject({code:'assistant-network'});
});

it('preserves fixed validation hints internally while keeping the original cause out of exported diagnostics',()=>{
 const original=new Error('assistant-invalid',{cause:new Error('invalid-due-date',{cause:new Error('private request text')})});
 const failure=AssistantFailure.from(original,'validation');
 expect(assistantValidationHint(failure,'en')).toContain('real calendar dates');
 expect(JSON.stringify(failure.diagnostic())).not.toMatch(/private request text|invalid-due-date/);
});
