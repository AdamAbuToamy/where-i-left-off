import {expect,it} from 'vitest';
import {quickAssistantReply} from '../src/assistant/quickActions';
import {planAssistantChanges} from '../src/assistant/actions';
import {proposalStatus} from '../src/assistant/replyStatus';
import {weeklyRequest,timetableData,expectedSessions} from './fixtures/weeklyTimetable';
it('turns the exact 14-class Arabic/Hebrew request into validated actions for existing courses',()=>{
 const data=timetableData(),reply=quickAssistantReply(weeklyRequest,data,'ar')!;
 expect(reply.actions).toHaveLength(14);expect(reply.actions.map(a=>a.values)).toEqual(expectedSessions);
 const changes=planAssistantChanges(data,reply.actions);expect(changes).toHaveLength(14);
 expect(changes.every(c=>c.target==='lessons')).toBe(true);expect(data.study.lessons).toEqual([]);
 expect(reply.text).not.toContain('بنجاح');expect(reply.text).toContain('لم يُحفظ');
});
it('skips existing and repeated classes, preserves their rooms and does not alter courses',()=>{
 const data=timetableData();data.study.lessons=[{...expectedSessions[0],id:'saved',room:'105'} as never];
 const reply=quickAssistantReply(weeklyRequest,data,'en')!;expect(reply.actions).toHaveLength(13);expect(data.study.lessons[0].room).toBe('105');
 data.study.lessons=expectedSessions.map((s,i)=>({...s,id:`saved-${i}`})) as never;
 expect(quickAssistantReply(weeklyRequest,data,'ar')?.actions).toEqual([]);
});
it.each(['bad-clock','bad-type','missing-day','conflicting-type'])('blocks the entire batch on %s rather than silently importing part',kind=>{
 const data=timetableData();let request=weeklyRequest;
 if(kind==='bad-clock')request=request.replace('11:00–13:00','25:00–13:00');
 if(kind==='bad-type')request=request.replace('הרצאה (Lecture)','seminar');
 if(kind==='missing-day')request=request.replace('**الأحد — יום ראשון**','');
 if(kind==='conflicting-type')data.study.lessons=[{...expectedSessions[0],id:'existing',sessionType:'tutorial'} as never];
 const reply=quickAssistantReply(request,data,'ar')!;expect(reply.actions).toEqual([]);expect(reply.text).toContain('لم يُنشأ مقترح جزئي');
});
it.each(['تم إضافة 14 حصة إلى البرنامج الأسبوعي بنجاح.','تمت إضافة الحصص','I added 14 classes successfully.','נוספו 14 מפגשים בהצלחה'])('does not display an unverified completion claim: %s',text=>{
 expect(proposalStatus(text,[],'en')).toContain('No site changes');
 expect(proposalStatus(text,planAssistantChanges(timetableData(),quickAssistantReply(weeklyRequest,timetableData(),'en')!.actions),'en')).toContain('have not been saved');
});

it('delegates missing exact names and ambiguous names to semantic AI matching instead of rejecting the user',()=>{
 for(const kind of ['missing','ambiguous']){const data=timetableData();if(kind==='missing')data.study.courses.pop();else data.study.courses.push({...data.study.courses[0],id:'another'});expect(quickAssistantReply(weeklyRequest,data,'ar')).toBeNull();}
});
