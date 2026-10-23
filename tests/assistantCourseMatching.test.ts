import {expect,it} from 'vitest';
import {courseMatchRequest,resolvedTimetableReply} from '../src/assistant/courseMatching';
import {quickAssistantReply} from '../src/assistant/quickActions';
import {planAssistantChanges} from '../src/assistant/actions';
import {timetableData,weeklyRequest,expectedSessions} from './fixtures/weeklyTimetable';
const fixture=()=>{const data=timetableData();data.study.courses=data.study.courses.map((c,i)=>({...c,name:`2026-2027 / 202-1-${1000+i} ${c.name} — סמסטר א`}));return data;};
const response=(request:NonNullable<ReturnType<typeof courseMatchRequest>>)=>JSON.stringify({matches:request.requested.map((requested,i)=>({requested,courseId:request.courses[i].id,candidates:[]}))});
it('uses AI course identity matches for decorated names while retaining all fourteen exact times and types',()=>{
 const data=fixture();expect(quickAssistantReply(weeklyRequest,data,'ar')).toBeNull();
 const request=courseMatchRequest(weeklyRequest,data,'ar')!;expect(request.requested).toHaveLength(6);expect(request.courses).toHaveLength(6);
 const reply=resolvedTimetableReply(weeklyRequest,data,'ar',request,response(request));expect(reply.actions.map(a=>a.values)).toEqual(expectedSessions);expect(planAssistantChanges(data,reply.actions)).toHaveLength(14);expect(data.study.lessons).toEqual([]);
});
it('never lets course-resolution output create courses, change times or write arbitrary IDs',()=>{
 const data=fixture(),request=courseMatchRequest(weeklyRequest,data,'ar')!,value=JSON.parse(response(request));value.matches[0].courseId='foreign';
 expect(()=>resolvedTimetableReply(weeklyRequest,data,'ar',request,JSON.stringify(value))).toThrow('assistant-invalid');
 value.matches.pop();expect(()=>resolvedTimetableReply(weeklyRequest,data,'ar',request,JSON.stringify(value))).toThrow('assistant-format');
});
it('asks with actual candidates when the model cannot choose and never imports a partial batch',()=>{
 const data=fixture(),request=courseMatchRequest(weeklyRequest,data,'ar')!,value=JSON.parse(response(request));value.matches[0]={requested:request.requested[0],courseId:'',candidates:[request.courses[0].id,request.courses[1].id]};
 const reply=resolvedTimetableReply(weeklyRequest,data,'ar',request,JSON.stringify(value));expect(reply.actions).toEqual([]);expect(reply.text).toContain(data.study.courses[0].name);expect(reply.text).not.toContain('غير فريد');
});
it('prevents duplicates after semantic matching on a subsequent request',()=>{
 const data=fixture();data.study.lessons=expectedSessions.map((s,i)=>({...s,id:`saved-${i}`})) as never;
 const request=courseMatchRequest(weeklyRequest,data,'ar')!;expect(resolvedTimetableReply(weeklyRequest,data,'ar',request,response(request)).actions).toEqual([]);
});
it('does not send unrelated account notes or source content to the course matcher',()=>{
 const data=fixture();data.study.courses[0].notes='private notes not needed to identify this course';
 expect(JSON.stringify(courseMatchRequest(weeklyRequest,data,'ar'))).not.toContain('private notes');
});
