import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createECDH,randomBytes} from 'node:crypto'
import webpush from 'web-push'
import ece from 'http_ece'
import {buildPushPayload} from '@block65/webcrypto-web-push'
import {jwtVerify,importJWK} from 'jose'
test('native Workers payload decrypts with independent Web Push implementation and valid VAPID signature',async()=>{
 const ua=createECDH('prime256v1');ua.generateKeys();const auth=randomBytes(16),keys=webpush.generateVAPIDKeys()
 const subscription={endpoint:'https://web.push.apple.com/example',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}}
 const text=JSON.stringify({uid:'alice',title:'تذكير',body:'افتح التطبيق',url:'#/settings'})
 const payload=await buildPushPayload({data:text,options:{ttl:3600}},subscription,{...keys,subject:'mailto:test@example.test'})
 assert.equal(payload.headers['content-encoding'],'aes128gcm')
 assert.equal(ece.decrypt(Buffer.from(payload.body),{version:'aes128gcm',privateKey:ua,authSecret:auth}).toString(),text)
 const publicBytes=Buffer.from(keys.publicKey,'base64url')
 const key=await importJWK({kty:'EC',crv:'P-256',x:publicBytes.subarray(1,33).toString('base64url'),y:publicBytes.subarray(33).toString('base64url')},'ES256')
 const token=payload.headers.authorization.match(/vapid t=([^,]+)/)[1]
 const {payload:claims}=await jwtVerify(token,key,{audience:'https://web.push.apple.com',algorithms:['ES256']})
 assert.equal(claims.sub,'mailto:test@example.test')
})
