import {test} from 'node:test';import assert from 'node:assert/strict';
import {workspaceToolInput,workspaceToolStep,runWorkspaceTools} from './src/assistantTools.mjs';
import {readWorkspaceContext} from './src/assistantContext.mjs';
const state={localDate:'2026-10-24',timezone:'Asia/Jerusalem',controls:{language:'ar'},study:{courses:[{id:'c',name:'2026 מודלים חישוביים',notes:'private course body '.repeat(1000)}],tasks:[],lessons:[]},scopes:[{id:'personal',name:'Personal',projects:[{id:'p',name:'محمد',description:'old note',dueDate:''}],sections:[]}]};
const context=JSON.stringify(state),data={language:'ar',message:'عدّل بطاقة محمد وأضف new note إلى ملاحظتها',context};
const plan={text:'Review',actions:[{target:'projects',action:'update',id:'p',scope:'personal',values:{description:'old note\nnew note'}}],controls:[],files:[],tasks:[{title:'Append note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
test('a greeting with a large account does not send account bodies or require a read',async()=>{
 const input=workspaceToolInput({...data,message:'مرحبا'},[]),wire=JSON.stringify(input);assert.ok(wire.length<9000);assert.equal(wire.includes('private course body'),false);assert.equal(wire.includes('old note'),false);
 const answer={text:'أهلًا، كيف أساعدك؟',actions:[],controls:[],files:[],tasks:[{title:'Greeting',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}]};let calls=0;
 const reply=await runWorkspaceTools({...data,message:'مرحبا'},[],async()=>{calls++;return {response:JSON.stringify(answer)};});assert.equal(calls,1);assert.equal(JSON.parse(reply).text,answer.text);
});
test('the model reads exact existing record data then proposes an append through the same request',async()=>{
 let calls=0;const text=await runWorkspaceTools(data,[],async input=>{
  calls++;if(calls===1){assert.equal(JSON.stringify(input).includes('old note'),false);return workspaceToolStep({message:{tool_calls:[{id:'read-1',type:'function',function:{name:'read_workspace',arguments:JSON.stringify({requests:[{target:'projects',view:'details',query:'محمد',fields:['name','description']}]})}}]}});}
  const result=JSON.parse(input.messages.at(-1).content);assert.deepEqual(result.results[0].items,[{id:'p',name:'محمد',description:'old note'}]);assert.equal(input.messages.at(-1).tool_call_id,input.messages.at(-2).tool_calls[0].id);assert.equal(JSON.stringify(input).includes('private course body'),false);return {response:JSON.stringify(plan)};
 });assert.equal(calls,2);assert.deepEqual(JSON.parse(text).actions,plan.actions);
});
test('reads cannot cross account scopes; IDs are discovered from authorized context only',()=>{
 assert.throws(()=>readWorkspaceContext(context,{requests:[{target:'projects',view:'details',scope:'someone-else'}]}),/ai-incomplete-proposal/);
 assert.deepEqual(readWorkspaceContext(context,{requests:[{target:'projects',view:'details',ids:['foreign-id']}]}).results[0].items,[]);
 for(const request of [{target:'users',view:'details'},{target:'projects',view:'details',limit:999},{target:'courses',view:'details',scope:'other'}])assert.throws(()=>readWorkspaceContext(context,{requests:[request]}),/ai-incomplete-proposal/);
});
test('pagination and oversized content are explicit; selected fields stay exact',()=>{
 const result=readWorkspaceContext(context,{requests:[{target:'courses',view:'details'}]}).results[0];assert.deepEqual(result.tooLarge,['c']);assert.equal(result.items.length,0);
 const catalog=readWorkspaceContext(context,{requests:[{target:'courses',view:'catalog'}]}).results[0];assert.equal(catalog.items[0].name,state.study.courses[0].name);assert.equal('notes' in catalog.items[0],false);
 const expanded=structuredClone(state);expanded.study.courses=Array.from({length:30},(_,i)=>({id:'c'+i,name:'Course '+i}));const page=readWorkspaceContext(JSON.stringify(expanded),{requests:[{target:'courses',view:'catalog'}]}).results[0];assert.equal(page.items.length,25);assert.equal(page.hasMore,true);assert.equal(page.nextOffset,25);
});
test('unbounded reading stops without producing or applying a partial plan',async()=>{
 let calls=0;await assert.rejects(runWorkspaceTools(data,[],async()=>{calls++;return {contextRequest:{requests:[{target:'projects',view:'catalog'}]},toolCall:{id:'read-'+calls,type:'function',function:{name:'read_workspace',arguments:'{}'}}};}),/ai-context-read-limit/);assert.equal(calls,4);
});

const readCall=(id,target)=>({id,type:'function',function:{name:'read_workspace',arguments:JSON.stringify({requests:[{target,view:'catalog'}]})}});
test('independent course and card reads in one response receive all tool results before the next model turn',async()=>{
 let calls=0;const result=await runWorkspaceTools(data,[],async input=>{
  if(++calls===1)return workspaceToolStep({message:{tool_calls:[readCall('courses','courses'),readCall('cards','projects')]}});
  const replies=input.messages.slice(-2);assert.deepEqual(replies.map(r=>r.tool_call_id),input.messages.at(-3).tool_calls.map(call=>call.id));
  assert.equal(JSON.parse(replies[0].content).results[0].items[0].id,'c');assert.equal(JSON.parse(replies[1].content).results[0].items[0].id,'p');
  return {response:JSON.stringify(plan)};
 });assert.equal(calls,2);assert.deepEqual(JSON.parse(result).actions,plan.actions);
});
test('parallel reads reject duplicate call IDs, unknown calls, mixed proposals, and over-budget batches',()=>{
 for(const calls of [[readCall('same','courses'),readCall('same','projects')],[readCall('a','courses'),{id:'b',type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(plan)}}],[readCall('a','courses'),{id:'b',type:'function',function:{name:'execute_code',arguments:'{}'}}]])assert.throws(()=>workspaceToolStep({message:{tool_calls:calls}}),/ai-incomplete-proposal/);
 assert.throws(()=>workspaceToolStep({message:{tool_calls:['a','b','c','d'].map(id=>readCall(id,'courses'))}}),/ai-context-read-limit/);
});
test('repeated provider call IDs remain bounded by the context read limit',async()=>{
 await assert.rejects(runWorkspaceTools(data,[],async()=>workspaceToolStep({message:{tool_calls:[readCall('same','courses')]}})),/ai-context-read-limit/);
});
test('invalid parallel read scopes remain blocked through the bounded repair without forwarding records',async()=>{
 let calls=0;await assert.rejects(runWorkspaceTools(data,[],async input=>{
  assert.equal(input.messages.some(m=>m.role==='tool'),false);calls++;const invalid=readCall('foreign','projects');invalid.function.arguments=JSON.stringify({requests:[{target:'projects',view:'details',scope:'another-account'}]});
  return workspaceToolStep({message:{tool_calls:[readCall('course','courses'),invalid]}});
 }),/ai-incomplete-proposal/);assert.equal(calls,2);
});

test('an invalid native tool response gets one bounded format repair before returning a complete valid plan',async()=>{
 let calls=0;const text=await runWorkspaceTools(data,[],async input=>{
  calls++;if(calls===1)throw new Error('ai-incomplete-proposal');
  assert.ok(input.messages.at(-1).content.includes('COMPLETE response'));assert.ok(input.messages.some(m=>m.content.includes(data.message)));
  return {response:JSON.stringify(plan)};
 });assert.equal(calls,2);assert.deepEqual(JSON.parse(text).actions,plan.actions);
});
test('persistent malformed plans stop after one repair; provider access and quota failures are never format-retried',async()=>{
 for(const reason of ['ai-incomplete-proposal','ai-provider-limit','ai-provider-access','ai-provider-request']){
  let calls=0;await assert.rejects(runWorkspaceTools(data,[],async()=>{calls++;throw new Error(reason);}),new RegExp(reason));assert.equal(calls,reason==='ai-incomplete-proposal'?2:1);
 }
});

test('reused provider IDs across successive reads are correlated with unique canonical calls',async()=>{
 let calls=0;const result=await runWorkspaceTools(data,[],async input=>{
  calls++;if(calls<=2)return workspaceToolStep({message:{tool_calls:[readCall('same',calls===1?'courses':'projects')]}});
  const toolMessages=input.messages.filter(m=>m.role==='tool');const toolCalls=input.messages.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls||[]);
  assert.equal(new Set(toolCalls.map(c=>c.id)).size,2);assert.deepEqual(toolMessages.map(m=>m.tool_call_id),toolCalls.map(c=>c.id));return {response:JSON.stringify(plan)};
 });assert.equal(JSON.parse(result).actions[0].id,'p');assert.equal(calls,3);
});
