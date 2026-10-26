import {test} from 'node:test';import assert from 'node:assert/strict';
import {conversationInput,readConversationChoice} from './src/assistantConversation.mjs';
import {workspaceToolInput,workspaceToolStep} from './src/assistantTools.mjs';
import {assistantProvider} from './src/assistantProvider.mjs';
test('chat starts with native optional tools and no workspace snapshot or forced planner',()=>{
 const input=conversationInput({message:'مرحبا',language:'ar',displayName:'Adam'},[]);assert.equal(input.tool_choice,'auto');assert.equal(input.tools.length,1);assert.equal(input.result_protocol,'conversation');assert(!JSON.stringify(input).includes('ACCOUNT CONTEXT'));
 assert.deepEqual(readConversationChoice({message:{content:'مرحبا!'}}),{conversation:{text:'مرحبا!',needsWorkspace:false}});
 assert.deepEqual(readConversationChoice({message:{tool_calls:[{type:'function',function:{name:'request_workspace',arguments:'{}'}}]}}),{conversation:{text:'',needsWorkspace:true}});
});
test('plain provider messages remain ordinary answers with no proposed edits',()=>{
 const result=workspaceToolStep({message:{content:'Welcome'}});const reply=JSON.parse(result.response);assert.equal(reply.text,'Welcome');assert.deepEqual(reply.actions,[]);assert.deepEqual(reply.controls,[]);
});
test('supports the verified free GLM-4.5-Flash model without selecting a paid model',()=>{
 assert.equal(assistantProvider({ASSISTANT_PROVIDER:'zai',ZAI_API_KEY:'synthetic',ZAI_MODEL:'glm-4.5-flash'}).model,'glm-4.5-flash');
});
test('ordinary chat always knows the app card domain before choosing tools',()=>{
 const input=conversationInput({message:'اضف بطاقة',language:'ar'},[]),system=input.messages[0].content;
 assert.ok(system.includes('project/reminder cards'));assert.ok(system.includes('never payment cards'));assert.ok(system.includes('Never ask for payment numbers, CVV'));assert.ok(system.includes('handles clarification'));
});
test('router receives readable prior replies, not app metadata as examples to imitate',()=>{
 const input=conversationInput({message:'Create the section and finish that card',language:'en'},[{role:'assistant',content:JSON.stringify({text:'Review',status:'pending',proposal:{actions:[{target:'projects',action:'create',id:'new-card',values:{name:'Ammar'}}]}})}]);
 assert.ok(input.messages[1].content.startsWith('Review\nUnfinished request'));assert.ok(input.messages[1].content.includes('Ammar'));assert.throws(()=>JSON.parse(input.messages[1].content));
 assert.throws(()=>readConversationChoice({message:{content:JSON.stringify({text:'Saved',status:'saved',proposal:{actions:[]}})}}),/ai-incomplete-proposal/);
});