import type { Project } from '../types'
import type { Language } from '../translations'
import { checklistItems } from './taskOverview'
const labels={
 ar:{reopen:'إعادة فتح البطاقة',reply:'وصل الرد',wait:'انتظار رد جديد',list:'إنهاء القائمة',start:'ابدأ العمل',later:'متابعة لاحقًا',task:'ابدأ المهمة'},
 en:{reopen:'Reopen card',reply:'Reply received',wait:'Wait for another reply',list:'Complete checklist',start:'Start work',later:'Continue later',task:'Start task'},
 he:{reopen:'פתיחת הכרטיס מחדש',reply:'התקבלה תשובה',wait:'המתנה לתשובה נוספת',list:'סיום הרשימה',start:'התחלת העבודה',later:'להמשיך בהמשך',task:'התחלת המשימה'},
}
export function cardAction(project:Project,language:Language):{label:string;status:Project['status']}{
 const t=labels[language]
 if(project.status==='done')return{label:t.reopen,status:project.kind==='waiting'?'waiting':'later'}
 if(project.status==='waiting')return{label:t.reply,status:'active'}
 if(project.kind==='waiting')return{label:t.wait,status:'waiting'}
 if(project.resourceType==='shopping'||project.kind==='list'||checklistItems(project.checklist).length)return{label:t.list,status:'done'}
 if(project.status==='active')return{label:t.later,status:'later'}
 return{label:project.kind==='deadline'?t.task:t.start,status:'active'}
}
