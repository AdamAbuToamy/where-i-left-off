import type { Language } from '../translations';
const hints:Record<string,[string,string,string]>={
 'assistant-reference':['المقترح يشير إلى عنصر غير موجود أو لم يحدد الكورس الصحيح.','The proposal references an unknown item or course.','ההצעה מפנה לפריט או לקורס שאינו קיים.'],
 'assistant-fields':['المقترح يحتوي حقولًا غير مدعومة.','The proposal contains unsupported fields.','ההצעה מכילה שדות שאינם נתמכים.'],
 'assistant-clock':['وقت الحصة يجب أن يكون مثل 17:00–18:00 واليوم بين الأحد والسبت.','Use a valid day and class times such as 17:00–18:00.','יש לציין יום ושעות תקינים, למשל 17:00–18:00.'],
 'الوقت بصيغة HH:MM':['صيغة وقت الحصة غير صحيحة؛ مثال صحيح 17:00.','Invalid class time format; use 17:00.','פורמט השעה שגוי; לדוגמה 17:00.'],
 'محاضرة غير صالحة':['يوم الحصة أو ترتيب وقت البداية والنهاية غير صالح.','Invalid class day or start/end time order.','יום המפגש או סדר שעות ההתחלה והסיום אינו תקין.'],
 'مهمة أو محاضرة مرتبطة بكورس مفقود':['توجد مهمة أو حصة مرتبطة بكورس مفقود.','A task or session references a missing course.','משימה או מפגש מקושרים לקורס חסר.'],
 'معرّف غير صالح':['أحد معرّفات العناصر غير صالح.','An item identifier is invalid.','מזהה פריט אינו תקין.'],
 'المتطلبات تحتوي على حلقة':['ربط المتطلبات المقترح ينشئ حلقة بين الكورسات.','The prerequisite link creates a cycle.','קישור דרישות הקדם יוצר מעגל.'],
};
/** Only fixed, translated validation hints are displayed; never raw provider errors or content. */
export function assistantValidationHint(error:unknown,language:Language):string {
 let current=error;
 for(let depth=0;depth<5&&current instanceof Error;depth++){
  const hint=hints[current.message];if(hint)return hint[language==='ar'?0:language==='en'?1:2];
  current=current.cause;
 }
 return '';
}
