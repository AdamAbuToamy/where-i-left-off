import {test} from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose'
import {verifyIdentity,readDocument} from './src/firebase.mjs'
const pair=await generateKeyPair('RS256'),jwk=await exportJWK(pair.publicKey);jwk.kid='test-key'
const keys={auth:createLocalJWKSet({keys:[jwk]}),app:createLocalJWKSet({keys:[jwk]})}
const env={FIREBASE_PROJECT_ID:'demo-project',FIREBASE_APP_ID:'1:123:web:testapp'}
async function token(claims){return new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuedAt().setExpirationTime('1h').sign(pair.privateKey)}
async function request(auth={},app={}){
 const identity=await token({sub:'alice',aud:'demo-project',iss:'https://securetoken.google.com/demo-project',auth_time:Math.floor(Date.now()/1000)-1,...auth})
 const check=await token({sub:env.FIREBASE_APP_ID,aud:['projects/123'],iss:'https://firebaseappcheck.googleapis.com/123',...app})
 return new Request('https://worker.test',{headers:{authorization:`Bearer ${identity}`,'x-firebase-appcheck':check}})
}
test('verifies both signatures and binds identity to the Firebase project and Web App',async()=>{
 const result=await verifyIdentity(await request(),env,keys)
 assert.equal(result.uid,'alice');assert.ok(result.token.appcheck)
})
test('rejects missing App Check, cross-project identity and cross-app token',async()=>{
 const good=await request(),headers=new Headers(good.headers);headers.delete('x-firebase-appcheck')
 await assert.rejects(verifyIdentity(new Request(good.url,{headers}),env,keys))
 await assert.rejects(verifyIdentity(await request({aud:'another-project'}),env,keys))
 await assert.rejects(verifyIdentity(await request({}, {sub:'1:123:web:foreign'}),env,keys))
 await assert.rejects(verifyIdentity(await request({}, {aud:['projects/999']}),env,keys))
})
test('forwards the verified App Check token to Firestore REST, preserving enforcement',async()=>{
 const original=globalThis.fetch;let headers
 try {
  globalThis.fetch=async(_url,options)=>{headers=options.headers;return Response.json({fields:{name:{stringValue:'Task'}}})}
  const result=await readDocument(env,'users/alice/projects/task',{auth:'id-token',appcheck:'app-token'})
  assert.equal(result.name,'Task');assert.equal(headers.Authorization,'Bearer id-token');assert.equal(headers['X-Firebase-AppCheck'],'app-token')
 }finally{globalThis.fetch=original}
})

test('pilot identity uses the signed email claim, never request body or an unverified flag',async()=>{
 const result=await verifyIdentity(await request({email:'Adam2002hosny@gmail.com',email_verified:true}),env,keys);
 assert.equal(result.email,'adam2002hosny@gmail.com');assert.equal(result.emailVerified,true);
 const unverified=await verifyIdentity(await request({email:'adam2002hosny@gmail.com'}),env,keys);
 assert.equal(unverified.emailVerified,false);
});
