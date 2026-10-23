// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { emptyUniversity } from '../src/university/model';
import { acceptStudyCapture, captureMatches, parseStudyCapture } from '../src/university/studyCapture';
import type { StudyCapture } from '../src/university/studyCapture';
const sample:StudyCapture={version:1,kind:'assignment',courseName:'Algorithms',courseUrl:'https://campus.example.edu/learn/course/view.php?id=42',title:'Exercise 1',url:'https://campus.example.edu/learn/mod/assign/view.php?id=9'};
const hash=(value:unknown)=>'#/university?studyCapture='+encodeURIComponent(JSON.stringify(value));
function detect(url:string){return runInNewContext(readFileSync('browser-extension/moodle-page.js','utf8').replace('export function','function')+';readMoodlePage()', {document,location:new URL(url),URL});}
beforeEach(()=>{document.head.innerHTML='<meta name="generator" content="Moodle">';document.body.innerHTML='<nav class="breadcrumb"><a href="https://campus.example.edu/learn/course/view.php?id=42&sesskey=PRIVATE">Algorithms</a></nav><h1>Exercise 1</h1><input name="password" value="SECRET"><script>var sesskey="PRIVATE"</script>';document.body.id='page-mod-assign-view';});
it('detects visible assignment and course details from different Moodle roots without carrying private session values',()=>{
 const result=detect(sample.url+' &sesskey=PRIVATE'.replace(' ',''));expect(result).toEqual(sample);expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET|password/);
 expect(detect(sample.courseUrl)).toMatchObject({kind:'course',courseUrl:sample.courseUrl});
 expect(detect('https://campus.example.edu/learn/login/index.php')).toBeNull();
 expect(detect('https://campus.example.edu/learn/mod/assign/view.php?id=wrong')).toBeNull();
 document.head.innerHTML='';document.body.id='';expect(detect(sample.url)).toBeNull();
});
it('does not invent course ownership when a breadcrumb is missing',()=>{document.querySelector('nav')!.remove();expect(detect(sample.url)).toBeNull();});
it('accepts only canonical same-site course/activity links and discards unrelated fields',()=>{
 expect(parseStudyCapture(hash({...sample,password:'SECRET'}))).toEqual(sample);
 for(const change of [{url:'javascript:alert(1)'},{url:'https://other.edu/learn/mod/assign/view.php?id=9'},{url:sample.url+'&token=SECRET'},{courseUrl:sample.courseUrl+'&id=99'},{courseUrl:'https://user:pass@campus.example.edu/learn/course/view.php?id=42'},{kind:'course'},{url:sample.url.replace('/learn/','/another/')}])expect(parseStudyCapture(hash({...sample,...change}))).toBeNull();
});
it('creates records only on confirmation, keeps them local and opens duplicates without overwriting manual work or opting into reminders',()=>{
 const state=emptyUniversity();expect(parseStudyCapture(hash(sample))).toEqual(sample);expect(state.courses).toHaveLength(0);
 expect(()=>acceptStudyCapture(state,sample,{courseId:'',createCourse:false,courseName:'Algorithms',title:'Task',due:''})).toThrow('اختر');
 const added=acceptStudyCapture(state,sample,{courseId:'',createCourse:true,courseName:'Algorithms',title:'Task',due:'2026-11-10T14:30'});
 expect(added.state.courses).toHaveLength(1);expect(added.state.tasks).toHaveLength(1);expect(added.task?.reminderProjectId).toBeUndefined();
 added.task!.notes='My proof';added.task!.done=true;added.task!.due='2026-12-01T12:00:00Z';
 const again=acceptStudyCapture(added.state,sample,{courseId:'',createCourse:true,courseName:'Changed',title:'Overwrite',due:''});
 expect(again.state.tasks).toHaveLength(1);expect(again.task).toMatchObject({title:'Task',notes:'My proof',done:true,due:'2026-12-01T12:00:00Z'});
 expect(captureMatches(added.state,{...sample,courseUrl:sample.courseUrl.replace('campus.example.edu','other.edu'),url:sample.url.replace('campus.example.edu','other.edu')}).course).toBeUndefined();
});
it('binds an explicitly chosen local course with no link and preserves its notes and checklist',()=>{
 const state=emptyUniversity();state.courses.push({id:'manual',name:'My course',notes:'Keep',topics:[{id:'topic',title:'Proofs',done:true}],url:'',requires:[],x:0,y:0});
 const added=acceptStudyCapture(state,sample,{courseId:'manual',createCourse:false,courseName:'Ignored',title:'Task',due:''});
 expect(added.state.courses).toHaveLength(1);expect(added.course).toMatchObject({id:'manual',notes:'Keep',url:sample.courseUrl});expect(added.task?.courseId).toBe('manual');expect(captureMatches(added.state,sample).course?.id).toBe('manual');
});
it('extension routes detected study pages to review without asking the normal auto-save flow to create a card',async()=>{
 let click:(tab:unknown)=>Promise<void>=async()=>{};
 const create=vi.fn();const executeScript=vi.fn().mockResolvedValue([{result:sample}]);
 const chrome={action:{onClicked:{addListener:(fn:typeof click)=>{click=fn;}}},scripting:{executeScript},tabs:{create},runtime:{onMessageExternal:{addListener:vi.fn()}}};
 runInNewContext(readFileSync('browser-extension/service-worker.js','utf8').replace(/^import .*\n/,''),{chrome,URL,readMoodlePage:()=>null});
 await click({id:1,url:sample.url,title:sample.title});expect(create).toHaveBeenCalledOnce();
 const url=new URL(create.mock.calls[0][0].url);expect(url.searchParams.get('auto')).toBeNull();expect(parseStudyCapture(url.hash)).toEqual(sample);expect(executeScript).toHaveBeenCalledOnce();
});
it('keeps ordinary video capture and automatic saving intact when no study page is recognized',async()=>{
 let click:(tab:unknown)=>Promise<void>=async()=>{};const create=vi.fn();
 const executeScript=vi.fn().mockResolvedValueOnce([{result:null}]).mockResolvedValueOnce([{result:{seconds:90,duration:600}}]);
 const chrome={action:{onClicked:{addListener:(fn:typeof click)=>{click=fn;}}},scripting:{executeScript},tabs:{create},runtime:{onMessageExternal:{addListener:vi.fn()}}};
 runInNewContext(readFileSync('browser-extension/service-worker.js','utf8').replace(/^import .*\n/,''),{chrome,URL,readMoodlePage:()=>null});
 await click({id:1,url:'https://youtube.com/watch?v=abc',title:'Lecture'});
 const url=new URL(create.mock.calls[0][0].url);expect(url.searchParams.get('auto')).toBe('1');expect(url.searchParams.get('checkpoint')).toBe('00:01:30 / 00:10:00');expect(url.searchParams.get('url')).toContain('t=90s');
});
it('captures actual Moodle date rows in English, Arabic and Hebrew while keeping opening dates separate',()=>{
 for(const [text,day] of [['Friday, 23 October 2026, 14:30',23],['الجمعة، ٢٣ أكتوبر ٢٠٢٦، ١٤:٣٠',23],['יום שישי, 23 באוקטובר 2026, 14:30',23]] as const){
  document.body.innerHTML='<nav class="breadcrumb"><a href="'+sample.courseUrl+'">Algorithms</a></nav><h1>Exercise 1</h1><div class="activity-dates"><div><strong>Opened:</strong> Thursday, 22 October 2026, 09:00</div><div><strong>Due:</strong> '+text+'</div></div><div id="intro"><div class="no-overflow">Prove the theorem.</div></div>';
  const value=detect(sample.url);expect(value.dates).toHaveLength(2);expect(value.description).toBe('Prove the theorem.');expect(new Date(value.due).getDate()).toBe(day);expect(new Date(value.due).getHours()).toBe(14);
 }
});
it('prefers absolute machine timestamps and exposes ambiguous visible dates without inventing a deadline',()=>{
 document.body.innerHTML='<nav class="breadcrumb"><a href="'+sample.courseUrl+'">Algorithms</a></nav><h1>Exercise 1</h1><div class="activity-dates"><div><strong>Due date:</strong><time data-timestamp="1792762200">Any displayed format</time></div></div>';
 expect(detect(sample.url).due).toBe(new Date(1792762200000).toISOString());
 document.querySelector('.activity-dates')!.innerHTML='<div><strong>Due:</strong> 05/06/2026 14:00</div>';
 const ambiguous=detect(sample.url);expect(ambiguous.due).toBeUndefined();expect(ambiguous.dates[0].text).toContain('05/06/2026');
});
it('updates an existing deadline only with explicit approval while keeping manual notes and completion',()=>{
 const added=acceptStudyCapture(emptyUniversity(),sample,{courseId:'',createCourse:true,courseName:'Algorithms',title:'My title',due:''});
 added.task!.notes='My solution';added.task!.done=true;
 const fresh={...sample,due:'2026-11-10T12:00:00Z',description:'Updated instructions'};
 const ignored=acceptStudyCapture(added.state,fresh,{courseId:added.course.id,createCourse:false,courseName:'Algorithms',title:'Different',due:fresh.due});expect(ignored.task?.due).toBe('');
 const updated=acceptStudyCapture(added.state,fresh,{courseId:added.course.id,createCourse:false,courseName:'Algorithms',title:'My title',due:fresh.due,updateExisting:true});
 expect(updated.state.tasks).toHaveLength(1);expect(updated.task).toMatchObject({notes:'My solution',done:true,title:'My title',due:'2026-11-10T12:00:00.000Z',sourceDescription:'Updated instructions'});
});
