import {test} from 'node:test';import assert from 'node:assert/strict';
import {groqRateLimit,minuteRetry,safeGroqRate} from './src/groqLimits.mjs';
import {assistantProvider} from './src/assistantProvider.mjs';import {safeProviderFailure,assistantProviderError} from './src/assistantErrors.mjs';
test('classifies request size, minute throttling and daily exhaustion without exposing upstream text',()=>{
 const oversized=groqRateLimit('Request too large. tokens per minute (TPM): Limit 8000, Requested 12000','60');assert.equal(oversized.oversized,true);assert.equal(minuteRetry(oversized),false);
 const minute=groqRateLimit('tokens per minute (TPM): Limit 8000, Requested 3000','0.001');assert.equal(minuteRetry(minute),true);
 assert.equal(minuteRetry(groqRateLimit('tokens per day (TPD): Limit 200000, Requested 1000','1')),false);assert.equal(minuteRetry(groqRateLimit('unknown','1')),false);assert.equal(safeGroqRate({scope:'secret-value'}),undefined);
});
async function fake(work,run){const old=globalThis.fetch;globalThis.fetch=work;try{await run();}finally{globalThis.fetch=old;}}
test('a short minute wait retries once; a second failure returns safe numeric limits',async()=>{
 let calls=0;await fake(async()=>{calls++;return Response.json({error:{code:'rate_limit_exceeded',message:'tokens per minute (TPM): Limit 8000, Requested 1000'}},{status:429,headers:{'retry-after':'0.001'}});},async()=>{
 await assert.rejects(assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-key'}).run({messages:[],max_tokens:10}),e=>safeProviderFailure(e).rate.scope==='tokens-minute');assert.equal(calls,2);
 });
});
test('an oversized TPM request is a context rejection, never retried as daily quota',async()=>{
 let calls=0;await fake(async()=>{calls++;return Response.json({error:{code:'rate_limit_exceeded',message:'tokens per minute (TPM): Limit 8000, Requested 12000'}},{status:429});},async()=>{
 await assert.rejects(assistantProvider({ASSISTANT_PROVIDER:'groq',GROQ_API_KEY:'test-key'}).run({messages:[],max_tokens:10}),e=>assistantProviderError(e)==='ai-provider-context'&&safeProviderFailure(e).rate.requested===12000);assert.equal(calls,1);
 });
});
