/**
 * A narrowly scoped correction for explicit course assignment/exam creation.
 * Only a single unambiguously named new task is eligible. Never rewrite updates.
 */
export function normalizeExplicitStudyKind(plan,message){
 if(!plan||!Array.isArray(plan.actions)||typeof message!=='string')return plan;
 const assignment=/(?:\bassignment\b|\bhomework\b|מטלה|שיעורי בית|وظيفة|واجب)/iu.test(message);
 const exam=/(?:\bexam\b|\btest\b|בחינה|מבחן|امتحان|اختبار)/iu.test(message);
 if(assignment===exam)return plan;
 const creates=plan.actions.filter(a=>a?.target==='tasks'&&a.action==='create');
 if(creates.length!==1)return plan;
 const task=creates[0];
 if(typeof task.values?.title!=='string'||!task.values.title.trim())return plan;
 if(!['task',undefined].includes(task.values.kind))return plan;
 task.values.kind=assignment?'assignment':'exam';
 return plan;
}
