import type { Change } from './actions';
import type { ControlResult } from './controlContract';
export type AssistantTask={title:string;outcome:'proposed'|'answer'|'needs-input'|'unsupported';actionIndexes:number[];controlIndexes:number[];detail:string};
export type TaskState='pending'|'saved'|'failed'|'answer'|'needs-input'|'unsupported'|'cancelled'|'unchanged'|'undone'|'partially-undone';
export function parseTasks(value:unknown,actions:number,controls:number):AssistantTask[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>50)throw new Error('assistant-invalid');
 const parsed=value.map(task=>{
  if(!task||typeof task!=='object'||Array.isArray(task)||Object.keys(task).some(k=>!['title','outcome','actionIndexes','controlIndexes','detail'].includes(k)))throw new Error('assistant-invalid');
  if(typeof task.title!=='string'||!task.title.trim()||task.title.length>300||typeof task.detail!=='string'||task.detail.length>1500||!['proposed','answer','needs-input','unsupported'].includes(task.outcome))throw new Error('assistant-invalid');
  for(const [key,size] of [['actionIndexes',actions],['controlIndexes',controls]] as const)if(!Array.isArray(task[key])||task[key].some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>=size)||new Set(task[key]).size!==task[key].length)throw new Error('assistant-invalid');
  const references=task.actionIndexes.length+task.controlIndexes.length;
  if(task.outcome==='proposed'?!references:references>0)throw new Error('assistant-invalid');
  return task as AssistantTask;
 });
 if(parsed.length){
  const actionRefs=new Set(parsed.flatMap(t=>t.actionIndexes)),controlRefs=new Set(parsed.flatMap(t=>t.controlIndexes));
  if(actionRefs.size!==actions||controlRefs.size!==controls)throw new Error('assistant-task-coverage');
 }
 return parsed;
}
/** A generated task outcome cannot certify persistence. Only actual receipts determine that. */
export function taskState(task:AssistantTask,changes:Change[],receipt:Change[]|undefined,controls:ControlResult[]|undefined,resolved:boolean,undone=false):TaskState{
 if(undone&&task.outcome==='proposed'&&task.actionIndexes.length)return task.controlIndexes.length?'partially-undone':'undone';
 if(task.outcome!=='proposed')return task.outcome;
 if(!resolved)return 'pending';
 if(!receipt&&!controls)return 'cancelled';
 const relevant=changes.filter(c=>c.actionIndexes?.some(i=>task.actionIndexes.includes(i)));
 if(relevant.some(c=>!receipt?.some(saved=>saved.id===c.id&&saved.target===c.target&&saved.scope===c.scope)))return 'failed';
 if(task.controlIndexes.some(i=>!controls?.[i]?.ok))return 'failed';
 return relevant.length||task.controlIndexes.length?'saved':'unchanged';
}
export const taskStateWords={
 ar:{'partially-undone':'تم التراجع عن البيانات؛ إجراءات الواجهة باقية',undone:'تم التراجع',pending:'بانتظار التطبيق',saved:'تم التنفيذ والتأكيد',failed:'لم تكتمل',answer:'إجابة', 'needs-input':'تحتاج معلومات',unsupported:'تتطلب خطوة أخرى',cancelled:'أُلغي المقترح',unchanged:'لا يحتاج تغييرًا'},
 en:{'partially-undone':'Data undone; site controls remain applied',undone:'Undone',pending:'Awaiting Apply',saved:'Executed and confirmed',failed:'Not completed',answer:'Answer','needs-input':'Needs information',unsupported:'Needs another step',cancelled:'Proposal discarded',unchanged:'No change needed'},
 he:{'partially-undone':'שינויי הנתונים בוטלו; פעולות הממשק נשארו',undone:'בוטל',pending:'ממתין לאישור',saved:'בוצע ואומת',failed:'לא הושלם',answer:'תשובה','needs-input':'נדרש מידע',unsupported:'נדרש צעד נוסף',cancelled:'ההצעה בוטלה',unchanged:'לא נדרש שינוי'},
};
