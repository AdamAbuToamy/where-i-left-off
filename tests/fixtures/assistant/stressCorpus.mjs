import {acceptanceCases} from './corpus.mjs';

// The originals remain the oracle. These prompts change the linguistic surface
// only, never the requested operations, dates, IDs, or field values.
const wrappers={
 ar:[
   p=>p,
   p=>'لو سمحت، نفّذ الطلب التالي كما هو، ولا تضف عمليات من عندك: '+p,
   p=>'محتاج مساعدتك في شغلة داخل الموقع. المطلوب بالضبط: '+p,
   p=>'بالعامية: يا ريت تعمل التالي عندي في الحساب: '+p,
   p=>'الطلب الأساسي في السطر التالي. انتبه لكل جزء منه:\n'+p,
   p=>'قبل ما تبدأ: لا تحفظ شيئًا من دون مراجعة. اقترح فقط هذا التعديل: '+p,
   p=>'هذه رسالة واحدة حتى لو احتوت أكثر من فعل. لا تسقط أي خطوة:\n'+p,
   p=>'ما بدي شرح طويل ولا افتراضات جديدة؛ بدي النتيجة المطابقة للطلب: '+p,
   p=>'الهدف اختبار الدقة. الاسماء والأرقام المذكورة مقصودة حرفيًا. '+p,
   p=>'رجاءً حافظ على الحقول الأخرى كما هي، واشتغل فقط على المطلوب: '+p,
 ],
 en:[
   p=>p,
   p=>'Please perform exactly this request without inventing extra changes: '+p,
   p=>'I need help with a task in my account. Here is the exact request: '+p,
   p=>'Casually speaking, can you handle this for me? '+p,
   p=>'The full instruction is on the next line; do not skip anything:\n'+p,
   p=>'Do not save without review. Prepare the precise changes described here: '+p,
   p=>'Treat this as one request even when it contains several actions. '+p,
   p=>'I want the requested result, not a long explanation. Request: '+p,
   p=>'Names, dates, times, and numbers are deliberate. Please handle: '+p,
   p=>'Leave all unrelated fields untouched; change only what I specify: '+p,
 ],
 he:[
   p=>p,
   p=>'בבקשה בצע בדיוק את הבקשה הזאת בלי להמציא שינויים נוספים: '+p,
   p=>'אני צריך עזרה בפעולה בחשבון שלי. הבקשה המדויקת: '+p,
   p=>'בשפה יומיומית: אפשר לטפל בזה בשבילי? '+p,
   p=>'כל ההוראות מופיעות בשורה הבאה. אל תדלג על פרטים:\n'+p,
   p=>'אל תשמור בלי אישור. הכן את השינויים הבאים לבדיקה: '+p,
   p=>'זו בקשה אחת גם אם יש בה כמה פעולות. אל תשמיט אף שלב: '+p,
   p=>'אני רוצה את התוצאה המבוקשת ולא הסבר ארוך. הבקשה: '+p,
   p=>'השמות, התאריכים, השעות והמספרים נבחרו בכוונה. '+p,
   p=>'השאר את כל השדות האחרים ללא שינוי ופעל רק לפי הבקשה: '+p,
 ],
};
export const STRESS_CASES_PER_LANGUAGE=2000;
export const STRESS_TOTAL=3*STRESS_CASES_PER_LANGUAGE;

export function buildStressCorpus(count=STRESS_CASES_PER_LANGUAGE){
 if(!Number.isInteger(count)||count<1||count>STRESS_CASES_PER_LANGUAGE)throw new RangeError('stress-count');
 const cases=[];
 for(const language of ['ar','en','he']){
  const originals=acceptanceCases.filter(c=>c.language===language);
  if(!originals.length)throw new Error('missing-original-language:'+language);
  const seen=new Set();let generated=0;
  for(let round=0;generated<count;round++){
   if(round>=wrappers[language].length)throw new Error('insufficient-distinct-stress-variants:'+language);
   for(const source of originals){
    if(generated>=count)break;
    const message=wrappers[language][round](source.message);
    if(seen.has(message))continue;
    seen.add(message);generated++;
    cases.push({
     ...source,
     id:'stress-'+language+'-'+String(cases.length).padStart(4,'0'),
     message,
     sourceId:source.id,
     variation:round,
     // Expected operations remain the original independently authored oracle.
    });
   }
  }
 }
 return cases;
}
