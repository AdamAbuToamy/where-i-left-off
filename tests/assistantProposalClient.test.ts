import {expect,it,vi} from 'vitest';
import {AssistantProposalClient} from '../src/assistant/proposalClient';
import {blankAssistantData,parseAssistantReply,planAssistantProposal} from '../src/assistant/actions';
const request={mode:'workspace',message:'Create a course then schedule it',language:'en',context:'full original snapshot',history:[]};
const valid=JSON.stringify({text:'Review',actions:[{target:'courses',action:'create',id:'new-course',values:{name:'محمد'}},{target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:0,start:'00:00',end:'01:00'}}]});
const validate=(text:string)=>{const reply=parseAssistantReply(text);try{return {reply,changes:planAssistantProposal(blankAssistantData(),reply.actions)};}catch(cause){throw new Error('assistant-invalid',{cause});}};
it.each(['not JSON',JSON.stringify({text:'Review',actions:[{target:'courses',action:'create',id:'c',values:{name:'محمد',day:0}}]}),JSON.stringify({text:'Review',actions:[{target:'lessons',action:'create',id:'l',values:{courseId:'missing',day:0,start:'00:00',end:'01:00'}}]})])('repairs invalid output once with the complete original request and snapshot',async bad=>{
 const call=vi.fn().mockResolvedValueOnce({text:bad}).mockResolvedValueOnce({text:valid}),pause=vi.fn().mockResolvedValue(undefined),phase=vi.fn();
 const result=await new AssistantProposalClient(call,pause).prepare(request,validate,phase);
 expect(result.changes).toHaveLength(2);expect(result.changes[0].after).toMatchObject({name:'محمد'});expect(result.changes[1].after).toMatchObject({courseId:result.changes[0].id,start:'00:00',end:'01:00'});
 expect(call).toHaveBeenCalledTimes(2);expect(call.mock.calls[1][0]).toEqual({...request,repair:{reason:expect.any(String),proposal:bad}});expect(call.mock.calls[1][1]).toBe(30000);expect(pause).toHaveBeenCalledWith(3200);expect(phase).toHaveBeenCalledOnce();
});
it('does not retry valid replies, provider failures, conflicts, reminders, account errors or course identity matches',async()=>{
 const call=vi.fn().mockResolvedValue({text:valid}),pause=vi.fn(),client=new AssistantProposalClient(call,pause);
 await client.prepare(request,validate,vi.fn());expect(call).toHaveBeenCalledOnce();expect(pause).not.toHaveBeenCalled();
 for(const code of ['permission-denied','assistant-linked-reminder','assistant-conflict','assistant-pending','account-changed']){
  call.mockClear();await expect(client.prepare(request,()=>{throw new Error(code);},vi.fn())).rejects.toThrow(code);expect(call).toHaveBeenCalledOnce();
 }
 call.mockClear();await expect(client.prepare({...request,mode:'course-match'},()=>{throw new Error('assistant-invalid');},vi.fn())).rejects.toThrow();expect(call).toHaveBeenCalledOnce();
 call.mockRejectedValueOnce(new Error('ai-provider-limit'));await expect(client.prepare(request,validate,vi.fn())).rejects.toThrow('ai-provider-limit');
});
it('stops after one failed repair and never silently accepts a partial proposal',async()=>{
 const call=vi.fn().mockResolvedValue({text:'not JSON'});await expect(new AssistantProposalClient(call,async()=>{}).prepare(request,validate,vi.fn())).rejects.toThrow('assistant-format');expect(call).toHaveBeenCalledTimes(2);
});

it('can repair a large browser-local snapshot without pretending it is all provider input',async()=>{
 const call=vi.fn().mockResolvedValueOnce({text:'not JSON'}).mockResolvedValueOnce({text:valid});
 const local={...request,contextMode:'local-snapshot' as const,context:'x'.repeat(200000)};
 await expect(new AssistantProposalClient(call,async()=>{}).prepare(local,validate,vi.fn())).resolves.toBeTruthy();
 expect(call.mock.calls[1][0].context).toBe(local.context);
});
