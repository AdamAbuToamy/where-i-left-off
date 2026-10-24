import {test} from 'node:test';import assert from 'node:assert/strict';
import {liveReplayCases} from '../scripts/lib/liveAssistantReport.mjs';
const cases=[{id:'one',actions:[{expected:true}]}],report=()=>({kind:'live-provider-synthetic-data',provider:'gemini',results:[{id:'one',status:'passed',reply:'{"actions":[],"text":"actual model reply"}'}]});
test('persistence replay uses the exact saved model reply rather than the authored expected action',()=>{
 const r=report(),selected=liveReplayCases(r,cases);assert.equal(selected[0].reply,r.results[0].reply);assert.equal(selected[0].reply.includes('expected'),false);
});
for(const [label,change] of [['wrong kind',r=>r.kind='fixture'],['missing model reply',r=>delete r.results[0].reply],['unknown case',r=>r.results[0].id='unknown'],['duplicate',r=>r.results.push(r.results[0])],['no inference success',r=>r.results[0].status='blocked']])test('replay refuses '+label,()=>{const r=report();change(r);assert.throws(()=>liveReplayCases(r,cases),/live-report-/);});
