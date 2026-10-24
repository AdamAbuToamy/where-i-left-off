/**
 * Reproducible paraphrase matrix. The authored oracle/actions are preserved:
 * neither generated phrases nor LLM output can redefine what counts as success.
 * The matrix is separate from baseline so Firestore replay stays bounded.
 */
export const verbs={
 ar:{
  add:[['أضف','أنشئ','اعمل','اصنع','سوّي','سجّل'],['أنشئ','أضف','اعمل','اصنع','سوي']],
  edit:[['غيّر','عدّل','بدّل','حدّث'],['اجعل','خلّي','خلي','حوّل'],['انقل','حرّك','حوّل']],
  delete:[['احذف','امسح','شيل','أزل'],['امسح','احذف','أزل'],['أزل','احذف','امسح']],
 },
 en:{
  add:[['Create','Add','Make','Set up'],['Add','Create','Make','Set up']],
  edit:[['Change','Update','Modify'],['Set','Update','Change'],['Move','Shift','Transfer']],
  delete:[['Delete','Remove','Erase'],['Remove','Delete','Clear'],['Trash','Move to trash']],
 },
 he:{
  add:[['צור','הוסף','תיצור','תכין'],['הוסף','צור','תוסיף','תכין']],
  edit:[['שנה','עדכן','תחליף'],['קבע','עדכן','שנה'],['העבר','הזז','שנה']],
  delete:[['מחק','הסר','תמחק'],['הסר','מחק','תסיר']],
 },
};
const polite={ar:['لو سمحت، ','ممكن '],en:['Please ','Could you please '],he:['בבקשה ','אפשר ' ]};
function substitutions(message,language){
 const replacements=Object.values(verbs[language]||{}).flat();
 const result=[];
 for(const group of replacements){
  const head=group[0];
  if(!message.startsWith(head+' '))continue;
  for(const alternative of group.slice(1))result.push(alternative+message.slice(head.length));
  break;
 }
 return [...new Set(result)].filter(text=>text!==message);
}
export function paraphraseCases(cases,{variants=4}={}){
 const result=[],seen=new Set(cases.map(c=>c.id));
 for(const original of cases){
  const language=original.language,alternatives=[
   ...polite[language].map(prefix=>prefix+original.message),
   ...substitutions(original.message,language),
  ];
  let n=0;
  for(const message of [...new Set(alternatives)].slice(0,variants)){
   const id=original.id+'-paraphrase-'+(++n);
   if(seen.has(id))throw new Error('duplicate-generated-case');
   seen.add(id);
   result.push({...original,id,message,originCaseId:original.id,variant:'paraphrase'});
  }
 }
 return result;
}
export const sequencePatterns=[
 ['create-edit','إنشاء ← تعديل','Create → edit','יצירה → עריכה'],
 ['create-delete','إنشاء ← حذف','Create → delete','יצירה → מחיקה'],
 ['create-create-edit','إنشاء ← إنشاء ← تعديل','Create → create → edit','יצירה → יצירה → עריכה'],
 ['create-create-create-edit','إنشاء ← إنشاء ← إنشاء ← تعديل','Create → create → create → edit','יצירה → יצירה → יצירה → עריכה'],
 ['create-update-trash-section','إنشاء قسم ← بطاقة ← تعديل ← حذف بطاقة وقسم','Create section → card → edit → trash and delete section','יצירת מדור → כרטיס → עריכה → מחיקת הכרטיס והמדור'],
 ['edit-edit-edit','تعديل ← تعديل ← تعديل','Edit → edit → edit','עריכה → עריכה → עריכה'],
];
