import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createECDH,randomBytes} from 'node:crypto'
import webpush from 'web-push'
import {sendPush} from './src/push.mjs'

test('uses Worker-compatible manual redirects and rejects provider redirects',async()=>{
 const keys=webpush.generateVAPIDKeys(),ua=createECDH('prime256v1');ua.generateKeys()
 const env={VAPID_SUBJECT:'mailto:test@example.test',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey}
 const subscription={endpoint:'https://fcm.googleapis.com/example',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}
 const original=globalThis.fetch
 let status=302,requests=0
 globalThis.fetch=async(url,options)=>{
  requests++;assert.equal(url,subscription.endpoint);assert.equal(options.redirect,'manual')
  assert.equal(options.headers['content-encoding'],'aes128gcm')
  return new Response(null,{status,headers:{location:'https://example.test/untrusted'}})
 }
 try{
  await assert.rejects(sendPush(env,subscription,{title:'Test'}),{message:'push-failed',status:302})
  assert.equal(requests,1)
  status=201;await sendPush(env,subscription,{title:'Test'});assert.equal(requests,2)
 }finally{globalThis.fetch=original}
})
