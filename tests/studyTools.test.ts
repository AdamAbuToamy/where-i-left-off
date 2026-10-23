import { expect,it } from 'vitest';
import { emptyUniversity } from '../src/university/model';
import { courseTemplate,restoreStudyItem,studyToday } from '../src/university/studyTools';
it('copies study structure without carrying completion, live links or prerequisites into a new semester',()=>{
 const course={id:'old',name:'Algorithms',notes:'Keep structure',url:'https://example.edu',requires:['prior'],x:0,y:0,topics:[{id:'one',title:'Graphs',done:true}]};
 const copy=courseTemplate(course,1);expect(copy.id).not.toBe(course.id);expect(copy).toMatchObject({notes:'Keep structure',url:'',requires:[]});expect(copy.topics?.[0].done).toBe(false);expect(copy.topics?.[0].id).not.toBe('one');
});
it('undo restores only the removed item and leaves newer edits in place',()=>{
 const before={...emptyUniversity(),courses:[{id:'a',name:'A',notes:'',url:'',requires:[],x:0,y:0},{id:'b',name:'B',notes:'',url:'',requires:['a'],x:0,y:0}]};
 const next={...before,courses:[{...before.courses[1],notes:'New edit',requires:[]}]};
 const result=restoreStudyItem(next,{kind:'courses',id:'a',before});expect(result.courses.find(c=>c.id==='b')).toMatchObject({notes:'New edit',requires:['a']});
});
it('uses the local day for today and separates previous days from current deadlines',()=>{
 const now=new Date(2026,9,23,12),due=new Date(2026,9,23,9).toISOString(),past=new Date(2026,9,22,18).toISOString();
 const task={id:'today',courseId:'a',title:'Exam',kind:'exam' as const,due,done:false,notes:'',url:''};
 const state={...emptyUniversity(),tasks:[task,{...task,id:'late',due:past},{...task,id:'done',done:true}],lessons:[{id:'class',courseId:'a',day:now.getDay(),start:'10:00',end:'11:00',room:'204'}]};
 const today=studyToday(state,now);expect(today.tasks.map(t=>t.id)).toEqual(['today']);expect(today.overdue.map(t=>t.id)).toEqual(['late']);expect(today.lessons).toHaveLength(1);
});
