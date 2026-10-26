import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantProvider,ZAI_MODEL} from './src/assistantProvider.mjs';
import {WORKSPACE_TOOL} from './src/assistantTools.mjs';
test('Z.ai selects only the free Flash model with server credentials and native tools',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.z.ai/api/paas/v4/chat/completions');
   const body=JSON.parse(options.body);
   assert.equal(body.model,'glm-4.7-flash');assert.equal(body.model,ZAI_MODEL);
   assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.reasoning_effort,undefined);
   assert.equal(body.max_tokens,1024);assert.equal(body.tools[0].function.parameters.properties.tasks,undefined);
   return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'p',type:'function',function:{name:'propose_workspace_actions',arguments:JSON.stringify({text:'Review',actions:[{target:'sections',action:'create',id:'new',scope:'personal',values:{name:'Reading'}}],controls:[],files:[]})}}]}}]});
  };
  const provider=assistantProvider({ASSISTANT_PROVIDER:'zai',ZAI_API_KEY:'synthetic-test-key'});
  const result=await provider.run({messages:[],tools:[WORKSPACE_TOOL],max_tokens:1024,temperature:0});
  assert.equal(JSON.parse(result.response).actions[0].values.name,'Reading');
 }finally{globalThis.fetch=original;}
});
test('missing Z.ai credentials never fall back to a different or paid provider',()=>{
 assert.throws(()=>assistantProvider({ASSISTANT_PROVIDER:'zai',AI:{run(){throw new Error('must not run');}}}),/ai-not-configured/);
});