import {test} from 'node:test';import assert from 'node:assert/strict';import {providerStop,acceptanceSummary} from '../scripts/lib/assistantAcceptance.mjs';
test('quota/access stop immediately, unavailable stops after three, semantic failures do not stop the suite',()=>{
 assert.equal(providerStop('ai-provider-limit',1),true);assert.equal(providerStop('ai-provider-access',1),true);assert.equal(providerStop('ai-unavailable-or-quota',1),false);assert.equal(providerStop('ai-unavailable-or-quota',3),true);assert.equal(providerStop('ai-intent-format',100),false);
});
test('blocked provider calls are pending, never reported as failed comprehension',()=>{
 const rows=[{id:'a',status:'passed',elapsedMs:21000},{id:'b',status:'failed',elapsedMs:22000},{id:'c',status:'blocked',elapsedMs:90}];
 assert.deepEqual(acceptanceSummary(rows,618),{passed:1,failed:1,blocked:1,notRun:616,slowOver20s:2});
});
