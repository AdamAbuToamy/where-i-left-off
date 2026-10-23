import type { Lesson } from './model';
export const TIMETABLE_HOUR_HEIGHT=84;
export const clockMinutes=(clock:string)=>{const [hour,minute]=clock.split(':').map(Number);return hour*60+minute;};
export const hourLabel=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
export function timetableBounds(lessons:Lesson[]){
 const start=Math.floor(Math.min(8*60,...lessons.map(l=>clockMinutes(l.start)))/60)*60;
 const end=Math.ceil(Math.max(20*60,...lessons.map(l=>clockMinutes(l.end)))/60)*60;
 return {start,end,height:(end-start)*TIMETABLE_HOUR_HEIGHT/60,hours:Array.from({length:(end-start)/60+1},(_,i)=>start+i*60)};
}
export type PositionedLesson={lesson:Lesson;top:number;height:number;lane:number;lanes:number};
/** Interval layout keeps exact minute positions and places overlapping classes side by side. */
export function layoutTimetableDay(lessons:Lesson[],start:number):PositionedLesson[]{
 const sorted=[...lessons].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.id.localeCompare(b.id));
 const result:PositionedLesson[]=[];let group:Lesson[]=[],end=-1;
 function flush(){
  const laneEnds:number[]=[],items:{lesson:Lesson;lane:number}[]=[];
  for(const lesson of group){const begin=clockMinutes(lesson.start);let lane=laneEnds.findIndex(last=>last<=begin);if(lane<0)lane=laneEnds.length;laneEnds[lane]=clockMinutes(lesson.end);items.push({lesson,lane});}
  for(const {lesson,lane} of items)result.push({lesson,lane,lanes:laneEnds.length,top:(clockMinutes(lesson.start)-start)*TIMETABLE_HOUR_HEIGHT/60,height:(clockMinutes(lesson.end)-clockMinutes(lesson.start))*TIMETABLE_HOUR_HEIGHT/60});
  group=[];
 }
 for(const lesson of sorted){const begin=clockMinutes(lesson.start);if(group.length&&begin>=end)flush();group.push(lesson);end=Math.max(group.length===1?-1:end,clockMinutes(lesson.end));}
 flush();return result;
}
