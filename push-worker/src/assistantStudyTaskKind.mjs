/**
 * Normalize only an unambiguous, explicitly requested kind on one newly created
 * study task. Never infer from an existing title (e.g. "Homework 2"), user
 * history, or another record. Updates and multi-create requests are untouched.
 */
export function normalizeExplicitStudyTaskKind(plan,message){
 if(!plan||!Array.isArray(plan.actions)||typeof message!=='string')return plan;
 const created=plan.actions.filter(action=>action?.target==='tasks'&&action.action==='create');
 if(created.length!==1)return plan;
 // Explicit generic "task" requests can contain a title such as
 // "Homework 2"; a title is not evidence of an assignment kind.
 if(/\b(?:create|add|make)\s+(?:a\s+)?task\b/iu.test(message))return plan;
 const assignment=/(?:\bassignment\b|\bhomework\b|מטלה|שיעורי בית|واجب|وظيفة)/iu.test(message);
 const exam=/(?:\bexam\b|\btest\b|בחינה|מבחן|امتحان|اختبار)/iu.test(message);
 if(assignment===exam)return plan;
 const desired=assignment?'assignment':'exam';
 const action=created[0];
 // Correct only a generic provider default; do not override a conflicting,
 // explicitly specific kind without another semantic validation step.
 if(action.values?.kind==='task')action.values.kind=desired;
 return plan;
}
