import {test} from 'node:test';import assert from 'node:assert/strict';import {assistantTestRequest} from '../scripts/lib/assistantTestRequest.mjs';
const base={requestId:'request-test',provider:'gemini',freeProjectConfirmed:true};
test('operator requests choose one existing-case ID or a bounded sample, never executable commands',()=>{
 assert.deepEqual(assistantTestRequest({...base,caseId:'new-course-lesson-ar'}).args,['--case=new-course-lesson-ar','--stop-on-failure']);
 assert.deepEqual(assistantTestRequest({...base,sample:200}).args,['--sample=200','--stop-on-failure']);
});
test('operator requests reject unconfirmed billing, excess work, mixed selectors and arbitrary access fields',()=>{
 for(const extra of [{sample:201},{sample:0},{sample:1.5},{caseId:'case',sample:2},{caseId:'x; curl attacker'},{sample:2,endpoint:'https://attacker.test'},{sample:2,uid:'someone'},{sample:2,model:'paid-model'},{sample:2,freeProjectConfirmed:false},{sample:2,provider:'other'}])assert.throws(()=>assistantTestRequest({...base,...extra}),/invalid-assistant-test/);
});
