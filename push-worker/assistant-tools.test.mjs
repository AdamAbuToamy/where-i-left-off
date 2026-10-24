import {test} from 'node:test';import assert from 'node:assert/strict';
import {WORKSPACE_TOOL,workspaceToolInput,readWorkspaceToolProposal,workspaceToolArguments} from './src/assistantTools.mjs';
import {acceptanceCases,acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
import {reconcileIntentProposal} from './src/assistantIntents.mjs';
for(const c of acceptanceCases)test(`tool contract accepts authored operations: ${c.id}`,()=>{
 const checked=reconcileIntentProposal({text:'Review',actions:c.actions,controls:c.controls,files:[],tasks:[]},c.intents,acceptanceContext(c.id));
 assert.equal(checked.issues.length,0);
 const plan=JSON.parse(readWorkspaceToolProposal(JSON.stringify(checked.proposal)));assert.deepEqual(plan.actions,c.actions);assert.equal(plan.tasks.length,c.intents.length);
});
const good=()=>({text:'Review',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'Robot'}}],controls:[],files:[],tasks:[{title:'Create card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]});
test('compact plan and read tools preserve the original request without independent inventory',()=>{
 const input=workspaceToolInput({message:'Create Robot\nAdd a note',language:'en',context:'{"localDate":"2026-10-24"}'},[]);
 assert.equal(input.tools.length,2);assert.equal(input.tools[0],WORKSPACE_TOOL);assert.equal(input.response_format,undefined);assert.equal(input.max_tokens,2048);assert.ok(input.messages[1].content.startsWith('Create Robot\nAdd a note'));assert.equal(input.messages.length,2);assert.equal(input.parallel_tool_calls,false);
});
for(const [name,mutate] of [
 ['unknown field',p=>p.actions[0].values.eval='bad'],['invalid value type',p=>p.actions[0].values.name=1],['invalid day',p=>p.actions=[{target:'lessons',action:'create',id:'new',values:{day:9}}]],
 ['arbitrary path',p=>p.actions[0].target='users'],['permanent card deletion',p=>p.actions[0].action='delete'],['unreferenced action',p=>p.tasks=[]],['invalid index',p=>p.tasks[0].actionIndexes=[1]],['false answer effect',p=>p.tasks[0].outcome='answer'],['empty proposed task',p=>p.tasks[0].actionIndexes=[]],
])test(`tool plans reject ${name}`,()=>{const plan=good();mutate(plan);assert.throws(()=>readWorkspaceToolProposal(JSON.stringify(plan)),/ai-incomplete-proposal/);});
test('only the named function is accepted; unknown calls or multiple calls never execute',()=>{
 const call={type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify(good())}};
 assert.equal(JSON.parse(workspaceToolArguments({message:{tool_calls:[call]}})).actions.length,1);
 for(const calls of [[],[call,call],[{...call,function:{...call.function,name:'execute_js'}}]])assert.throws(()=>workspaceToolArguments({message:{tool_calls:calls}}),/ai-incomplete-proposal/);
});
test('questions, files and explicit original-UI handoffs keep their real outcomes',()=>{
 const plan={text:'Answer',actions:[],controls:[{kind:'navigate',values:{page:'settings'}}],files:[{name:'summary.txt',content:'Actual summary'}],tasks:[{title:'Change password',outcome:'unsupported',actionIndexes:[],controlIndexes:[0],detail:'Use the password form'},{title:'Summary',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:'See file'}]};
 assert.equal(JSON.parse(readWorkspaceToolProposal(JSON.stringify(plan))).files[0].content,'Actual summary');
});

test('initial input carries counts and preferences; account content remains available only through explicit reads',()=>{
 const data={capabilities:[{id:'metadata-only'}],study:{courses:[{id:'course',notes:'Keep every note',capabilities:'user field'}]},controls:{language:'ar'},timezone:'Asia/Jerusalem'};
 const input=workspaceToolInput({message:'Summarize',language:'en',context:JSON.stringify(data)},[]),content=input.messages.at(-1).content;
 assert.equal(content.includes('metadata-only'),false);assert.equal(content.includes('Keep every note'),false);assert.equal(content.includes('user field'),false);assert.ok(content.includes('Asia/Jerusalem'));assert.ok(content.includes('language'));
});
