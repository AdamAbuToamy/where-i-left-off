import {test} from 'node:test'
import assert from 'node:assert/strict'
import {nextCheck,afterQuiet} from './schedule.mjs'
import {defaults,zonedTime} from './policy.mjs'
const p={...defaults,enabled:true,quiet:false,timezone:'Asia/Jerusalem'}
const at=(d,t)=>zonedTime(d,t,p.timezone)
test('next deadline is indexed by exact local time instead of scanning every minute',()=>{
 const now=at('2026-10-20','10:00'),due=at('2026-10-20','15:00')
 assert.equal(nextCheck({status:'active',dueDate:'2026-10-20'},{time:'15:00'},p,now,now),due)
})
test('quiet hours move scheduled work to the end of the quiet interval',()=>{
 assert.equal(afterQuiet({...p,quiet:true},at('2026-10-20','23:30')),at('2026-10-21','08:00'))
})
test('consumed reminders wait for next weekly recurrence instead of resending',()=>{
 const now=at('2026-10-20','15:01')
 const next=nextCheck({status:'active',dueDate:'2026-10-20'},{time:'15:00',weekly:true},p,now,now-86400000,true)
 assert.ok(next>=now+23*3600000)
})
test('an inactive-card reminder cannot create a minute-by-minute loop after daily cap',()=>{
 const now=at('2026-10-20','15:01'),prefs={...p,due:false,stale:true}
 const next=nextCheck({status:'active',activityAt:1},{},prefs,now,now-30*86400000,false,'2026-10-20')
 assert.equal(next,at('2026-10-21','09:00'))
})
