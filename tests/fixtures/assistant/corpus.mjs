/** Authored synthetic request corpus. Expected actions are an oracle, NOT model inference. */
export function acceptanceContext(id=''){const context={localDate:'2026-10-23',timezone:'Asia/Jerusalem',study:{version:1,importedAt:'',courses:[{id:'course',name:'204 — Algorithms / אלגוריתמים',url:'',notes:'Keep',requires:[],topics:[],x:0,y:0},{id:'other',name:'Networks / רשתות תקשורת',url:'',notes:'',requires:[],x:0,y:0},{id:'unused',name:'Unused course',url:'',notes:'',requires:[],x:0,y:0}],tasks:[{id:'task',courseId:'course',title:'Assignment 1',kind:'assignment',due:'',done:false,notes:'Keep',url:''}],lessons:[{id:'lesson',courseId:'course',day:1,start:'09:00',end:'10:00',sessionType:'lecture',room:'R0',notes:'Keep'}]},scopes:[{id:'personal',name:'Personal',projects:[{id:'card',name:'عمار',nextStep:'Keep',status:'later',description:'Keep',sectionId:'',assignedTo:'alice',rank:100,revision:0,activityAt:100,completedAt:0}],sections:[{id:'section',name:'Study',revision:0}]}]};
 const card=context.scopes[0].projects[0];
 if(id.startsWith('state-clear-date'))card.dueDate='2026-11-01';
 if(id.startsWith('state-restore'))card.trashedAt=300;
 if(id.startsWith('state-unarchive'))card.archivedAt=200;
 if(id.startsWith('state-later'))card.status='active';
 if(id.startsWith('state-reopen-task'))context.study.tasks[0].done=true;
 if(id.startsWith('clear-prereqs'))context.study.courses[0].requires=['other'];
 if(id.startsWith('complete-topic'))context.study.courses[0].topics=[{id:'topic',title:'Chapter 1',done:false}];
 return context;
}
const rows={
 projects:[
 ['name','Robot','غيّر اسم بطاقة عمار إلى Robot','Rename card عمار to Robot','שנה את שם הכרטיס عمار ל-Robot'],
 ['nextStep','Solve exercise 2','اجعل الخطوة التالية لبطاقة عمار Solve exercise 2','Set the next step on عمار to Solve exercise 2','קבע את הצעד הבא בכרטיס عمار ל-Solve exercise 2'],
 ['status','waiting','ضع بطاقة عمار بحالة انتظار','Set card عمار to waiting','העבר את הכרטיס عمار למצב המתנה'],
 ['description','New notes','استبدل ملاحظات بطاقة عمار بالنص New notes','Replace the notes on card عمار with New notes','החלף את ההערות בכרטיס عمار ב-New notes'],
 ['dueDate','2026-10-25','موعد بطاقة عمار 25 أكتوبر 2026','Set card عمار due date to October 25, 2026','קבע תאריך יעד לכרטיס عمار ל-25 באוקטובר 2026'],
 ['followUpDate','2026-11-01','تابع بطاقة عمار في 1 نوفمبر 2026','Follow up on card عمار on November 1, 2026','קבע מעקב לכרטיס عمار ב-1 בנובמבר 2026'],
 ['checkpoint','Page 12','سجل أنني توقفت في بطاقة عمار عند Page 12','Set the checkpoint of card عمار to Page 12','רשום נקודת עצירה בכרטיס عمار: Page 12'],
 ['checklist','[ ] One\n[x] Two','قائمة بطاقة عمار: One غير مكتمل وTwo مكتمل','Set card عمار checklist to unchecked One and checked Two','קבע רשימת בדיקה בכרטיס عمار: One לא הושלם, Two הושלם'],
 ['sectionId','section','انقل بطاقة عمار إلى قسم Study','Move card عمار to section Study','העבר את הכרטיס عمار למדור Study'],
 ['projectUrl','https://example.test/project','رابط بطاقة عمار https://example.test/project','Set card عمار link to https://example.test/project','קבע קישור לכרטיס عمار: https://example.test/project'],
 ['attachmentUrl','https://example.test/notes','رابط المرفق لبطاقة عمار https://example.test/notes','Set card عمار attachment link to https://example.test/notes','קבע קישור לקובץ בכרטיס عمار: https://example.test/notes'],
 ['links',['https://example.test/one'],'ضع رابط بطاقة عمار الإضافي https://example.test/one','Set the extra links on عمار to https://example.test/one','קבע קישורים נוספים בכרטיס عمار: https://example.test/one'],
 ['resourceType','book','غيّر نوع مورد بطاقة عمار إلى كتاب','Change card عمار resource type to book','שנה את סוג המשאב בכרטיס عمار לספר'],
 ['progressUnits',12,'تقدمي في بطاقة عمار 12 وحدة','Set progress on card عمار to 12 units','עדכן התקדמות בכרטיס عمار ל-12 יחידות'],
 ['totalUnits',100,'المجموع في بطاقة عمار 100 وحدة','Set total units on card عمار to 100','קבע סך יחידות בכרטיס عمار ל-100'],
 ['kind','deadline','غيّر نوع بطاقة عمار إلى موعد نهائي','Change card عمار kind to deadline','שנה את סוג הכרטיס عمار למועד אחרון'],
 ['rank',400,'اجعل ترتيب بطاقة عمار بالقيمة 400','Set card عمار ordering rank to 400','קבע סדר לכרטיס عمار בערך 400'],
 ['assignedTo','','ألغ تعيين المسؤول عن بطاقة عمار','Unassign card عمار','הסר שיוך אחראי מהכרטיס عمار'],
 ['coverUrl','https://example.test/cover.png','صورة بطاقة عمار https://example.test/cover.png','Set card عمار cover to https://example.test/cover.png','קבע תמונה לכרטיס عمار: https://example.test/cover.png'],
 ['archivedAt',200,'أرشف بطاقة عمار','Archive card عمار','העבר את הכרטיס عمار לארכיון'],
 ['trashedAt',300,'انقل بطاقة عمار إلى السلة','Move card عمار to trash','שים את הכרטיס عمار בפח'],
 ],
 courses:[
 ['name','Algorithms II','سم كورس Algorithms باسم Algorithms II','Rename Algorithms to Algorithms II','שנה את שם הקורס אלגוריתמים ל-Algorithms II'],
 ['url','https://example.test/course','رابط كورس Algorithms هو https://example.test/course','Set Algorithms URL to https://example.test/course','קבע קישור לקורס אלגוריתמים: https://example.test/course'],
 ['notes','New course notes','استبدل ملاحظات كورس Algorithms بالنص New course notes','Replace Algorithms notes with New course notes','החלף הערות בקורס אלגוריתמים ב-New course notes'],
 ['requires',['other'],'اجعل Networks متطلبا مسبقا لكورس Algorithms','Set Networks as a prerequisite of Algorithms','קבע רשתות תקשורת כדרישת קדם לאלגוריתמים'],
 ['topics',[{id:'topic',title:'Chapter 1',done:false}],'أضف إلى Algorithms موضوع Chapter 1 غير مكتمل','Set Algorithms topics to Chapter 1, not completed','הוסף לאלגוריתמים נושא Chapter 1 שלא הושלם'],
 ['x',400,'حرك كورس Algorithms أفقيا إلى 400 في الخريطة','Move Algorithms horizontally to x=400 on the map','הזז את אלגוריתמים במפה למיקום אופקי 400'],
 ['y',500,'حرك كورس Algorithms عموديا إلى 500 في الخريطة','Move Algorithms vertically to y=500 on the map','הזז את אלגוריתמים במפה למיקום אנכי 500'],
 ],
 tasks:[
 ['courseId','other','انقل Assignment 1 إلى Networks','Move Assignment 1 to Networks','העבר את Assignment 1 לקורס רשתות תקשורת'],
 ['title','Exam preparation','سم المهمة Assignment 1 باسم Exam preparation','Rename Assignment 1 to Exam preparation','שנה את שם Assignment 1 ל-Exam preparation'],
 ['kind','exam','حوّل Assignment 1 إلى امتحان','Change Assignment 1 to an exam','שנה את סוג Assignment 1 למבחן'],
 ['due','2026-11-01T12:00:00+02:00','موعد Assignment 1 يوم 1 نوفمبر 2026 الساعة 12 بتوقيت إسرائيل','Set Assignment 1 deadline to Nov 1, 2026 at 12:00 Israel time','קבע מועד ל-Assignment 1 ב-1 בנובמבר 2026 בשעה 12:00 בישראל'],
 ['done',true,'أنجزت Assignment 1 علّمها مكتملة','Mark Assignment 1 completed','סמן את Assignment 1 כהושלמה'],
 ['notes','Bring ID','ملاحظات Assignment 1: Bring ID','Replace Assignment 1 notes with Bring ID','החלף הערות ב-Assignment 1 ב-Bring ID'],
 ['url','https://example.test/task','رابط Assignment 1 هو https://example.test/task','Set Assignment 1 link to https://example.test/task','קבע קישור ל-Assignment 1: https://example.test/task'],
 ],
 lessons:[
 ['courseId','other','انقل حصة Algorithms الاثنين إلى Networks','Move the Monday Algorithms session to Networks','העבר את המפגש של אלגוריתמים ביום שני לרשתות תקשורת'],
 ['sessionType','tutorial','حوّل حصة Algorithms الاثنين إلى تمرين','Change Monday Algorithms session to a tutorial','שנה את המפגש של אלגוריתמים ביום שני לתרגול'],
 ['day',4,'انقل حصة Algorithms من الاثنين إلى الخميس','Move Monday Algorithms session to Thursday','העבר את המפגש של אלגוריתמים מיום שני לחמישי'],
 ['start','09:20','اجعل بداية حصة Algorithms الاثنين 09:20','Start Monday Algorithms session at 09:20','שנה את תחילת המפגש של אלגוריתמים ביום שני ל-09:20'],
 ['end','16:00','اجعل نهاية حصة Algorithms الاثنين 16:00','End Monday Algorithms session at 16:00','שנה את סוף המפגש של אלגוריתמים ביום שני ל-16:00'],
 ['room','104','قاعة حصة Algorithms الاثنين هي 104','Set Monday Algorithms session room to 104','קבע חדר 104 למפגש אלגוריתמים ביום שני'],
 ['notes','Flipped classroom','ملاحظة حصة Algorithms الاثنين: Flipped classroom','Set Monday Algorithms session notes to Flipped classroom','קבע הערה למפגש אלגוריתמים ביום שני: Flipped classroom'],
 ],
 sections:[['name','Semester','سم قسم Study باسم Semester','Rename section Study to Semester','שנה את שם המדור Study ל-Semester']],
};
const ids={projects:'card',courses:'course',tasks:'task',lessons:'lesson',sections:'section'};
const req=(target,operation,field,value,match='equals')=>({target,operation,field,expectedJson:JSON.stringify(value),match});
function caseOf(id,messages,actions=[],controls=[],intents){return messages.map((message,i)=>({id:id+'-'+['ar','en','he'][i],language:['ar','en','he'][i],message,actions,controls,intents:intents||[...actions.map(a=>({title:message,source:message,subject:a.id,recordId:a.action==='create'?'':a.id,outcome:'proposed',requirements:['delete','trash'].includes(a.action)?[req(a.target,a.action,'',null)]:Object.entries(a.values||{}).map(([field,value])=>req(a.target,a.action,field,value,['archivedAt','trashedAt'].includes(field)&&value>0?'positive':'equals'))})),...controls.map(c=>({title:message,source:message,subject:c.kind,recordId:'',outcome:'proposed',requirements:Object.entries(c.values).map(([field,value])=>req(c.kind,'control',field,value))}))]}));}
export const acceptanceCases=[];
for(const [target,fields] of Object.entries(rows))for(const [field,value,...messages] of fields){
 // Archive/trash times are server-generated effects: oracle checks the resulting state,
 // not the precise timestamp invented by a language model.
 acceptanceCases.push(...caseOf(`update-${target}-${field}`,messages,[{target,action:'update',id:ids[target],scope:'personal',values:{[field]:value}}]));
}
const createRows=[
 ['projects',{name:'New card'},['أضف بطاقة باسم New card','Create a card named New card','צור כרטיס בשם New card']],
 ['sections',{name:'New section'},['أضف قسما باسم New section','Create a section named New section','צור מדור בשם New section']],
 ['courses',{name:'Physics'},['أضف كورسا باسم Physics','Create a course named Physics','צור קורס בשם Physics']],
 ['tasks',{courseId:'course',title:'Homework 2',kind:'assignment',due:'',notes:'',done:false,url:''},['أضف وظيفة Homework 2 إلى Algorithms دون موعد','Add assignment Homework 2 to Algorithms without a deadline','הוסף מטלה Homework 2 לאלגוריתמים ללא מועד']],
 ['lessons',{courseId:'course',day:0,start:'00:00',end:'01:00',sessionType:'tutorial',room:''},['أضف تمرين Algorithms الأحد من 00:00 إلى 01:00 دون قاعة','Add Algorithms tutorial Sunday 00:00–01:00 without a room','הוסף תרגול אלגוריתמים ביום ראשון 00:00–01:00 ללא חדר']],
];
for(const [target,values,messages] of createRows)acceptanceCases.push(...caseOf(`create-${target}`,messages,[{target,action:'create',id:'new-'+target,scope:'personal',values}]));
for(const [target,id,messages] of [
 ['projects','card',['احذف بطاقة عمار إلى السلة','Trash card عمار','העבר את הכרטיס عمار לאשפה']],
 ['sections','section',['احذف القسم الفارغ Study','Delete the empty Study section','מחק את המדור הריק Study']],
 ['courses','unused',['احذف كورس Unused course الفارغ','Delete the empty Unused course','מחק את הקורס הריק Unused course']],
 ['tasks','task',['احذف Assignment 1','Delete Assignment 1','מחק את Assignment 1']],
 ['lessons','lesson',['احذف حصة Algorithms يوم الاثنين','Delete the Monday Algorithms session','מחק את המפגש של אלגוריתמים ביום שני']],
])acceptanceCases.push(...caseOf(`delete-${target}`,messages,[{target,action:target==='projects'?'trash':'delete',id,scope:'personal',values:{}}]));
for(const [id,kind,values,messages] of [
 ['theme','appearance',{theme:'ocean'},['غيّر اللون إلى Ocean','Change the theme to Ocean','שנה את ערכת הצבעים ל-Ocean']],
 ['background','appearance',{background:'grid'},['غيّر الخلفية إلى شبكة','Change the background to grid','שנה את הרקע לרשת']],
 ['language','language',{language:'he'},['غيّر اللغة إلى العبرية','Switch the language to Hebrew','שנה את השפה לעברית']],
 ['sleep','sleep',{enabled:true},['شغّل وضع السكون','Enable sleep mode','הפעל מצב שינה']],
 ['review','workflow',{reviewDays:30},['راجع البطاقات كل 30 يوما','Set card review interval to 30 days','קבע סקירת כרטיסים כל 30 ימים']],
 ['open','navigate',{page:'university',tab:'schedule'},['افتح الجدول الجامعي','Open the university timetable','פתח את מערכת השעות באוניברסיטה']],
])acceptanceCases.push(...caseOf('control-'+id,messages,[],[{kind,values}]));
for(const [id,values,messages] of [
 ['active',{status:'active'},['ابدأ العمل على بطاقة عمار','Start working on card عمار','התחל לעבוד על הכרטיס عمار']],
 ['done',{status:'done'},['أكمل بطاقة عمار','Complete card عمار','סיים את הכרטיס عمار']],
 ['later',{status:'later'},['اجعل بطاقة عمار لوقت لاحق','Set card عمار to later','דחה את הכרטיס عمار לאחר כך']],
 ['clear-date',{dueDate:''},['أزل موعد بطاقة عمار','Remove card عمار due date','הסר את תאריך היעד בכרטיס عمار']],
 ['restore',{trashedAt:0},['استعد بطاقة عمار من السلة','Restore card عمار from trash','שחזר את הכרטיס عمار מהאשפה']],
 ['unarchive',{archivedAt:0},['أعد بطاقة عمار من الأرشيف','Unarchive card عمار','הוצא את הכרטיס عمار מהארכיון']],
 ['reopen-task',{done:false},['أعد فتح Assignment 1','Reopen Assignment 1','פתח מחדש את Assignment 1']],
]){const target=id==='reopen-task'?'tasks':'projects';acceptanceCases.push(...caseOf('state-'+id,messages,[{target,action:'update',id:ids[target],values}]));}
// Exact regression: three effects sharing one new card, no dependence on model task grouping.
const compoundMessages=['أضف بطاقة باسم عمار وضعها في الاسبوع يوم 25 الشهر\nأضف اليها ملاحظة اكتب فيها: مرحبا نجحت','Create a card named Ammar, put it on the week of the 25th of this month, and add the note: Hello, it worked','צור כרטיס בשם עמר, שים אותו בשבוע של ה-25 בחודש והוסף הערה: שלום, הצליח'];
compoundMessages.forEach((message,i)=>{
 const name=['عمار','Ammar','עמר'][i],note=['مرحبا نجحت','Hello, it worked','שלום, הצליח'][i];
 const actions=[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name,dueDate:'2026-10-25',description:note}}];
 const intents=[req('projects','create','name',name),req('projects','update','dueDate','2026-10-25'),req('projects','update','description',note,'contains')].map((r,n)=>({title:['Create','Schedule','Note'][n],source:message,subject:'new-card',recordId:'',outcome:'proposed',requirements:[r]}));
 acceptanceCases.push({id:'compound-card-'+['ar','en','he'][i],language:['ar','en','he'][i],message,actions,controls:[],intents});
});
const extras=[
 ['two-fields',['غيّر اسم بطاقة عمار إلى R وأضف خطوة Go','Rename card عمار to R and set next step Go','שנה את שם הכרטיס عمار ל-R והגדר צעד הבא Go'],[{target:'projects',action:'update',id:'card',values:{name:'R',nextStep:'Go'}}]],
 ['clear-notes',['امسح ملاحظات بطاقة عمار فقط','Clear only card عمار notes','מחק רק את הערות הכרטיס عمار'],[{target:'projects',action:'update',id:'card',values:{description:''}}]],
 ['lesson-move',['انقل حصة Algorithms إلى الأحد 14:00–16:00 واجعلها مختبرا في 105','Move Algorithms session to Sunday 14:00–16:00 as a lab in room 105','העבר את מפגש אלגוריתמים לראשון 14:00–16:00 כמעבדה בחדר 105'],[{target:'lessons',action:'update',id:'lesson',values:{day:0,start:'14:00',end:'16:00',sessionType:'lab',room:'105'}}]],
 ['new-exam',['أضف امتحان Final إلى Networks يوم 1 نوفمبر 2026 الساعة 12 بتوقيت إسرائيل','Add exam Final to Networks on Nov 1 2026 at 12:00 Israel time','הוסף מבחן Final לרשתות תקשורת ב-1 בנובמבר 2026 ב-12:00 בישראל'],[{target:'tasks',action:'create',id:'new-exam',values:{courseId:'other',title:'Final',kind:'exam',due:'2026-11-01T12:00:00+02:00'}}]],
 ['new-course-lesson',['أضف كورس Muhammad وحصة له الأحد 00:00–01:00','Create course Muhammad and its Sunday class 00:00–01:00','צור קורס Muhammad ומפגש שלו ביום ראשון 00:00–01:00'],[{target:'courses',action:'create',id:'new-course',values:{name:'Muhammad'}},{target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:0,start:'00:00',end:'01:00',sessionType:'lecture',room:''}}]],
 ['section-card',['أنشئ قسم Lab وبداخله بطاقة Sensor','Create a section Lab and a card Sensor inside it','צור מדור Lab וכרטיס Sensor בתוכו'],[{target:'sections',action:'create',id:'new-section',values:{name:'Lab'}},{target:'projects',action:'create',id:'new-card',values:{name:'Sensor',sectionId:'new-section'}}]],
 ['ten-cards',['أضف عشر بطاقات مستقلة بأسماء Item 1 إلى Item 10','Create ten separate cards named Item 1 through Item 10','צור עשרה כרטיסים נפרדים בשם Item 1 עד Item 10'],Array.from({length:10},(_,i)=>({target:'projects',action:'create',id:'item-'+i,values:{name:'Item '+(i+1)}}))],
 ['delete-dependent-course',['احذف Algorithms مع مهمته وحصته','Delete Algorithms with its task and class','מחק את אלגוריתמים עם המשימה והמפגש שלו'],[{target:'tasks',action:'delete',id:'task',values:{}},{target:'lessons',action:'delete',id:'lesson',values:{}},{target:'courses',action:'delete',id:'course',values:{}}]],
 ['quoted-name',['أضف بطاقة بعنوان «مرحبا ثم انطلق» حرفيا','Create a card with the literal title "مرحبا ثم انطلق"','צור כרטיס עם הכותרת המילולית "مرحبا ثم انطلق"'],[{target:'projects',action:'create',id:'quoted',values:{name:'مرحبا ثم انطلق'}}]],
 ['complete-topic',['ضع موضوع Chapter 1 في Algorithms كمكتمل','Set Algorithms topic Chapter 1 completed','סמן את נושא Chapter 1 באלגוריתמים כהושלם'],[{target:'courses',action:'update',id:'course',values:{topics:[{id:'topic',title:'Chapter 1',done:true}]}}]],
 ['clear-prereqs',['أزل جميع متطلبات Algorithms السابقة','Remove all Algorithms prerequisites','הסר את כל דרישות הקדם של אלגוריתמים'],[{target:'courses',action:'update',id:'course',values:{requires:[]}}]],
 ['uncheck-task',['علّم Assignment 1 غير مكتمل مع ملاحظة Retry','Mark Assignment 1 incomplete and replace its note with Retry','סמן את Assignment 1 כלא הושלם והחלף את ההערה ב-Retry'],[{target:'tasks',action:'update',id:'task',values:{done:false,notes:'Retry'}}]],
 ['two-courses',['أضف كورسين منفصلين Chemistry وBiology','Create two separate courses Chemistry and Biology','צור שני קורסים נפרדים Chemistry ו-Biology'],[{target:'courses',action:'create',id:'chem',values:{name:'Chemistry'}},{target:'courses',action:'create',id:'bio',values:{name:'Biology'}}]],
];
for(const [id,messages,actions] of extras)acceptanceCases.push(...caseOf(id,messages,actions));
// 126 distinct two-effect combinations exercise the original failure class: independent
// requests for different fields on the SAME record. Each has three authored language forms.
let pairs=0;
for(let first=0;first<rows.projects.length&&pairs<126;first++)for(let second=first+1;second<rows.projects.length&&pairs<126;second++){
 const a=rows.projects[first],b=rows.projects[second],messages=[0,1,2].map(i=>a[i+2]+[' ثم: ',' Then: ',' ואז: '][i]+b[i+2]);
 const actions=[{target:'projects',action:'update',id:'card',values:{[a[0]]:a[1]}},{target:'projects',action:'update',id:'card',values:{[b[0]]:b[1]}}];
 acceptanceCases.push(...caseOf(`pair-${a[0]}-${b[0]}`,messages,actions));pairs++;
}
