import type {Language} from '../translations';
import {assistantFieldNames} from './words';
/** Only bounded field identifiers and reason codes enter the UI, never provider payloads. */
export function coverageHint(error:unknown,language:Language):string{
 const details=(error as {details?:unknown})?.details;
 if(!Array.isArray(details))return '';
 const words={ar:{request:'الطلب',missing:'لم يطابق التعديل المطلوب',ambiguous:'لم يتحدد العنصر المقصود',extra:'اقترح عملية إضافية غير مرتبطة بطلب',file:'لم يُنتج الملف المطلوب'},en:{request:'Request',missing:'Required edit did not match',ambiguous:'Target is ambiguous',extra:'An extra operation was not linked to a request',file:'Requested file was missing'},he:{request:'בקשה',missing:'השינוי המבוקש לא תאם',ambiguous:'הפריט אינו חד-משמעי',extra:'פעולה נוספת לא קושרה לבקשה',file:'הקובץ המבוקש חסר'}}[language];
 return details.slice(0,4).flatMap(item=>{
  if(!item||!Number.isInteger(item.task)||item.task<0||item.task>=50)return [];
  const reason=item.reason==='ambiguous-subject'?words.ambiguous:item.reason==='missing-file'?words.file:item.reason==='unassigned-action'||item.reason==='unassigned-control'?words.extra:item.reason==='missing-effect'?words.missing:'';
  if(!reason)return [];
  const field=typeof item.field==='string'&&Object.hasOwn(assistantFieldNames,item.field)?assistantFieldNames[item.field][language==='ar'?0:language==='en'?1:2]:'';
  return [`${words.request} ${item.task+1}: ${reason}${field?' ('+field+')':''}.`];
 }).join(' ');
}
