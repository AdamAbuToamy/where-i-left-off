import { mergeSessionCache } from '../src/lib/sessionCache'
import { normalizedProject } from '../src/lib/offlineStore'
import { sameProjectBaseline } from '../src/lib/projectBaseline'
import { expect,it } from 'vitest'
import { completionDates,currentCard,needsReview,shouldArchive,recommendation,DAY_MS,canonicalCaptureUrl } from '../src/lib/workflow'
import { elapsedSeconds,pauseClock,MAX_SESSION_SECONDS } from '../src/lib/sessionClock'
import { progressStats } from '../src/lib/analytics'
import type { Project } from '../src/types'
import type { SessionEntry } from '../src/lib/sessionJournal'
import { parseTabCapture } from '../src/lib/tabCapture'
const now=new Date(2026,9,14,12).getTime(),card:Project={id:'one',name:'One',nextStep:'Next',rank:0,revision:0,status:'later',activityAt:now-40*DAY_MS}
it('archives only completed personal candidates when explicitly enabled and leaves trash out of current work',()=>{
 const done={...card,status:'done' as const,completedAt:now-8*DAY_MS}
 expect(shouldArchive(done,false,now)).toBe(false);expect(shouldArchive(done,true,now)).toBe(true)
 expect(shouldArchive({...done,completedAt:now},true,now)).toBe(false)
 expect(shouldArchive({...done,trashedAt:now},true,now)).toBe(false)
 expect(currentCard({...card,archivedAt:now})).toBe(false)
})
it('reviews meaningful old work but excludes completed, archived and idea cards',()=>{
 expect(needsReview(card,30,now)).toBe(true)
 for(const patch of [{status:'done' as const},{archivedAt:now},{trashedAt:now},{resourceType:'idea' as const}])expect(needsReview({...card,...patch},30,now)).toBe(false)
 expect(needsReview({...card,activityAt:now},30,now)).toBe(false)
})
it('touches progress, preserves age for archiving and records completion transitions',()=>{
 expect(completionDates(card,{...card,archivedAt:now},now).activityAt).toBe(card.activityAt)
 expect(completionDates(card,{...card,nextStep:'New step'},now).activityAt).toBe(now)
 expect(completionDates(card,{...card,status:'done'},now).completedAt).toBe(now)
 expect(completionDates({...card,status:'done',completedAt:now},{...card,status:'active'},now).completedAt).toBe(0)
})
it('suggests reply follow-ups and stale courses without inventing completion or recommending archived cards',()=>{
 expect(recommendation({scope:'Personal',project:{...card,status:'waiting',followUpDate:'2026-10-13'}},now)).toBe('waiting')
 expect(recommendation({scope:'Personal',project:{...card,resourceType:'course'}},now)).toBe('stale')
 expect(recommendation({scope:'Personal',project:{...card,archivedAt:now}},now)).toBeNull()
})
it('excludes paused time and caps forgotten sessions at 90 minutes',()=>{
 const started={startedAt:1000,runningSince:1000,accumulated:0},paused=pauseClock(started,31000)
 expect(elapsedSeconds(paused,900000)).toBe(30)
 expect(elapsedSeconds({...paused,runningSince:900000},910000)).toBe(40)
 expect(elapsedSeconds(started,10000000)).toBe(MAX_SESSION_SECONDS)
})
it('counts actual recorded sessions and dated completions while excluding trashed cards',()=>{
 const s={id:'s',projectId:'one',projectName:'One',groupId:'',resourceType:'course',startedAt:now-1000,endedAt:now,seconds:600,checkpoint:'Stopped',nextStep:'Next'} as SessionEntry
 const stats=progressStats([s],[{scope:'Personal',project:{...card,status:'done',resourceType:'book',completedAt:now}},{scope:'Personal',project:{...card,id:'trash',status:'done',trashedAt:now,completedAt:now}}],now)
 expect(stats.monthSeconds).toBe(600);expect(stats.learningSeconds).toBe(600);expect(stats.completed).toBe(1);expect(stats.books).toBe(1)
})
it('matches a captured video despite timestamp parameters and accepts only bounded capture checkpoints',()=>{
 expect(canonicalCaptureUrl('https://youtube.com/watch?v=abc&t=45s')).toBe(canonicalCaptureUrl('https://youtube.com/watch?v=abc'))
 const capture=parseTabCapture('?capture=tab&url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dabc&checkpoint=00%3A01%3A30%20%2F%2000%3A10%3A00&resource=course')
 expect(capture?.checkpoint).toBe('00:01:30 / 00:10:00');expect(capture?.resourceType).toBe('course')
 expect(parseTabCapture('?capture=tab&url=https%3A%2F%2Fexample.test&checkpoint=<script>')?.checkpoint).toBeUndefined()
})

it('does not turn inferred legacy timestamps into false offline conflicts',()=>{
 const old={id:'old',name:'Old',nextStep:'Resume',status:'done' as const,rank:0,revision:2}
 const raw={...old,updatedAt:{toMillis:()=>12345}}
 const remote=normalizedProject(old.id,raw)
 expect(sameProjectBaseline(old,remote,raw)).toBe(true)
 expect(sameProjectBaseline(old,{...remote,nextStep:'Changed on another device'},raw)).toBe(false)
 expect(sameProjectBaseline(old,{...remote,archivedAt:12345},raw)).toBe(false)
})

it('retains verified history on an empty offline snapshot and preserves unsynced records across server snapshots',()=>{
 const confirmed={id:'confirmed',startedAt:100,pending:false} as SessionEntry,pending={id:'pending',startedAt:200,pending:true} as SessionEntry
 expect(mergeSessionCache([],[confirmed,pending],true).map(s=>s.id)).toEqual(['pending','confirmed'])
 expect(mergeSessionCache([],[confirmed,pending],false).map(s=>s.id)).toEqual(['pending'])
 expect(mergeSessionCache([{...pending,pending:false}],[pending],false)).toHaveLength(1)
})
