import {test} from 'node:test';import assert from 'node:assert/strict';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';import {assistantSample} from '../scripts/lib/assistantSample.mjs';
test('200 real-case inputs cover every mutation target, all three languages, settings and ten-action requests without duplicates',()=>{
 const cases=assistantSample(acceptanceCases,200);assert.equal(cases.length,200);assert.equal(new Set(cases.map(c=>c.message)).size,200);assert.deepEqual(new Set(cases.map(c=>c.language)),new Set(['ar','en','he']));
 for(const target of ['projects','sections','courses','tasks','lessons'])for(const action of ['create','update',target==='projects'?'trash':'delete'])assert.ok(cases.some(c=>c.actions.some(a=>a.target===target&&a.action===action)),target+'/'+action);
 for(const kind of ['appearance','language','sleep','workflow','navigate'])assert.ok(cases.some(c=>c.controls.some(v=>v.kind===kind)),kind);
 for(const language of ['ar','en','he'])assert.ok(cases.some(c=>c.id==='ten-cards-'+language));
 assert.deepEqual(assistantSample(acceptanceCases,200).map(c=>c.id),cases.map(c=>c.id));
});
test('sampling rejects impossible or noninteger sizes',()=>{for(const n of [0,-1,1.5,99999,NaN])assert.throws(()=>assistantSample(acceptanceCases,n),/invalid-sample-size/);});
