import { test } from 'node:test'
import assert from 'node:assert/strict'
import {defaults,preferences,quietNow,zonedTime,candidate,validSubscription} from './policy.mjs'
const base={...defaults,enabled:true,quiet:false,timezone:'Asia/Jerusalem'}
const time=(d,t)=>zonedTime(d,t,base.timezone)
const project={status:'later',dueDate:'2026-10-20',activityAt:1}
test('deadline uses local date and time, not UTC',()=>{
  const now=time('2026-10-20','09:00')
  assert.equal(candidate(project,{},base,now,now-86400000).type,'due')
  assert.equal(candidate(project,{},base,now-60000,now-86400000),null)
})
test('disabled, completed, trashed and archived cards cannot notify',()=>{
  const now=time('2026-10-20','09:00')
  for(const extra of [{status:'done'},{trashedAt:1},{archivedAt:1}])assert.equal(candidate({...project,...extra},{},base,now,1),null)
  assert.equal(candidate(project,{disabled:true},base,now,1),null)
})
test('quiet hours cross midnight and release at end boundary',()=>{
  const p={...base,quiet:true}
  for(const t of ['22:00','23:59','00:00','07:59'])assert.equal(quietNow(p,time('2026-10-20',t)),true)
  assert.equal(quietNow(p,time('2026-10-20','08:00')),false)
})
test('weekly repeat preserves weekday and supports a reminder on the preceding day',()=>{
  const p={...base,leadMinutes:1440},now=time('2026-10-26','09:00')
  const event=candidate(project,{weekly:true},p,now,1)
  assert.equal(event.date,'2026-10-27')
  assert.equal(event.type,'due')
})
test('expired dates and reminders from before opt-in are skipped',()=>{
  const now=time('2026-10-22','10:00')
  assert.equal(candidate(project,{},base,now,1),null)
  assert.equal(candidate(project,{},base,time('2026-10-20','10:00'),time('2026-10-20','09:30')),null)
})
test('stale reminders are based on actual activity and last visit, with a per-card interval',()=>{
  const now=Date.parse('2026-10-20T12:00Z'),p={...base,due:false,stale:true},old=now-15*86400000
  assert.equal(candidate(project,{},p,now,old).type,'stale')
  assert.equal(candidate(project,{lastViewedAt:now-86400000},p,now,old),null)
  assert.equal(candidate(project,{lastStaleAt:now-86400000},p,now,old),null)
})
test('DST uses wall clock time and skips nonexistent clocks',()=>{
  assert.equal(new Date(zonedTime('2026-03-28','09:00','Asia/Jerusalem')).toISOString(),'2026-03-28T06:00:00.000Z')
  assert.equal(new Date(zonedTime('2026-03-26','09:00','Asia/Jerusalem')).toISOString(),'2026-03-26T07:00:00.000Z')
  assert.equal(zonedTime('2026-03-08','02:30','America/New_York'),null)
})
test('rejects malformed preferences and endpoint SSRF',()=>{
  assert.throws(()=>preferences({timezone:'bogus'}))
  assert.throws(()=>preferences({defaultTime:'25:00'}))
  assert.throws(()=>preferences({enabled:'yes'}))
  const s={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{auth:'a'.repeat(22),p256dh:'b'.repeat(87)}}
  assert.equal(validSubscription(s),true)
  for(const endpoint of ['http://fcm.googleapis.com/a','https://localhost/a','https://fcm.googleapis.com.evil.test/a','https://evil.test/a','https://fcm.googleapis.com:8443/a'])assert.equal(validSubscription({...s,endpoint}),false)
})
