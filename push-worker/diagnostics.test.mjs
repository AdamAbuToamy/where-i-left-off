import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createWorker} from './src/index.mjs'
test('failure diagnostics show stage and safe reason without logging tokens or request contents',async()=>{
 const logs=[],original=console.warn
 console.warn=(...values)=>logs.push(values)
 try {
  const worker=createWorker({verifyIdentity:async()=>{throw Object.assign(new Error('secret-value-must-not-appear'),{code:'ERR_JWT_CLAIM_VALIDATION_FAILED',claim:'aud'})}})
  const response=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{origin:'https://app.test',authorization:'Bearer private-auth-token','x-firebase-appcheck':'private-app-token'},body:JSON.stringify({action:'test',private:'private-card-text'})}),{APP_ORIGINS:'https://app.test'})
  assert.equal(response.status,400)
  const text=JSON.stringify(logs)
  assert.ok(text.includes('push.http.failed'));assert.ok(text.includes('ERR_JWT_CLAIM_VALIDATION_FAILED'));assert.ok(text.includes('aud'))
  for(const secret of ['secret-value-must-not-appear','private-auth-token','private-app-token','private-card-text'])assert.equal(text.includes(secret),false)
 }finally{console.warn=original}
})

test('owner pilot rejects other verified accounts before database reads or inference',async()=>{
 let touched=false;
 const worker=createWorker({verifyIdentity:async()=>({uid:'other',email:'other@example.test',emailVerified:true}),accountAvailable:async()=>{touched=true;}});
 const response=await worker.fetch(new Request('https://worker.test/assistant',{method:'POST',headers:{origin:'https://app.test'},body:JSON.stringify({mode:'health',email:'adam2002hosny@gmail.com'})}),{APP_ORIGINS:'https://app.test',ASSISTANT_PILOT_EMAIL:'adam2002hosny@gmail.com'});
 assert.equal(response.status,403);assert.equal(touched,false);assert.equal((await response.json()).error,'ai-account-unavailable');
});
