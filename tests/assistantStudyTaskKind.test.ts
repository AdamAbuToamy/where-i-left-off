import {expect,it} from 'vitest';
import {normalizeExplicitStudyTaskKind} from '../push-worker/src/assistantStudyTaskKind.mjs';
const plan=(kind='task',count=1)=>({actions:Array.from({length:count},(_,i)=>({target:'tasks',action:'create',id:'new-task-'+i,values:{title:'Homework 2',kind}}))});
it('normalizes Hebrew assignment only on a unique new generic study task',()=>{
 const p=plan();normalizeExplicitStudyTaskKind(p,'הוסף מטלה Homework 2 לאלגוריתמים ללא מועד');expect(p.actions[0].values.kind).toBe('assignment');
});
it('normalizes Arabic and English assignment and exam wording',()=>{
 for(const [message,kind] of [['أضف واجب رياضيات','assignment'],['Add an assignment to Algorithms','assignment'],['צור מבחן בסטטיסטיקה','exam'],['Create an exam','exam']]){
  const p=plan();normalizeExplicitStudyTaskKind(p,message);expect(p.actions[0].values.kind).toBe(kind);
 }
});
it('does not rewrite ambiguous, multi-create, update, or already-specific kinds',()=>{
 for(const message of ['Create a task Homework 2','Create assignment and exam']){const p=plan();normalizeExplicitStudyTaskKind(p,message);expect(p.actions[0].values.kind).toBe('task');}
 const multi=plan('task',2);normalizeExplicitStudyTaskKind(multi,'Create two assignments');expect(multi.actions.every(a=>a.values.kind==='task')).toBe(true);
 const specific=plan('exam');normalizeExplicitStudyTaskKind(specific,'Add an assignment');expect(specific.actions[0].values.kind).toBe('exam');
 const updating=plan();updating.actions[0].action='update';normalizeExplicitStudyTaskKind(updating,'Update assignment');expect(updating.actions[0].values.kind).toBe('task');
});
