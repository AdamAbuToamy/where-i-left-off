import {buildPushPayload} from '@block65/webcrypto-web-push'
export async function sendPush(env,subscription,data){
 let payload
 try{payload=await buildPushPayload({data:JSON.stringify(data),options:{ttl:3600}},subscription,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY})}catch{throw new Error('push-crypto-failed')}
 // Never follow a redirect to a host outside the approved browser push services.
 const response=await fetch(subscription.endpoint,{...payload,redirect:'manual',signal:AbortSignal.timeout(10000)})
 console.info('push.provider.response',{status:response.status,provider:new URL(subscription.endpoint).hostname})
 if(!response.ok){const e=new Error('push-failed');e.status=response.status;throw e}
}
