import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createWorker} from './src/index.mjs'
import {database} from './test-db.mjs'
import {defaults,localParts} from './policy.mjs'
const id='p'.repeat(20)
function fixture(){
 const messages=[],sent=[],projects=[{id,name:'Private task',status:'later',dueDate:new Date().toISOString().slice(0,10),activityAt:1}],blocked=new Set()
 let actor='alice'
 const env={DB:database(),APP_ORIGINS:'https://app.test',VAPID_PUBLIC_KEY:'public',PUSH_QUEUE:{send:async body=>messages.push(body),sendBatch:async values=>messages.push(...values.map(v=>v.body))}}
 const worker=createWorker({verifyIdentity:async req=>{if(req.headers.get('authorization')!=='Bearer valid')throw new Error('unauthenticated');return {uid:actor,token:'test'}},accountAvailable:async(_env,uid)=>{if(blocked.has(uid))throw new Error('account-unavailable')},readCollection:async()=>[],readDocument:async()=>null,scopeProjects:async()=>projects,cardDocument:async(_env,uid,projectId)=>{if(uid!=='alice'||projectId!==id)throw new Error('card-unavailable');return projects[0]},sendPush:async(_env,subscription,payload)=>sent.push({subscription,payload})})
 const call=async(data,origin='https://app.test',token='valid')=>{
  const res=await worker.fetch(new Request('https://worker.test/',{method:'POST',headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(data)}),env)
  const body=await res.json();return {status:res.status,...body}
 }
 async function drain(){while(messages.length){const body=messages.shift();let retry=false;await worker.queue({messages:[{body,ack(){},retry(){retry=true}}]},env);assert.equal(retry,false,JSON.stringify(body))}}
 return {env,worker,call,drain,messages,sent,projects,blocked,setActor:(uid)=>{actor=uid}}
}
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{auth:'a'.repeat(22),p256dh:'b'.repeat(87)}}
test('rejects foreign origins, missing identity and arbitrary push destinations',async()=>{
 const f=fixture()
 assert.equal((await f.call({action:'get'},'https://evil.test')).status,403)
 assert.equal((await f.call({action:'get'},'https://app.test','bad')).status,401)
 assert.equal((await f.call({action:'subscribe',subscription:{...subscription,endpoint:'https://localhost/private'}})).status,400)
})
test('defaults to off and cannot modify another account’s card',async()=>{
 const f=fixture();assert.equal((await f.call({action:'get'})).result.preferences.enabled,false)
 f.setActor('bob');assert.equal((await f.call({action:'card',projectId:id,time:'09:00',weekly:false,disabled:false})).status,400)
})
test('device ownership transfers safely and old unsubscribe cannot remove new binding',async()=>{
 const f=fixture();await f.call({action:'subscribe',subscription});f.setActor('bob');await f.call({action:'subscribe',subscription})
 f.setActor('alice');await f.call({action:'unsubscribe',subscription})
 assert.equal(f.env.DB.sqlite.prepare('SELECT uid FROM devices').get().uid,'bob')
 f.setActor('bob');assert.equal((await f.call({action:'test',subscription})).status,200);assert.equal((await f.call({action:'test',subscription})).status,400)
})
test('scheduler queues due work once; delivery verifies completion and consent again',async()=>{
 const f=fixture(),now=Date.now(),time=localParts(now-60000,'UTC').time
 await f.call({action:'subscribe',subscription});await f.call({action:'save',preferences:{...defaults,enabled:true,quiet:false,timezone:'UTC',defaultTime:time}})
 f.env.DB.sqlite.prepare('UPDATE accounts SET enabled_at=?').run(now-3600000)
 await f.worker.scheduled({},f.env);await f.drain()
 assert.equal(f.sent.length,1);assert.equal(f.sent[0].payload.body,'افتح التطبيق للاطلاع على التذكير')
 await f.worker.scheduled({},f.env);await f.drain();assert.equal(f.sent.length,1)
 const row=f.env.DB.sqlite.prepare('SELECT next_at FROM scopes').get();assert.ok(row.next_at>now+3600000,'Avoid a once-per-minute full scan')
 await f.call({action:'save',preferences:{...defaults,enabled:false}});await f.worker.scheduled({},f.env);await f.drain();assert.equal(f.sent.length,1)
})
test('queued messages cannot cross accounts, survive cancellation or reveal completed cards',async()=>{
 const f=fixture(),now=Date.now(),time=localParts(now-60000,'UTC').time
 await f.call({action:'subscribe',subscription});await f.call({action:'save',preferences:{...defaults,enabled:true,quiet:false,timezone:'UTC',defaultTime:time}})
 f.env.DB.sqlite.prepare('UPDATE accounts SET enabled_at=?').run(now-3600000)
 await f.worker.scheduled({},f.env)
 const job=f.messages.shift();await f.worker.queue({messages:[{body:job,ack(){},retry(){assert.fail('planning failed')}}]},f.env)
 assert.equal(f.messages.length,1)
 f.projects[0].status='done';await f.drain();assert.equal(f.sent.length,0)
})
test('unavailable accounts are erased with all their subscriptions and settings',async()=>{
 const f=fixture();await f.call({action:'subscribe',subscription});await f.call({action:'save',preferences:{...defaults,enabled:true,quiet:false}})
 f.blocked.add('alice');await f.worker.scheduled({},f.env);await f.drain()
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,0)
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM devices').get().n,0)
})
