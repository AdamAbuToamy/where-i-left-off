import type { Language } from '../translations';
import type { Change } from './actions';
const words={
 ar:{review:'التغييرات جاهزة للمراجعة ولم تُحفظ بعد. اضغط تطبيق التغييرات لحفظها.',empty:'لم يُنفّذ أي تغيير في الموقع. لم يرجع المساعد تعديلات قابلة للتطبيق؛ حدّد العناصر المطلوبة وأعد المحاولة.',saved:'عدد التغييرات المؤكدة',lessons:'الحصص التي أُضيفت وحُفظت'},
 en:{review:'Changes are ready for review and have not been saved. Click Apply changes to save them.',empty:'No site changes were made. The assistant returned no applicable edits; specify the items and try again.',saved:'Confirmed changes',lessons:'Classes added and saved'},
 he:{review:'השינויים מוכנים לבדיקה וטרם נשמרו. לחצו על החלת שינויים לשמירה.',empty:'לא בוצע שינוי באתר. העוזר לא החזיר שינויים להחלה; ציינו את הפריטים ונסו שוב.',saved:'שינויים שאומתו',lessons:'מפגשים שנוספו ונשמרו'},
};
/** Generated prose is not a save receipt. Mutation status belongs to the application. */
export function proposalStatus(text:string,changes:Change[],language:Language):string {
 if(changes.length)return words[language].review;
 const claims=/(?:تم(?:ت)?\s+(?:اضاف|إضاف|تعديل|حفظ|تطبيق|تحديث|حذف|تنفيذ)|(?:أضفت|اضفت|عدلت|حفظت|نفذت)|\b(?:added|saved|updated|deleted|applied|completed)\b|(?:נוספו|נוסף|נשמר|עודכנ|בוצע|הוספתי|עדכנתי))/i;
 return claims.test(text)?words[language].empty:text;
}
export function confirmedChangeCount(changes:Change[],language:Language):string {
 const added=changes.filter(c=>c.target==='lessons'&&!c.before&&c.after).length;
 return `${words[language].saved}: ${changes.length}.`+(added?` ${words[language].lessons}: ${added}.`:'');
}
