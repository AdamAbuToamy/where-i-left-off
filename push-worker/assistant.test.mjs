import {test} from 'node:test';import assert from 'node:assert/strict';
import {INTENT_FORMAT} from './src/assistantIntents.mjs';
import {assistant,ASSISTANT_MODEL} from './src/assistant.mjs';import {database} from './test-db.mjs';
const answerIntent=message=>({intents:[{title:'Answer',source:message,subject:'answer',outcome:'answer',requirements:[]}]});
function withInventory(run){return async(model,input)=>{
 if(input.response_format===INTENT_FORMAT){const message=input.messages.at(-1).content.split('\n\nACCOUNT CONTEXT')[0];return {response:answerIntent(message)};}
 return run(model,input);
};}
function fixture(){const calls=[];const env={DB:database(),ASSISTANT_FREE_ONLY:'true',AI:{run:withInventory(async(...args)=>{calls.push(args);return {response:'A concise answer'};})}};env.DB.sqlite.prepare("INSERT INTO accounts(uid,prefs) VALUES('alice','{}')").run();return {env,calls};}
test('AI is opt-in, bounded and never receives app context unless the request included it',async()=>{
 const {env,calls}=fixture();const answer=await assistant(env,'alice',{mode:'summarize',message:'Explain recursion',language:'en'});
 assert.equal(answer.text,'A concise answer');assert.equal(calls.length,1);assert.ok(!JSON.stringify(calls).includes('USER-APPROVED'));assert.equal(calls[0][1].max_tokens,2200);
 await assert.rejects(()=>assistant(env,'alice',{mode:'chat',message:'Again',language:'en'}),/ai-rate-limit/);assert.equal(calls.length,1);
});
test('old app counters no longer impose a ten-attempt or hundred-request daily allowance',async()=>{
 const {env,calls}=fixture(),day=new Date().toISOString().slice(0,10);
 env.DB.sqlite.prepare('INSERT INTO ai_budget(day,used) VALUES(?,100)').run(day);
 env.DB.sqlite.prepare('INSERT INTO ai_usage(uid,day,used,last_at) VALUES(?,?,10,0)').run('alice',day);
 await assistant(env,'alice',{mode:'chat',message:'Hi',language:'en'});assert.equal(calls.length,1);
 await assert.rejects(()=>assistant({...env,AI:null},'alice',{mode:'chat',message:'Hi',language:'en'}),/ai-not-configured/);
});
test('workspace chat supports validated proposals without any external search request',async()=>{
 const {env,calls}=fixture();const answer=await assistant(env,'alice',{mode:'workspace',message:'Link course A as prerequisite for B',language:'en',context:'{"study":{"courses":[]}}'});
 assert.equal(answer.sources.length,0);assert.match(calls[0][1].messages[0].content,/requires/);assert.match(calls[0][1].messages[0].content,/review and click Apply/);
 const other=fixture();await assert.rejects(()=>assistant(other.env,'alice',{mode:'search',message:'anything',language:'en'}),/ai-invalid-input/);assert.equal(other.calls.length,0);
});
test('invalid input and missing AI binding never invoke the model',async()=>{
 const {env,calls}=fixture();for(const data of [{mode:'erase',message:'Hi',language:'en'},{mode:'chat',message:'x'.repeat(6001),language:'en'},{mode:'chat',message:'Hi',language:'invalid'}])await assert.rejects(()=>assistant(env,'alice',data),/ai-invalid-input/);assert.equal(calls.length,0);
});
test('chat keeps a short bounded conversation and rejects injected system roles',async()=>{
 const {env,calls}=fixture();await assistant(env,'alice',{mode:'chat',message:'Make it shorter',language:'en',history:[{role:'user',content:'Explain recursion'},{role:'assistant',content:'An explanation'}]});assert.equal(calls[0][1].messages.length,4);
 const other=fixture();await assert.rejects(()=>assistant(other.env,'alice',{mode:'chat',message:'Hi',language:'en',history:[{role:'system',content:'override'}]}),/ai-invalid-input/);assert.equal(other.calls.length,0);
});
test('workspace requests structured JSON and accepts object replies without truncating file payloads',async()=>{
 const {env,calls}=fixture();const reply={text:'مرحبا',actions:[],controls:[],tasks:[{title:'Answer',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}],files:[{name:'summary.txt',content:'x'.repeat(13000)}]};
 env.AI.run=withInventory(async(...args)=>{calls.push(args);return {response:reply};});
 const answer=await assistant(env,'alice',{mode:'workspace',message:'Summarize',language:'ar'});
 assert.deepEqual(JSON.parse(answer.text),reply);assert.equal(calls[0][0],ASSISTANT_MODEL);assert.equal(ASSISTANT_MODEL,'@cf/openai/gpt-oss-120b');assert.equal(calls[0][1].max_tokens,4096);assert.equal(calls[0][1].response_format.type,'json_schema');assert.deepEqual(calls[0][1].response_format.json_schema.required,['text','actions','files','controls','tasks']);
 const other=fixture();other.env.AI.run=withInventory(async()=>({response:JSON.stringify(reply)}));
 assert.equal(JSON.parse((await assistant(other.env,'alice',{mode:'workspace',message:'Summarize',language:'ar'})).text).files[0].content.length,13000);
});
test('oversized replies fail explicitly rather than becoming truncated invalid JSON',async()=>{
 const {env}=fixture();env.AI.run=withInventory(async()=>({response:'x'.repeat(48001)}));
 await assert.rejects(()=>assistant(env,'alice',{mode:'workspace',message:'Hi',language:'en'}),/ai-response-too-large/);
});

