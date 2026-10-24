import {test} from 'node:test';import assert from 'node:assert/strict';
import {geminiTools,geminiFailure} from './src/assistantGemini.mjs';
import {workspaceToolInput,readWorkspaceToolProposal} from './src/assistantTools.mjs';
import {safeProviderFailure,assistantProviderError} from './src/assistantErrors.mjs';
test('Gemini has typed, nonempty nested value objects, including every task and card kind, without mutating the compact Groq schema',()=>{
 const input=workspaceToolInput({language:'en',message:'Create a card',context:'{}'},[]),before=JSON.stringify(input.tools),tools=geminiTools(input.tools);
 const actions=tools[0].function.parameters.properties.actions.items.properties.values;
 assert.ok(actions.properties.name);assert.ok(actions.properties.courseId);assert.ok(actions.properties.start);assert.ok(actions.properties.description);
 assert.ok(actions.properties.kind.enum.includes('assignment'));assert.ok(actions.properties.kind.enum.includes('resume'));assert.equal(actions.properties.name.type,'string');assert.equal(actions.properties.name.maxLength,undefined);assert.equal(tools[0].function.parameters.properties.controls.items.properties.values.properties.reviewDays.type,'integer');
 const visit=s=>{assert.equal(s.additionalProperties,undefined);if(s.enum)assert.ok(s.enum.every(v=>typeof v==='string'));if(s.type==='object')assert.ok(Object.keys(s.properties||{}).length);for(const v of Object.values(s))if(v&&typeof v==='object'){if(Array.isArray(v)){for(const item of v)if(item&&typeof item==='object')visit(item);}else visit(v);}};
 for(const tool of tools)visit(tool.function.parameters);assert.equal(JSON.stringify(input.tools),before);
 const invalid={text:'Review',actions:[{target:'projects',action:'create',id:'new',scope:'personal',values:{name:'Card',courseId:'illegal'}}],controls:[],files:[],tasks:[{title:'Create',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};assert.throws(()=>readWorkspaceToolProposal(JSON.stringify(invalid)),/ai-incomplete-proposal/);
});
test('known Google schema rejection is diagnosed without printing an upstream message',()=>{
 const d=geminiFailure({status:'INVALID_ARGUMENT',message:'secret-key properties[values].properties: should be non-empty for OBJECT type'});assert.deepEqual(d,{code:'invalid_argument',hint:'empty-object-schema',parameter:'tools'});
 const safe=safeProviderFailure({status:400,providerCode:d.code,providerHint:d.hint,providerParameter:d.parameter});assert.equal(safe.hint,'empty-object-schema');assert.equal(JSON.stringify(safe).includes('secret-key'),false);assert.equal(assistantProviderError({status:400}),'ai-provider-request');
 assert.equal(safeProviderFailure({status:400,providerHint:'private upstream body'}).hint,undefined);
});
