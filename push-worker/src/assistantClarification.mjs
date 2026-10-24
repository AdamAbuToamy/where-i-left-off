const words={
 ar:{name:'ما الاسم الذي تريده؟',extras:name=>`اسمها «${name}». هل تريد أي تفاصيل إضافية: القسم، الموعد، الملاحظات أو الرابط؟ سأحتفظ بما ذكرته؛ يمكنك قول «بدون إضافات» للمتابعة.`,study:name=>`بالنسبة إلى «${name}»، هل تريد موعدًا أو نوعًا للمهمة أو ملاحظات أو رابطًا؟ يمكنك تخطي الإضافات.`,course:name=>`بالنسبة إلى «${name}»، هل تريد ملاحظات أو رابطًا؟ يمكنك قول «بدون إضافات».`,sections:'الأقسام المتاحة: '},
 en:{name:'What would you like to name it?',extras:name=>`For “${name}”, would you like a section, date, notes or link? I will keep what you already specified. You can say “no extras” to continue.`,study:name=>`For “${name}”, would you like a deadline, task type, notes or link? You can skip extras.`,course:name=>`For “${name}”, would you like notes or a link? You can say “no extras”.`,sections:'Available sections: '},
 he:{name:'איך תרצה לקרוא לזה?',extras:name=>`עבור ״${name}״, להוסיף מדור, תאריך, הערות או קישור? אשמור פרטים שכבר מסרת. אפשר לומר ״בלי תוספות״ כדי להמשיך.`,study:name=>`עבור ״${name}״, להוסיף מועד, סוג משימה, הערות או קישור? אפשר לדלג.`,course:name=>`עבור ״${name}״, להוסיף הערות או קישור? אפשר לומר ״בלי תוספות״.`,sections:'מדורים זמינים: '},
};
/** Missing creation choices are a workflow state, never silently guessed defaults. */
export function clarifyMinimalCreation(plan,language,context,history=[],message=''){
 const skipped=['بدون إضافات','بدون اي اضافات','بدون أي إضافات','بدون اضافات','no extras','skip extras','without extras','בלי תוספות','ללא תוספות'].some(choice=>message.normalize('NFKC').toLowerCase().includes(choice));
 const prior=history.filter(turn=>turn.role==='assistant').map(turn=>{try{return JSON.parse(turn.content);}catch{return null;}}).filter(turn=>turn?.status==='pending'&&turn.proposal?.clarification?.kind==='creation-details').at(-1)?.proposal.clarification;
 if(!plan.actions.length&&!plan.controls.length&&prior&&plan.tasks.some(t=>t.outcome==='needs-input'))return {...plan,clarification:prior};
 if(plan.actions.length!==1||plan.actions[0].action!=='create'||plan.controls.some(c=>c.kind!=='navigate'))return plan;
 const action=plan.actions[0],v=action.values||{},w=words[language]||words.en;
 const identity=action.target==='tasks'?'title':'name',name=v[identity];let question;
 if(name&&(skipped||prior?.target===action.target&&prior.scope===(action.scope||'personal')))return plan;
 if(action.target!=='lessons'&&(typeof name!=='string'||!name.trim()))question=w.name;
 else if(action.target==='projects'){
  const fields=['sectionId','dueDate','description','projectUrl'];
  // Ask only when no reliable optional detail was provided.\n  if(fields.filter(k=>v[k]).length>=2||['dueDate','description','projectUrl'].some(k=>typeof v[k]==='string'&&v[k].trim()))return plan;
  question=w.extras(name);
  let data;try{data=JSON.parse(context||'{}');}catch{return plan;}
  const sections=data.scopes?.find(s=>s.id===(action.scope||'personal'))?.sections||[];
  // A follow-up that explicitly supplies a section is not an invitation to ask for
  // optional fields again. Only accept a verified existing section reference.
  const explicitSection=/\\bsection\\b|\\bgroup\\b|قسم|מדור/i.test(message);
  if(explicitSection&&typeof v.sectionId==='string'&&sections.some(s=>s.id===v.sectionId))return plan;
  const section=sections.find(s=>s.id===v.sectionId);
  if(section&&typeof section.name==='string'&&message.normalize('NFKC').toLowerCase().includes(section.name.normalize('NFKC').toLowerCase()))return plan;
  const names=sections.slice(0,6).map(s=>typeof s.name==='string'?s.name.slice(0,60):'').filter(Boolean);
  if(names.length)question+=' '+w.sections+names.join('، ')+(sections.length>6?'…':'')+'.';
 }else if(action.target==='tasks'&&(!Object.hasOwn(v,'due')||!Object.hasOwn(v,'kind')))question=w.study(name);
 else if(action.target==='courses'&&(!Object.hasOwn(v,'notes')||!Object.hasOwn(v,'url')))question=w.course(name);
 if(!question)return plan;
 return {...plan,text:question,actions:[],controls:[],...(name?{clarification:{kind:'creation-details',target:action.target,scope:action.scope||'personal',name}}:{}),tasks:plan.tasks.map(t=>t.actionIndexes.length||t.controlIndexes.length?{...t,outcome:'needs-input',actionIndexes:[],controlIndexes:[],detail:question}:t)};
}
