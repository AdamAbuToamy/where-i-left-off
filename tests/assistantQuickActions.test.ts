import {expect,it} from 'vitest';
import {blankAssistantData,planAssistantChanges} from '../src/assistant/actions';
import {quickAssistantReply} from '../src/assistant/quickActions';
import {assistantValidationHint} from '../src/assistant/validationHint';
const fixture=()=>{const d=blankAssistantData();d.study.courses=[{id:'actual-uuid',name:'הנדסת איכות תוכנה',notes:'',url:'',x:0,y:0,requires:[]}];return d;};
it('handles the exact screenshot request with a validated Sunday 17–18 proposal without a model',()=>{
 const data=fixture(),reply=quickAssistantReply('اضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء',data,'ar')!;
 expect(reply.actions).toHaveLength(1);const changes=planAssistantChanges(data,reply.actions);
 expect(changes[0].after).toMatchObject({courseId:'actual-uuid',day:0,start:'17:00',end:'18:00',room:''});expect(data.study.lessons).toEqual([]);
});
it.each(['أضفه إلى الجدول يوم الأحد من الساعة ٥ إلى ٦ مساء','اضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء'])('normalizes Arabic numbers and spelling: %s',message=>{
 expect(quickAssistantReply(message,fixture(),'ar')?.actions[0].values).toMatchObject({start:'17:00',end:'18:00',day:0});
});
it('answers course listing directly and supports English and Hebrew timetable commands',()=>{
 const d=fixture();expect(quickAssistantReply('ما الكورسات التي عندي',d,'ar')?.text).toContain(d.study.courses[0].name);
 expect(quickAssistantReply('Add it to the timetable on Sunday from 5 to 6 pm',d,'en')?.actions[0].values).toMatchObject({courseId:'actual-uuid',start:'17:00'});
 expect(quickAssistantReply('הוסף אותו למערכת השעות ביום ראשון מ-17:00 עד 18:00',d,'he')?.actions[0].values).toMatchObject({day:0,start:'17:00'});
});
it('asks for a course when a pronoun is ambiguous and matches explicit names exactly',()=>{
 const d=fixture();d.study.courses.push({...d.study.courses[0],id:'second',name:'B'});
 expect(quickAssistantReply('Add it to the timetable on Sunday from 5 to 6 pm',d,'en')?.actions).toEqual([]);
 expect(quickAssistantReply('Add B to the timetable on Sunday from 5 to 6 pm',d,'en')?.actions[0].values).toMatchObject({courseId:'second'});
});
it('does not interpret negative, compound, quoted, partial or ambiguous commands as authorized actions',()=>{
 for(const text of ['لا تضفه الى البرنامج يوم احد من الساعة خمسة للستة مساء','Do not add it to the timetable on Sunday from 5 to 6 pm','Add it to the timetable on Sunday from 5 to 6 pm and delete my cards','"Add it to the timetable on Sunday from 5 to 6 pm"','Add it to the timetable on Sunday from 5 to 6','Add it to the timetable on Sunday from 25:00 to 26:00'])expect(quickAssistantReply(text,fixture(),'en')).toBeNull();
});
it('does not duplicate a session already applied and leaves its room unchanged',()=>{
 const d=fixture();d.study.lessons=[{id:'session',courseId:'actual-uuid',day:0,start:'17:00',end:'18:00',room:'104'}];
 expect(quickAssistantReply('Add it to the timetable on Sunday from 5 to 6 pm',d,'en')?.actions).toEqual([]);expect(d.study.lessons[0].room).toBe('104');
});
it('shows fixed translated reasons for bad times or unknown IDs without leaking raw errors',()=>{
 for(const values of [{courseId:'missing',start:'17:00'},{courseId:'actual-uuid',start:'5 pm'}]){
  try{planAssistantChanges(fixture(),[{target:'lessons',action:'create',id:'new',values}]);throw new Error('expected validation');}catch(e){expect(assistantValidationHint(e,'en')).toMatch(/unknown|valid day/);}
 }
 expect(assistantValidationHint(new Error('secret token abc'),'en')).toBe('');
});
it('handles the natural wording and follow-ups in the new screenshot with one existing course',()=>{
 const data=fixture(),first='اضف الكورس اللي عندي الى البرنامج يوم احد من الخمسة للستة مساء';
 for(const [message,history] of [[first,[]],['بس كورس واحد عندي',[{role:'user',content:first}]],['قلتلك احد من الخمسة للستة مساء',[{role:'user',content:first}]]] as const){
  expect(quickAssistantReply(message,data,'ar',[...history])?.actions[0].values).toMatchObject({courseId:'actual-uuid',day:0,start:'17:00',end:'18:00'});
 }
 expect(quickAssistantReply('قلتلك احد من الخمسة للستة مساء',data,'ar')).toBeNull();
});
it.each([
 'اضف كورس اسمه محمد. وضعه في البرنامج ايام الاحد الساعة 00:00 حتى 1:00',
 'اضف بطاقة سمها عمار ثم اضفها للاسبوع بتاريخ 25 الشهر',
 'Create course Algorithms and schedule it on Sunday at 09:00–10:00',
 'צור קורס אלגוריתמים ואז הוסף אותו למערכת ביום ראשון',
 'أنشئ بطاقة باسم مراجعة الخوارزميات والخطوة القادمة حل تمرينين',
 'Create course Algorithms',
 'عدل بطاقة مراجعة الخوارزميات الخطوة القادمة حل خمسة تمارين',
])('delegates free-form titles and compound instructions to AI rather than treating instructions as a title: %s',message=>{
 expect(quickAssistantReply(message,fixture(),'ar')).toBeNull();
});
it('does not drop other requests mixed into a timetable list, including newlines and other languages',()=>{
 const d=fixture();const table='Add to the timetable:\nSunday\n11:00–13:00 | הנדסת איכות תוכנה | Lecture';
 expect(quickAssistantReply(table,d,'en')?.actions).toHaveLength(1);
 expect(quickAssistantReply(table.replace('Sunday','Sunday — then add a card'),d,'en')).toBeNull();
 for(const extra of ['اضف بطاقة سمها عمار','ولخص ملاحظاتي في ملف','Then change the background to grid','ושנה את השפה לעברית'])expect(quickAssistantReply(table+'\n'+extra,d,'ar')).toBeNull();
});
