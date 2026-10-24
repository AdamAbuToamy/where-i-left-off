import {ASSISTANT_PROTOCOL,assistantFailure,assistantHealth} from './assistantEndpoint.mjs'
import {assistant} from './assistant.mjs'
import {defaults,preferences,clock,validSubscription,cardKey,candidate,quietNow,localParts} from '../policy.mjs'
import {nextCheck,afterQuiet} from '../schedule.mjs'
import * as firebase from './firebase.mjs'
import * as store from './store.mjs'
import {sendPush} from './push.mjs'
const DAY=86400000
const knownReasons=new Set(['unauthenticated','account-unavailable','reader-auth-failed','wrong-project','database-unavailable','auth-lookup-failed','push-failed','push-crypto-failed','too-many-cards','invalid-subscription','test-unavailable','device-limit','invalid-card','card-unavailable','invalid-reminder','invalid-size','unknown-action'])
function diagnostic(error){
 const reason=knownReasons.has(error?.message)?error.message:typeof error?.code==='string'&&/^ERR_(JWT|JWS|JWKS|JOSE)_[A-Z_]+$/.test(error.code)?error.code:'runtime'
 return {reason,...(Number.isInteger(error?.status)?{upstreamStatus:error.status}:{}),...(['aud','iss','sub','exp','iat'].includes(error?.claim)?{claim:error.claim}:{})}
}
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')
const messages={ar:{due:'حان موعد مهمتك',stale:'بطاقة تنتظر عودتك',private:'افتح التطبيق للاطلاع على التذكير'},en:{due:'Your task reminder',stale:'A card is waiting for you',private:'Open the app to view your reminder'},he:{due:'תזכורת למשימה',stale:'כרטיס מחכה לך',private:'פתחו את האפליקציה לצפייה בתזכורת'}}
export function createWorker(overrides={}){
 const f={...firebase,...overrides},send=overrides.sendPush || sendPush
 async function sync(env,identity,data){
  const row=await store.account(env,identity.uid)
  await env.DB.prepare('UPDATE scopes SET next_at=?,lease=0 WHERE uid=?').bind(Date.now(),identity.uid).run()
  if(Date.now()-row.last_sync<5000)return
  await env.DB.prepare('UPDATE accounts SET last_sync=? WHERE uid=?').bind(Date.now(),identity.uid).run()
  const groups=await f.readCollection(env,`users/${identity.uid}/groupMemberships`,identity.token)
  await store.wake(env,identity.uid)
  for(const group of groups)await store.wake(env,identity.uid,group.id)
  // A member editing a shared card can wake its assignee's existing schedule.
  // Read permission is checked by Firestore with the caller's own token.
  for(const ref of (Array.isArray(data.cards)?data.cards:[]).slice(0,8)){
   if(!/^[A-Za-z0-9]{20}$/.test(ref.groupId) || !/^[A-Za-z0-9]{20}$/.test(ref.projectId))continue
   const project=await f.readDocument(env,`groups/${ref.groupId}/projects/${ref.projectId}`,identity.token)
   if(project?.assignedTo && project.assignedTo!==identity.uid)await store.wake(env,project.assignedTo,ref.groupId)
  }
 }
 async function action(env,identity,data){
  const {uid}=identity
  if(data.action==='erase'){await store.erase(env,uid);return {ok:true}}
  await f.accountAvailable(env,uid)
  await store.ensureAccount(env,uid,defaults)
  let row=await store.account(env,uid)
  if(data.action==='get'){
   const cards=await env.DB.prepare('SELECT id,settings FROM cards WHERE uid=?').bind(uid).all()
   return {preferences:preferences(JSON.parse(row.prefs)),publicKey:env.VAPID_PUBLIC_KEY,cards:Object.fromEntries(cards.results.map(c=>[c.id,JSON.parse(c.settings)]))}
  }
  if(data.action==='save'){
   const p=preferences(data.preferences),at=p.enabled&&!row.enabled?Date.now():row.enabled_at
   await env.DB.prepare('UPDATE accounts SET prefs=?,enabled=?,enabled_at=? WHERE uid=?').bind(JSON.stringify(p),p.enabled?1:0,at,uid).run()
   await store.wake(env,uid)
   await env.DB.prepare('UPDATE scopes SET next_at=? WHERE uid=?').bind(Date.now(),uid).run()
   if(p.enabled)await sync(env,identity,{})
  }else if(data.action==='sync'){await sync(env,identity,data)}
  else if(['subscribe','unsubscribe','test'].includes(data.action)){
   if(!validSubscription(data.subscription))throw new Error('invalid-subscription')
   const id=await hash(data.subscription.endpoint)
   if(data.action==='subscribe'){
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE uid=? AND id<>?').bind(uid,id).first()
    if(count.n>=5)throw new Error('device-limit')
    await env.DB.prepare('INSERT INTO devices(id,uid,subscription) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET uid=excluded.uid,subscription=excluded.subscription').bind(id,uid,JSON.stringify({endpoint:data.subscription.endpoint,keys:data.subscription.keys})).run()
    await store.wake(env,uid)
   }else if(data.action==='unsubscribe')await env.DB.prepare('DELETE FROM devices WHERE id=? AND uid=?').bind(id,uid).run()
   else{
    const claimed=await env.DB.prepare('UPDATE devices SET last_test=? WHERE id=? AND uid=? AND last_test<? RETURNING id').bind(Date.now(),id,uid,Date.now()-60000).all()
    if(!claimed.results.length)throw new Error('test-unavailable')
    await env.PUSH_QUEUE.send({type:'test',uid,deviceId:id,createdAt:Date.now()})
   }
  }else if(data.action==='card' || data.action==='viewed'){
   const groupId=data.groupId || '',id=cardKey(data.projectId,groupId)
   await f.cardDocument(env,uid,data.projectId,groupId,identity.token)
   const card=await store.card(env,uid,id)
   if(data.action==='viewed'){
    if(row.enabled&&Date.now()-(card.lastViewedAt || 0)>3600000){card.lastViewedAt=Date.now();await store.saveCard(env,uid,id,card)}
   }else{
    if(typeof data.disabled!=='boolean'||typeof data.weekly!=='boolean'||data.time!==''&&!clock(data.time))throw new Error('invalid-reminder')
    await store.saveCard(env,uid,id,{...card,disabled:data.disabled,weekly:data.weekly,time:data.time})
   }
   await store.wake(env,uid,groupId)
  }else throw new Error('unknown-action')
  return {ok:true}
 }
 async function plan(env,{uid,scope='',lease}){
  const row=await store.account(env,uid)
  if(!row?.enabled)return
  const p=preferences(JSON.parse(row.prefs)),now=Date.now()
  if(quietNow(p,now)){await env.DB.prepare('UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?').bind(afterQuiet(p,now),uid,scope,lease).run();return}
  await f.accountAvailable(env,uid)
  const projects=await f.scopeProjects(env,uid,scope)
  const devices=(await env.DB.prepare('SELECT id FROM devices WHERE uid=?').bind(uid).all()).results
  if(!devices.length){await env.DB.prepare('UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?').bind(now+DAY,uid,scope,lease).run();return}
  const events=(await env.DB.prepare('SELECT id,type,event_key FROM events WHERE uid=?').bind(uid).all()).results
  const previous=new Map(events.map(e=>[e.id+'/'+e.type,e.event_key]))
  let queued=0
  const stored=(await env.DB.prepare('SELECT id,settings FROM cards WHERE uid=?').bind(uid).all()).results
  const cards=new Map(stored.map(c=>[c.id,JSON.parse(c.settings)]))
  let next=now+DAY,lastStaleDate=row.last_stale_date
  for(const project of projects){
   const id=cardKey(project.id,scope),card=cards.get(id) || {},event=candidate(project,card,p,now,row.enabled_at)
   let consumed=!!event && previous.get(id+'/'+event.type)===event.key
   if(event && !consumed && queued>=8){next=Math.min(next,now+60000);continue}
   if(event && !consumed && devices.length && !(event.type==='stale'&&lastStaleDate===localParts(now,p.timezone).date)){
    consumed=await store.claimEvent(env,uid,id,event.type,event.key)
    if(consumed){
     queued++
     if(event.type==='stale'){
      const day=localParts(now,p.timezone).date
      const claim=await env.DB.prepare('UPDATE accounts SET last_stale_date=? WHERE uid=? AND last_stale_date<>? RETURNING uid').bind(day,uid,day).all()
      if(!claim.results.length)continue
      lastStaleDate=day;card.lastStaleAt=now;await store.saveCard(env,uid,id,card)
     }
     await env.PUSH_QUEUE.sendBatch(devices.map(d=>({body:{type:'deliver',uid,scope,projectId:project.id,deviceId:d.id,event,createdAt:now}})))
    }
    // Even an already claimed event must not create a once-per-minute rescan.
    consumed=true
   }
   next=Math.min(next,nextCheck(project,card,p,now,row.enabled_at,consumed,lastStaleDate))
  }
  await env.DB.prepare('UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?').bind(next,uid,scope,lease).run()
 }
 async function deliver(env,message){
  const row=await store.account(env,message.uid)
  if(!row?.enabled || Date.now()-message.createdAt>DAY){console.info('push.delivery.skipped',{reason:'disabled-or-expired'});return}
  const device=await env.DB.prepare('SELECT subscription FROM devices WHERE id=? AND uid=?').bind(message.deviceId,message.uid).first()
  if(!device){console.info('push.delivery.skipped',{reason:'device-not-registered'});return}
  await f.accountAvailable(env,message.uid)
  const p=preferences(JSON.parse(row.prefs))
  if(message.type==='test'){
   const text={ar:['الإشعارات مفعّلة','ستصلك التذكيرات التي اخترتها على هذا الهاتف.'],en:['Notifications are ready','Your selected reminders will arrive on this phone.'],he:['ההתראות פעילות','התזכורות שבחרתם יגיעו לטלפון הזה.']}[p.language] || ['Notifications are ready','Your selected reminders will arrive on this phone.']
   await send(env,JSON.parse(device.subscription),{uid:message.uid,title:text[0],body:text[1],language:p.language,url:'#/settings',tag:'wilo-push-test'});return
  }
  const project=await f.cardDocument(env,message.uid,message.projectId,message.scope)
  const key=cardKey(message.projectId,message.scope),card=await store.card(env,message.uid,key)
  if(quietNow(p,Date.now())){await env.PUSH_QUEUE.send(message,{delaySeconds:Math.max(1,Math.min(86400,Math.ceil((afterQuiet(p,Date.now())-Date.now())/1000)))});return}
  if(!p[message.event.type==='due'?'due':'stale'] || card.disabled || project.status==='done'||project.archivedAt||project.trashedAt)return
  if(message.event.type==='due' && candidate(project,card,p,Date.now(),row.enabled_at)?.key!==message.event.key)return
  if(message.event.type==='stale'){
   const last=Math.max(project.activityAt||0,project.updatedAt?.toMillis?.()||0,typeof project.updatedAt==='number'?project.updatedAt:0,card.lastViewedAt||0,row.enabled_at)
   if(Date.now()-last<p.staleDays*DAY)return
  }
  const deliveryId=await hash(`${message.deviceId}/${key}/${message.event.key}`)
  if(!await store.claimDelivery(env,deliveryId,message.uid))return
  const t=messages[p.language]
  try{await send(env,JSON.parse(device.subscription),{uid:message.uid,title:t[message.event.type],body:p.hideContent?t.private:project.name,url:message.scope?`#/groups/${message.scope}/${message.projectId}`:`#/personal/${message.projectId}`,tag:`wilo-${key}-${message.event.type}`})}
  catch(error){if([404,410].includes(error.status))await env.DB.prepare('DELETE FROM devices WHERE id=? AND uid=?').bind(message.deviceId,message.uid).run();throw error}
 }
 return {
  async fetch(request,env){
   const isAssistant=new URL(request.url).pathname==='/assistant',requestId=crypto.randomUUID();let stage='request'
   const origin=request.headers.get('origin'),allowed=(env.APP_ORIGINS || '').split(',').includes(origin)
   const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin'}
   if(!allowed)return new Response(JSON.stringify({error:'origin-not-allowed'}),{status:403,headers})
   if(isAssistant){headers['x-wilo-assistant-version']=ASSISTANT_PROTOCOL;headers['x-wilo-request-id']=requestId;headers['access-control-expose-headers']='x-wilo-assistant-version,x-wilo-request-id'}
   headers['access-control-allow-origin']=origin
   headers['access-control-allow-headers']='authorization,content-type,x-firebase-appcheck'
   headers['access-control-allow-methods']='POST,OPTIONS'
   if(new URL(request.url).pathname==='/moodle')return new Response(JSON.stringify({error:'integration-removed'}),{status:410,headers})
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
   if(request.method!=='POST')return new Response('{}',{status:405,headers})
   let requestedAction=isAssistant?'assistant':'unknown'
   try{
    const text=await request.text()
    if(text.length>65536)throw new Error('invalid-size')
    const data=JSON.parse(text)
    if(!isAssistant&&['get','save','subscribe','unsubscribe','test','sync','card','viewed','erase'].includes(data.action))requestedAction=data.action
    stage='identity';const identity=await f.verifyIdentity(request,env)
    let result
    if(isAssistant){stage='account';if(identity.emailVerified!==true)throw new Error('ai-email-unverified');await f.accountAvailable(env,identity.uid);stage='database';await store.ensureAccount(env,identity.uid,defaults);const readiness=await assistantHealth(env);stage='provider';result=data.mode==='health'?readiness:await assistant(env,identity.uid,data)}
    else result=await action(env,identity,data)
    console.info(isAssistant?'assistant.http':'push.http',{action:requestedAction,status:200,...(isAssistant?{requestId,protocol:ASSISTANT_PROTOCOL}:{})})
    return new Response(JSON.stringify({result}),{headers})
   }catch(error){if(isAssistant){const failure=assistantFailure(error,stage,requestId);console.warn('assistant.http.failed',{status:failure.status,...failure.body.diagnostic,code:failure.body.error});return new Response(JSON.stringify(failure.body),{status:failure.status,headers})}const status=error.message==='unauthenticated'?401:error.message==='account-unavailable'?403:400;console.warn('push.http.failed',{action:requestedAction,status,...diagnostic(error)});return new Response(JSON.stringify({error:status===401?'unauthenticated':/^ai-[a-z-]+$/.test(error.message)?error.message:'request-failed',...(error.message==='ai-incomplete-proposal'?{details:error.details}:{} )}),{status,headers})}
  },
  async scheduled(_controller,env){
   if(env.ASSISTANT_FREE_ONLY==='true')try{const cutoff=new Date(Date.now()-7*DAY).toISOString().slice(0,10);await env.DB.prepare('DELETE FROM ai_usage WHERE day<?').bind(cutoff).run();await env.DB.prepare('DELETE FROM ai_budget WHERE day<?').bind(cutoff).run()}catch{console.warn('assistant.maintenance.failed')}
   const now=Date.now(),due=await env.DB.prepare('SELECT s.uid,s.scope FROM scopes s JOIN accounts a ON a.uid=s.uid WHERE s.next_at<=? AND s.lease<=? AND a.enabled=1 ORDER BY s.next_at LIMIT 10').bind(now,now).all()
   for(const scope of due.results){
    const lock=await env.DB.prepare('UPDATE scopes SET lease=? WHERE uid=? AND scope=? AND lease<=? RETURNING uid').bind(now+120000,scope.uid,scope.scope,now).all()
    if(lock.results.length)await env.PUSH_QUEUE.send({type:'plan',uid:scope.uid,scope:scope.scope,lease:now+120000})
   }
   await env.DB.prepare('DELETE FROM deliveries WHERE created_at<?').bind(now-7*DAY).run()
  },
  async queue(batch,env){
   for(const message of batch.messages){
    // A previous deployment may have left integration jobs on this shared push queue.
    if(!['plan','deliver','test'].includes(message.body?.type)){message.ack();continue}
    try{console.info('push.queue.started',{type:['plan','deliver','test'].includes(message.body.type)?message.body.type:'unknown'});if(message.body.type==='plan')await plan(env,message.body);else await deliver(env,message.body);console.info('push.queue.completed');message.ack()}
    catch(error){
     if(error.message==='account-unavailable'){await store.erase(env,message.body.uid);message.ack()}
     else if(error.message==='card-unavailable'){message.ack()}
     else{console.warn('push.queue.failed',diagnostic(error));message.retry({delaySeconds:error.message==='quiet-retry'?3600:60})}
    }
   }
  }
 }
}
export default createWorker()
