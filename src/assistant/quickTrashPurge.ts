import type { Language } from '../translations';
import type { AssistantData, AssistantReply } from './actions';

/** No AI inference for this precise, destructive intent. Only currently trashed
 * personal cards can be proposed; the user must review every name and confirm.
 * Group cards use their existing permission-aware library UI instead.
 */
export function quickTrashPurge(message: string, data: AssistantData, language: Language): AssistantReply | null {
 const normalized=message.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f]/g,'').trim();
 const trash=/(?:سلة\s*(?:المهملات|المحذوفات)|trash|recycle\s*bin|אשפה|סל\s*המחזור)/i.test(normalized);
 const all=/(?:\b(?:all|every)\b|جميع|كل|كافة|הכל|כולם|כל\s*הכרטיסים)/i.test(normalized);
 const permanent=/(?:نهائي|نهائيا|دائم|permanent|forever|לצמיתות|לחלוטין)/i.test(normalized);
 const deletion=/(?:احذف|إحذف|حذف|امسح|مسح|افرغ|أفرغ|delete|remove|empty|מחק|למחוק|רוקן)/i.test(normalized);
 if(!trash||!all||!permanent||!deletion||/^(?:لا|don't|do not|אל)\s/i.test(normalized))return null;
 const cards=data.scopes.find(s=>s.id==='personal')?.projects.filter(p=>!!p.trashedAt)||[];
 const words={
  ar:{none:'سلة المهملات الشخصية فارغة، ولا يوجد شيء لحذفه.',tooMany:'يوجد أكثر من 50 بطاقة في السلة الشخصية. افتح السلة واحذفها على دفعات؛ لم يُحذف أي شيء.',review:(n:number)=>`وجدت ${n} بطاقة في سلة المهملات الشخصية. راجع أسماءها بعناية. الحذف نهائي ولا يمكن التراجع عنه؛ لن يُنفذ قبل تأكيدك. بطاقات المجموعات غير مشمولة.`,task:'حذف بطاقات السلة الشخصية نهائيًا'},
  en:{none:'Your personal Trash is empty. Nothing was deleted.',tooMany:'More than 50 personal cards are in Trash. Delete them in batches in the library; nothing was deleted.',review:(n:number)=>`Found ${n} personal trashed card(s). Review every name. Deletion is permanent and cannot be undone; nothing happens until you confirm. Group cards are excluded.`,task:'Permanently delete personal Trash cards'},
  he:{none:'סל האשפה האישי ריק. לא נמחק דבר.',tooMany:'יש יותר מ-50 כרטיסים בסל האישי. יש למחוק בקבוצות דרך הספרייה; לא נמחק דבר.',review:(n:number)=>`נמצאו ${n} כרטיסים באשפה האישית. בדקו את כל השמות. המחיקה סופית וללא אפשרות ביטול; לא תבוצע לפני אישור. כרטיסי קבוצות אינם כלולים.`,task:'מחיקה לצמיתות של כרטיסי האשפה האישית'},
 }[language];
 if(!cards.length)return {text:words.none,actions:[],controls:[],files:[],tasks:[{title:words.task,outcome:'answer',actionIndexes:[],controlIndexes:[],detail:''}]};
 if(cards.length>50)return {text:words.tooMany,actions:[],controls:[{kind:'navigate',values:{page:'library',view:'trash'}}],files:[],tasks:[{title:words.task,outcome:'unsupported',actionIndexes:[],controlIndexes:[0],detail:words.tooMany}]};
 return {text:words.review(cards.length),actions:cards.map(p=>({target:'projects',action:'delete',scope:'personal',id:p.id,values:{}})),controls:[{kind:'navigate',values:{page:'library',view:'trash'}}],files:[],tasks:[{title:words.task,outcome:'proposed',actionIndexes:cards.map((_,i)=>i),controlIndexes:[0],detail:''}]};
}
