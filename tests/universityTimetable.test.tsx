// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Timetable from '../src/university/Timetable';
import {layoutTimetableDay,timetableBounds,TIMETABLE_HOUR_HEIGHT} from '../src/university/timetableLayout';
import {timetableData,expectedSessions} from './fixtures/weeklyTimetable';
import type {Lesson} from '../src/university/model';
const lessons=expectedSessions.map((s,i)=>({...s,id:`lesson-${i}`})) as Lesson[];
it('keeps exact minute offsets and durations for the real 13:20 and 09:20 classes',()=>{
 const bounds=timetableBounds(lessons);expect(bounds.start).toBe(480);expect(bounds.end).toBe(1200);
 for(const day of [0,3]){const positioned=layoutTimetableDay(lessons.filter(l=>l.day===day),bounds.start);const item=positioned.find(p=>p.lesson.start.endsWith(':20'))!;
  const start=item.lesson.start==='13:20'?800:560;
  expect(item.top).toBeCloseTo((start-480)*TIMETABLE_HOUR_HEIGHT/60);expect(item.height).toBeCloseTo(160*TIMETABLE_HOUR_HEIGHT/60);
 }
});
it('places overlapping chains side by side and gives adjacent non-overlapping classes full width',()=>{
 const fixture=(id:string,start:string,end:string):Lesson=>({id,courseId:'c',day:0,start,end,room:''});
 const input=[fixture('a','09:00','10:00'),fixture('b','09:30','11:00'),fixture('c','10:30','12:00'),fixture('d','12:00','13:00')];
 const positioned=layoutTimetableDay(input,480);expect(positioned.map(p=>[p.lane,p.lanes])).toEqual([[0,2],[1,2],[0,2],[0,1]]);expect(input.map(l=>l.id)).toEqual(['a','b','c','d']);
});
it('extends the visible hours for early and late classes, including the end of the day',()=>{
 const bounds=timetableBounds([{...lessons[0],start:'06:20',end:'23:59'}]);expect(bounds.start).toBe(360);expect(bounds.end).toBe(1440);expect(bounds.hours.at(-1)).toBe(1440);
});
it.each(['ar','en','he'] as const)('renders the hourly timetable and edit callback in %s without changing data',async language=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const node=document.createElement('div');document.body.append(node);const root=createRoot(node),onEdit=vi.fn(),courses=timetableData().study.courses;
 try{
  await act(async()=>root.render(<Timetable lessons={lessons} courses={courses} courseFilter="" conflicts={new Set()} language={language} courseColor={()=>'#385c4b'} onEdit={onEdit}/>));
  expect(node.querySelectorAll('.study-week > section')).toHaveLength(7);expect(node.querySelectorAll('.study-lesson')).toHaveLength(14);expect(node.querySelector('.study-hour-label')?.textContent).toBe('08:00');expect(node.querySelectorAll('.study-hour-label')).toHaveLength(13);
  const button=[...node.querySelectorAll<HTMLButtonElement>('.study-lesson')].find(b=>b.textContent?.includes('13:20'))!;expect(button.style.top).toBe('450px');expect(button.style.height).toBe('220px');await act(async()=>button.click());expect(onEdit).toHaveBeenCalledWith(lessons[1]);
  expect(node.querySelector('[role=region]')?.getAttribute('dir')).toBe(language==='en'?'ltr':'rtl');
  if(language!=='ar')expect(node.textContent).not.toMatch(/[\u0600-\u06ff]/);
  await act(async()=>root.render(<Timetable lessons={lessons} courses={courses} courseFilter="course-0" conflicts={new Set()} language={language} courseColor={()=>'#385c4b'} onEdit={onEdit}/>));expect(node.querySelectorAll('.study-lesson')).toHaveLength(3);
 }finally{await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals();}
});
