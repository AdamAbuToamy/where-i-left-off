import {expect,it} from 'vitest';
import {assistantPlan} from '../src/assistant/plan';
import {emptyUniversity} from '../src/university/model';
it('accepts only bounded drafts linked to existing courses and never enables a reminder',()=>{
 const state={...emptyUniversity(),courses:[{id:'course',name:'Algorithms',url:'',notes:'',requires:[],x:0,y:0}]};
 const task={courseId:'course',title:'Review graphs',kind:'task',due:'2026-11-10T14:30:00+02:00',reminderProjectId:'foreign'};
 const result=assistantPlan(JSON.stringify({text:'Draft',tasks:[task]}),state)!;
 expect(result.preview.tasks[0].due).toBe('2026-11-10T12:30:00.000Z');expect(result.preview.tasks[0].reminderProjectId).toBeUndefined();expect(state.tasks).toHaveLength(0);
 for(const change of [{courseId:'missing'},{due:'tomorrow'},{kind:'delete'},{due:'2026-11-10T14:30:00'}])expect(assistantPlan(JSON.stringify({text:'Draft',tasks:[{...task,...change}]}),state)).toBeNull();
});
