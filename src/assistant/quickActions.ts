import type { AssistantData, AssistantReply } from './actions';
import type { Language } from '../translations';

const words = {
 ar: {courses:'الكورسات الموجودة عندك:',none:'لا توجد كورسات بعد.',review:'التعديل جاهز للمراجعة؛ اضغط تطبيق لحفظه.',which:'أي كورس تقصد؟ اكتب اسمه مع اليوم ووقت البداية والنهاية.',duplicate:'هذه الحصة موجودة في الجدول بالفعل.'},
 en: {courses:'Your courses:',none:'You have no courses yet.',review:'Review the proposed change and click Apply to save it.',which:'Which course do you mean? Include its name, day, start and end time.',duplicate:'This session is already in your timetable.'},
 he: {courses:'הקורסים שלך:',none:'עדיין אין קורסים.',review:'יש לבדוק את השינוי המוצע ולאשר לשמירה.',which:'לאיזה קורס הכוונה? יש לציין שם, יום ושעת התחלה וסיום.',duplicate:'המפגש כבר מופיע במערכת השעות.'},
};
export const fold=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/\s+/g,' ').trim();
function originalPart(original:string,part:string,last=false):string {
 const normalized=fold(original),start=last?normalized.lastIndexOf(part):normalized.indexOf(part);if(start<0)return part;
 // Prefix lengths support Arabic diacritics and Latin case without altering saved user text.
 let begin=0,end=original.length;
 for(let i=0;i<=original.length;i++){const length=fold(original.slice(0,i)).length;if(length>start){begin=i-1;if(begin>0&&original.charCodeAt(begin)>=0xdc00&&original.charCodeAt(begin)<=0xdfff)begin--;break;}}
 for(let i=begin;i<=original.length;i++)if(fold(original.slice(0,i)).length>=start+part.length){end=i;break;}
 return original.slice(begin,end).trim();
}
const arabicNumbers=['واحده','اثنتين','ثنتين','اثنين','ثنين','ثلاثه','اربعه','خمسه','سته','سبعه','ثمانيه','تسعه','عشره','احدي عشره','اثنتي عشره'];
const numberValues=[1,2,2,2,2,3,4,5,6,7,8,9,10,11,12];
const numberPattern='(?:\\d{1,2}(?::\\d{2})?|(?:ال)?(?:'+[...arabicNumbers].sort((a,b)=>b.length-a.length).join('|')+'))';
function clock(value:string,period:string):string|null {
 const raw=fold(value).replace(/^ال/,'');const named=arabicNumbers.indexOf(raw);
 const [hour,minute]=named>=0?[numberValues[named],0]:raw.split(':').map(Number);
 const m=minute??0;let h=hour;
 if(!Number.isInteger(h)||h<0||h>23||!Number.isInteger(m)||m<0||m>59)return null;
 if(period){if(h<1||h>12)return null;h=h%12+(/مساء|pm/.test(period)?12:0);}
 return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
const days=[['الاحد','احد','sunday','ראשון'],['الاثنين','اثنين','monday','שני'],['الثلاثاء','ثلاثاء','tuesday','שלישי'],['الاربعاء','اربعاء','wednesday','רביעי'],['الخميس','خميس','thursday','חמישי'],['الجمعه','جمعه','friday','שישי'],['السبت','سبت','saturday','שבת']];
const dayPattern=days.flat().join('|');
const arSchedule=new RegExp(`^اضف(?:ه| (?:الكورس اللي عندي|الكورس الوحيد عندي|الكورس الوحيد|هذا الكورس|الكورس)| كورس (?<course>.+?)| (?<named>.+?)) (?:الي|في) (?:البرنامج|الجدول)(?: الاسبوعي)? (?:يوم )?(?<day>${dayPattern}) من (?:الساعه )?(?<start>${numberPattern})\\s*(?:الي|حتي|لل?|[-–])\\s*(?<end>${numberPattern})(?: (?<period>صباحا?|مساء|am|pm))?[.!؟?]?$`);
const enSchedule=new RegExp(`^add (.+?) to (?:the )?(?:timetable|schedule) (?:on )?(${dayPattern}) from (${numberPattern})\\s*(?:to|[-–])\\s*(${numberPattern})(?: (am|pm))?[.!?]?$`);
const heSchedule=new RegExp(`^הוסף (.+?) למערכת (?:השעות )?ביום (${dayPattern}) מ[־-]?(${numberPattern}) (?:עד|ל)[־-]?\\s*(${numberPattern})(?: (am|pm))?[.!?]?$`);
/** A narrow, fully matched command grammar. Unknown or compound requests go to AI.
 * It returns proposals only; the existing domain validator and Firebase transaction still apply. */
export function quickAssistantReply(message:string,data:AssistantData,language:Language,history:{role:string;content:string}[]=[]):AssistantReply|null {
 let text=fold(message);const t=words[language];
 const reply=(text:string):AssistantReply=>({text,actions:[],files:[]});
 if(/^(?:ما (?:هي )?الكورسات (?:التي عندي|عندي)|اذكر (?:اسماء )?الكورسات(?: الموجوده عندي)?(?: فقط)?|(?:list|show) my courses|what courses do i have|מה הקורסים שלי)[?؟.!]?$/.test(text))return reply(data.study.courses.length?t.courses+'\n'+data.study.courses.map(c=>'• '+c.name).join('\n'):t.none);
 // Resolve a short follow-up only against an outstanding explicit user schedule request.
 const lastResolved=history.findLastIndex(m=>m.role==='assistant'&&m.content.includes('[proposal resolved; do not repeat]'));
 const previous=history.slice(lastResolved+1).filter(m=>m.role==='user').map(m=>fold(m.content)).findLast(m=>arSchedule.test(m));
 if(previous&&/^(?:بس (?:عندي )?كورس واحد|عندي كورس واحد)(?: عندي)?[.!؟?]?$/.test(text))text=previous;
 if(previous&&/^(?:قلتلك|قلت لك) (?:يوم )?/.test(text))text='اضفه الي الجدول يوم '+text.replace(/^(?:قلتلك|قلت لك) (?:يوم )?/,'');
 // Whole-command matches only. Exact names are resolved against records, never database paths.
 const create=text.match(/^(?:اضف|انشئ|اعمل)(?: لي)? (بطاقه|كورس)(?: جديده?)? (?:باسم |اسمها |اسمه )?(.+?)(?: (?:والخطوه القادمه|والخطوه التاليه|الخطوه القادمه) (.+))?[.!؟?]?$/);
 const english=text.match(/^create (card|course) (.+?)(?: with next step (.+))?$/);
 const edit=text.match(/^(?:عدل|غير) بطاقه (.+?) (?:واجعل |وغير )?(?:الخطوه القادمه|الخطوه التاليه) (.+)$/);
 const enEdit=text.match(/^update card (.+?) next step to (.+)$/);
 const operation=create||english;
 if(operation){
  const kind=operation[1],name=originalPart(message,operation[2]),next=operation[3]?originalPart(message,operation[3],true):'';
  // Avoid swallowing compound instructions as a record title.
  if(!name||/\b(?:and|then|delete)\b|(?:واحذف|ثم |واضف|وعدل)/.test(name+' '+next))return null;
  const target=['كورس','course'].includes(kind)?'courses':'projects';
  if(target==='courses'&&next)return null;
  return {text:t.review,actions:[{target,action:'create',id:'new-record',...(target==='projects'?{scope:'personal'}:{}),values:target==='courses'?{name}:{name,nextStep:next}}],files:[]};
 }
 if(edit||enEdit){
  const match=(edit||enEdit)!,cards=data.scopes.find(s=>s.id==='personal')?.projects.filter(p=>fold(p.name)===match[1])||[];
  if(cards.length!==1)return null;
  return {text:t.review,actions:[{target:'projects',action:'update',scope:'personal',id:cards[0].id,values:{nextStep:originalPart(message,match[2],true)}}],files:[]};
 }
 let courseName:string,dayName:string,startRaw:string,endRaw:string,period:string;
 const ar=text.match(arSchedule),en=text.match(enSchedule),he=text.match(heSchedule);
 if(ar){courseName=ar.groups!.course||ar.groups!.named||'it';dayName=ar.groups!.day;startRaw=ar.groups!.start;endRaw=ar.groups!.end;period=ar.groups!.period||'';}
 else if(en||he){const m=(en||he)!;[,courseName,dayName,startRaw,endRaw]=m;period=m[5]||'';}
 else return null;
 // Without a named course we resolve only when the account has exactly one course.
 const candidates=/^(?:it|هذا الكورس|الكورس|אותו)$/.test(courseName)?data.study.courses:data.study.courses.filter(c=>fold(c.name)===courseName);
 if(candidates.length!==1)return reply(t.which);
 // Bare 5–6 is ambiguous (morning/evening). Let the assistant clarify rather than guess.
 if(!period&&(!startRaw.includes(':')||!endRaw.includes(':')))return null;
 const start=clock(startRaw,period),end=clock(endRaw,period),day=days.findIndex(names=>names.includes(dayName));
 if(!start||!end||end<=start||day<0)return null;
 const course=candidates[0];
 if(data.study.lessons.some(l=>l.courseId===course.id&&l.day===day&&l.start===start&&l.end===end))return reply(t.duplicate);
 return {text:t.review,actions:[{target:'lessons',action:'create',id:'new-session',values:{courseId:course.id,day,start,end,room:'',sessionType:'lecture'}}],files:[]};
}
