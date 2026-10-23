import type { Language } from '../translations';
const hints:Record<string,[string,string,string]>={
 'invalid-due-date':['تاريخ البطاقة يجب أن يكون تاريخًا حقيقيًا بصيغة YYYY-MM-DD.','Card dates must be real calendar dates in YYYY-MM-DD format.','תאריך הכרטיס חייב להיות תאריך תקין בפורמט YYYY-MM-DD.'],
 'invalid-project':['بيانات البطاقة لا تطابق الحقول أو حدود النص المسموحة.','The card fields or text lengths are invalid.','שדות הכרטיס או אורכי הטקסט אינם תקינים.'],
 'invalid-project-url':['أحد روابط البطاقة غير صالح؛ استخدم رابط HTTP أو HTTPS.','A card link is invalid; use HTTP or HTTPS.','קישור בכרטיס אינו תקין; השתמשו ב-HTTP או HTTPS.'],
 'invalid-attachment-url':['رابط المرفق غير صالح؛ استخدم رابط HTTP أو HTTPS.','The attachment link is invalid; use HTTP or HTTPS.','קישור הקובץ אינו תקין; השתמשו ב-HTTP או HTTPS.'],
 'assistant-task-date':['موعد مهمة الجامعة يحتاج التاريخ والوقت والمنطقة الزمنية.','University deadlines need a date, time and timezone offset.','מועד משימה דורש תאריך, שעה ואזור זמן.'],
 'assistant-alias':['معرّفات العناصر الجديدة مكررة أو تتعارض مع عناصر موجودة.','New item aliases must be unique and distinct from existing IDs.','מזהי הפריטים החדשים חייבים להיות ייחודיים.'],
 'assistant-task-coverage':['لم يربط المساعد كل التعديلات بسجل المهام.','The assistant did not account for every proposed operation.','העוזר לא קישר את כל הפעולות לרשימת המשימות.'],
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
