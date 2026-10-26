import {afterEach,expect,it,vi} from 'vitest';
import {readInferenceResponse,inferenceBudget} from '../src/assistant/inferenceStream';
const encode=new TextEncoder(),event=(packet:unknown)=>'data: '+JSON.stringify(packet)+'\n\n';
const choice=(delta:unknown,finish_reason:string|null=null)=>({id:'test-stream',choices:[{index:0,delta,finish_reason}]});
function stream(text:string,fragment=9){
 const bytes=encode.encode(text);return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=fragment)controller.enqueue(bytes.slice(i,i+fragment));controller.close();}}),{headers:{'content-type':'text/event-stream'}});
}
afterEach(()=>vi.useRealTimers());
it('reconstructs UTF-8 Arabic across arbitrary byte boundaries and preserves terminal usage',async()=>{
 const touch=vi.fn(),reply=await readInferenceResponse(stream(event(choice({role:'assistant'}))+event(choice({content:'مرحبًا '}))+event(choice({content:'آدم'},'stop'))+event({id:'test-stream',choices:[],usage:{total_tokens:8}})+'data: [DONE]\n\n',1),new AbortController().signal,touch);
 expect(reply.choices?.[0].message.content).toBe('مرحبًا آدم');expect(reply.usage?.total_tokens).toBe(8);expect(touch).toHaveBeenCalledTimes(2);
});
it('assembles interleaved typed function calls before returning the whole proposal',async()=>{
 const text=event(choice({tool_calls:[{index:0,id:'a',function:{name:'create_',arguments:'{"name":'}}]}))+event(choice({tool_calls:[{index:1,id:'b',function:{name:'create_section',arguments:'{"name":"ادم"}'}}]}))+event(choice({tool_calls:[{index:0,function:{name:'card',arguments:'"عمار"}'}}]},'tool_calls'))+'data: [DONE]\n\n';
 const reply=await readInferenceResponse(stream(text),new AbortController().signal,()=>{});
 expect(reply.choices?.[0].message.tool_calls?.map(call=>[call.id,call.function.name,JSON.parse(call.function.arguments)])).toEqual([['a','create_card',{name:'عمار'}],['b','create_section',{name:'ادم'}]]);
});
it.each(['missing-terminal','length','broken-json'])('rejects %s instead of accepting a partial operation',async kind=>{
 const text=kind==='broken-json'?'data: {bad}\n\n':event(choice({tool_calls:[{index:0,id:'a',function:{name:'create_card',arguments:'{"name":"A"}'}}]},kind==='length'?'length':'tool_calls'))+(kind==='missing-terminal'?'':'data: [DONE]\n\n');
 await expect(readInferenceResponse(stream(text),new AbortController().signal,()=>{})).rejects.toThrow('ai-incomplete-proposal');
});
it('does not resolve even a complete-looking tool call until the stream terminates',async()=>{
 let writer!:ReadableStreamDefaultController<Uint8Array>;
 const response=new Response(new ReadableStream({start(controller){writer=controller;}}),{headers:{'content-type':'text/event-stream'}});
 let resolved=false;const pending=readInferenceResponse(response,new AbortController().signal,()=>{}).then(reply=>{resolved=true;return reply;});
 writer.enqueue(encode.encode(event(choice({tool_calls:[{index:0,id:'a',function:{name:'create_card',arguments:'{"name":"A"}'}}]}))));
 await Promise.resolve();expect(resolved).toBe(false);
 writer.enqueue(encode.encode(event(choice({},'tool_calls'))+'data: [DONE]\n\n'));writer.close();
 expect((await pending).choices?.[0].message.tool_calls).toHaveLength(1);
});
it('cancellation releases a stalled reader and does not wait for the provider to close',async()=>{
 const controller=new AbortController(),cancel=vi.fn(),response=new Response(new ReadableStream({cancel}),{headers:{'content-type':'text/event-stream'}});
 const assertion=expect(readInferenceResponse(response,controller.signal,()=>{})).rejects.toThrow();controller.abort();await assertion;expect(cancel).toHaveBeenCalled();
});
it('allows active output past 25 seconds but retains a hard overall limit',()=>{
 vi.useFakeTimers();const budget=inferenceBudget();
 try{vi.advanceTimersByTime(20000);budget.activity();vi.advanceTimersByTime(20000);expect(budget.signal.aborted).toBe(false);budget.activity();vi.advanceTimersByTime(20000);expect(budget.signal.aborted).toBe(true);}finally{budget.dispose();}
});

it('bounds non-streaming provider bodies too, before parsing or accepting their contents',async()=>{
 const response=Response.json({choices:[{message:{content:'x'.repeat(2100000)}}]});
 await expect(readInferenceResponse(response,new AbortController().signal,()=>{})).rejects.toMatchObject({code:'ai-response-too-large'});
});
