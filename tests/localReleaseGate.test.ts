import {expect,it} from 'vitest';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {assertLocalAcceptance,inferenceEvidenceHash,reportSummary} from '../scripts/lib/localReleaseGate.mjs';
const cases=[{id:'test-1'},{id:'test-2'}];
function report(){return {kind:'live-browser-local-model',provider:'webllm',release:LOCAL_RELEASE,fingerprint:'same-code',browser:{adapter:true},results:cases.map(c=>({id:c.id,status:'passed',reply:'{"text":"Review","actions":[]}',trace:[{stage:'local-inference',text:'actual recorded output'}]}))};}
it('accepts only full matching real browser evidence and separately demands persistence',()=>{
 const r=report();expect(assertLocalAcceptance(r,cases,'same-code')).toBe(true);
 expect(()=>assertLocalAcceptance(r,cases,'same-code',{requirePersistence:true})).toThrow('persistence');
 expect(assertLocalAcceptance({...r,persistence:{status:'passed',cases:2,evidenceHash:inferenceEvidenceHash(r)}},cases,'same-code',{requirePersistence:true})).toBe(true);
});
it('rejects wrong model, wrong code, absent inference, failures, partial and duplicate reports',()=>{
 const r=report();
 expect(()=>assertLocalAcceptance({...r,release:{...LOCAL_RELEASE,model:'ollama-other-model'}},cases,'same-code')).toThrow('model');
 expect(()=>assertLocalAcceptance(r,cases,'new-code')).toThrow('source');
 expect(()=>assertLocalAcceptance({...r,results:r.results.slice(0,1)},cases,'same-code')).toThrow('incomplete');
 expect(()=>assertLocalAcceptance({...r,results:[r.results[0],r.results[0]]},cases,'same-code')).toThrow('case');
 expect(()=>assertLocalAcceptance({...r,results:r.results.map(c=>({...c,trace:[]}))},cases,'same-code')).toThrow('real-inference');
 expect(()=>assertLocalAcceptance({...r,results:r.results.map(c=>({...c,status:'failed'}))},cases,'same-code')).toThrow('real-inference');
});
it('keeps blocked, failed and never-run cases distinct',()=>{
 expect(reportSummary([{id:'one',status:'passed'},{id:'two',status:'blocked'}],618)).toEqual({total:618,passed:1,failed:0,blocked:1,notRun:616});
});
