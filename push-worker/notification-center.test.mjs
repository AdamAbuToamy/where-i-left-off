import {test} from 'node:test';import assert from 'node:assert/strict';
import {database} from './test-db.mjs';import {defaults,localParts} from './policy.mjs';import {ensureAccount,erase} from './src/store.mjs';
import {readNotifications,readThrough,recordNotification} from './src/notificationCenter.mjs';import {createWorker} from './src/index.mjs';
const identity=uid=>({uid,email:uid+'@example.test',emailVerified:true});
test('notification center requires a verified account, isolates accounts, bounds read and retains account read state',async()=>{
 const env={DB:database()};await ensureAccount(env,'a',defaults);await ensureAccount(env,'b',defaults);
 await assert.rejects(readNotifications(env,{email:'ordinary@example.test',emailVerified:true}),/account-unavailable/);
 await assert.rejects(readNotifications(env,{...identity('a'),emailVerified:false}),/account-unavailable/);
 await recordNotification(env,'a','old',{title:'Old',body:'Not opted in',url:'#/settings'},1);assert.equal((await readNotifications(env,identity('a'))).items.length,0);
 const payload={title:'Reminder',body:'A card is due',url:'#/personal/'+ 'p'.repeat(20)};
 await recordNotification(env,'a','one',payload,100);await recordNotification(env,'a','one',payload,100);await recordNotification(env,'a','two',payload,200);
 let feed=await readNotifications(env,identity('a'));assert.equal(feed.items.length,2);assert.equal(feed.unread,2);assert.equal((await readNotifications(env,identity('b'))).items.length,0);
 await readThrough(env,identity('a'),100);feed=await readNotifications(env,identity('a'));assert.equal(feed.unread,1);await readThrough(env,identity('a'),0);assert.equal((await readNotifications(env,identity('a'))).lastRead,100);
 await assert.rejects(readThrough(env,identity('a'),Date.now()+100000),/invalid-size/);
 await erase(env,'a');assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM notification_items WHERE uid=?').bind('a').first()).count,0);
});
test('multi-device deliveries deduplicate by event and storage stays within 100 items',async()=>{const env={DB:database()};await ensureAccount(env,'a',defaults);await readNotifications(env,identity('a'));for(let i=0;i<105;i++)await recordNotification(env,'a','event_'+i,{title:'Reminder',body:'Content',url:'#/settings'},i);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM notification_items WHERE uid=?').bind('a').first()).count,100);assert.equal((await readNotifications(env,identity('a'))).items.length,50);});
test('HTTP notification actions use verified request identity rather than a supplied uid',async()=>{const env={DB:database(),APP_ORIGINS:'https://app.test'},worker=createWorker({verifyIdentity:async()=>identity('owner'),accountAvailable:async()=>{}});const request=()=>new Request('https://worker.test/',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify({action:'notifications',uid:'victim'})});const response=await worker.fetch(request(),env);assert.equal(response.status,200);assert.equal(await env.DB.prepare('SELECT uid FROM notification_centers WHERE uid=?').bind('victim').first(),null);assert.ok(await env.DB.prepare('SELECT uid FROM notification_centers WHERE uid=?').bind('owner').first());});

test('a real reminder delivery is recorded once for the bell and preserves hidden-content preference',async()=>{
 const now=Date.now(),id='p'.repeat(20),messages=[],sent=[],project={id,name:'Private card',status:'later',dueDate:new Date(now).toISOString().slice(0,10),activityAt:1};
 const env={DB:database(),APP_ORIGINS:'https://app.test',VAPID_PUBLIC_KEY:'public',PUSH_QUEUE:{send:async body=>messages.push(body),sendBatch:async values=>messages.push(...values.map(v=>v.body))}};
 const worker=createWorker({verifyIdentity:async()=>({...identity('owner'),token:'test'}),accountAvailable:async()=>{},readCollection:async()=>[],scopeProjects:async()=>[project],cardDocument:async()=>project,sendPush:async(_env,_subscription,payload)=>sent.push(payload)});
 const call=async data=>{const response=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{origin:'https://app.test','content-type':'application/json'},body:JSON.stringify(data)}),env);assert.equal(response.status,200);return (await response.json()).result;};
 await call({action:'notifications'});await call({action:'subscribe',subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{auth:'a'.repeat(22),p256dh:'b'.repeat(87)}}});await call({action:'save',preferences:{...defaults,enabled:true,quiet:false,hideContent:true,timezone:'UTC',defaultTime:localParts(now-60000,'UTC').time}});env.DB.sqlite.prepare('UPDATE accounts SET enabled_at=?').run(now-3600000);
 await worker.scheduled({},env);while(messages.length){const body=messages.shift();await worker.queue({messages:[{body,ack(){},retry(){assert.fail('delivery unexpectedly retried')}}]},env);}
 assert.equal(sent.length,1);const feed=await call({action:'notifications'});assert.equal(feed.items.length,1);assert.equal(feed.items[0].body,sent[0].body);assert.equal(feed.items[0].body.includes('Private card'),false);assert.equal(feed.items[0].url,'#/personal/'+id);
});