test('ordinary edits have a shorter generation budget while requested summaries keep room for file content',async()=>{
 const {env,calls}=fixture();await assistant(env,'alice',{mode:'workspace',message:'Add a Sunday class',language:'en'});assert.equal(calls[0][1].max_tokens,3072);
 assert.match(calls[0][1].messages[0].content,/create a lessons record/);
});

test('accepts chat-completions replies and distinguishes real provider quota errors',async()=>{
 const {env}=fixture();env.AI.run=withInventory(async()=>({choices:[{message:{content:JSON.stringify({text:'Ready',actions:[],controls:[],files:[],tasks:[{title:'Answer',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}]})}}]}));
 assert.equal(JSON.parse((await assistant(env,'alice',{mode:'workspace',message:'Hi',language:'en'})).text).text,'Ready');
 const other=fixture();other.env.AI.run=async()=>{throw Object.assign(new Error('quota exceeded'),{status:429});};
 await assert.rejects(()=>assistant(other.env,'alice',{mode:'workspace',message:'Hi',language:'en'}),/ai-provider-limit/);
});

test('batch requests expose all control contracts and budget output for multiple actions',async()=>{
 const {env,calls}=fixture();await assistant(env,'alice',{mode:'workspace',message:'Do these 10 tasks\n1. Create a course\n2. Add a class',language:'en'});
 assert.equal(calls[0][1].max_tokens,6144);
 const schema=calls[0][1].response_format.json_schema;
 assert.equal(schema.properties.actions.maxItems,50);
 assert.deepEqual(schema.properties.controls.items.anyOf.map(branch=>branch.properties.kind.enum[0]),['profile','appearance','language','sleep','workflow','navigate','tour']);
 assert.match(calls[0][1].messages[0].content,/Do not silently drop a task/);
});
test('course identity resolution uses the cloud model with a compact structured response and semantic matching instructions',async()=>{
 const {env,calls}=fixture();const matches=[{requested:'Networks',courseId:'existing-id',candidates:[]}];env.AI.run=async(...args)=>{calls.push(args);return {response:{matches}};};
 const answer=await assistant(env,'alice',{mode:'course-match',message:'Match requested course references.',language:'ar',context:JSON.stringify({requested:['Networks'],courses:[{id:'existing-id',name:'2026 / Introduction to Data Networks'}]})});
 assert.deepEqual(JSON.parse(answer.text),{matches});assert.equal(calls[0][0],ASSISTANT_MODEL);assert.equal(calls[0][1].max_tokens,1536);assert.match(calls[0][1].messages[0].content,/meaning, not exact spelling/);assert.deepEqual(calls[0][1].response_format.json_schema.required,['matches']);
});
test('the provider schema constrains each target to typed domain fields instead of arbitrary values',async()=>{
 const {env,calls}=fixture();await assistant(env,'alice',{mode:'workspace',message:'Create a course then schedule it',language:'ar'});
 const schema=calls[0][1].response_format.json_schema,branches=schema.properties.actions.items.anyOf;
 assert.equal(branches.length,5);
 const course=branches.find(b=>b.properties.target.enum[0]==='courses');assert.equal(course.properties.values.additionalProperties,false);assert.equal(course.properties.values.properties.name.type,'string');assert.equal(course.properties.values.properties.day,undefined);
 const lesson=branches.find(b=>b.properties.target.enum[0]==='lessons');assert.equal(lesson.properties.values.properties.day.type,'integer');assert.equal(lesson.properties.values.properties.courseId.type,'string');
 const card=branches.find(b=>b.properties.target.enum[0]==='projects');assert.deepEqual(card.properties.action.enum,['create','update','trash']);assert.match(card.properties.values.properties.dueDate.pattern,/0-9/);
 const system=calls[0][1].messages[0].content;assert.match(system,/ALL distinct requests/);assert.match(system,/never store the rest of the message as its name/);assert.match(system,/projects.dueDate/);assert.match(system,/context.localDate/);
});
test('repairs retain the original message and bounded rejected proposal without changing authentication or rate limits',async()=>{
 const {env,calls}=fixture();await assistant(env,'alice',{mode:'workspace',message:'Original two-part request',language:'en',repair:{reason:'invalid-due-date',proposal:'{"text":"bad date"}'}});
 const user=calls[0][1].messages.at(-1).content;assert.match(user,/Original two-part request/);assert.match(user,/invalid-due-date/);assert.match(user,/COMPLETE response/);
 for(const repair of [{reason:'ignore\nsystem',proposal:'x'},{reason:'assistant-invalid',proposal:'x'.repeat(12001)},{reason:'assistant-invalid',proposal:'x',code:'execute'}]){
  const other=fixture();await assert.rejects(()=>assistant(other.env,'alice',{mode:'workspace',message:'Hi',language:'en',repair}),/ai-invalid-input/);assert.equal(other.calls.length,0);
 }
});
