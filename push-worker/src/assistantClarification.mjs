const words={
 ar:{name:'ما الاسم الذي تريده؟',extras:name=>`اسمها «${name}». هل تريد أي تفاصيل إضافية: القسم، الموعد، الملاحظات أو الرابط؟ سأحتفظ بما ذكرته؛ يمكنك قول «بدون إضافات» للمتابعة.`,study:name=>`بالنسبة إلى «${name}»، هل تريد موعدًا أو نوعًا للمهمة أو ملاحظات أو رابطًا؟ يمكنك تخطي الإضافات.`,course:name=>`بالنسبة إلى «${name}»، هل تريد ملاحظات أو رابطًا؟ يمكنك قول «بدون إضافات».`,sections:'الأقسام المتاحة: '},
 en:{name:'What would you like to name it?',extras:name=>`For “${name}”, would you like a section, date, notes or link? I will keep what you already specified. You can say “no extras” to continue.`,study:name=>`For “${name}”, would you like a deadline, task type, notes or link? You can skip extras.`,course:name=>`For “${name}”, would you like notes or a link? You can say “no extras”.`,sections:'Available sections: '},
 he:{name:'איך תרצה לקרוא לזה?',extras:name=>`עבור ״${name}״, להוסיף מדור, תאריך, הערות או קישור? אשמור פרטים שכבר מסרת. אפשר לומר ״בלי תוספות״ כדי להמשיך.`,study:name=>`עבור ״${name}״, להוסיף מועד, סוג משימה, הערות או קישור? אפשר לדלג.`,course:name=>`עבור ״${name}״, להוסיף הערות או קישור? אפשר לומר ״בלי תוספות״.`,sections:'מדורים זמינים: '},
};
/** Missing creation choices are a workflow state, never silently guessed defaults. */
export function clarifyMinimalCreation(plan,language,context){
 if(plan.actions.length!==1||plan.actions[0].action!=='create'||plan.controls.some(c=>c.kind!=='navigate'))return plan;
 const action=plan.actions[0],v=action.values||{},w=words[language]||words.en;
 const identity=action.target==='tasks'?'title':'name',name=v[identity];let question;
 if(action.target!=='lessons'&&(typeof name!=='string'||!name.trim()))question=w.name;
 else if(action.target==='projects'){
  const fields=['sectionId','dueDate','description','projectUrl'];
  if(fields.every(k=>Object.hasOwn(v,k))||fields.filter(k=>v[k]).length>=2)return plan;
  question=w.extras(name);
  let data;try{data=JSON.parse(context||'{}');}catch{return plan;}
  const sections=data.scopes?.find(s=>s.id===(action.scope||'personal'))?.sections||[];
  const names=sections.slice(0,6).map(s=>typeof s.name==='string'?s.name.slice(0,60):'').filter(Boolean);
  if(names.length)question+=' '+w.sections+names.join('، ')+(sections.length>6?'…':'')+'.';
 }else if(action.target==='tasks'&&(!Object.hasOwn(v,'due')||!Object.hasOwn(v,'kind')))question=w.study(name);
 else if(action.target==='courses'&&(!Object.hasOwn(v,'notes')||!Object.hasOwn(v,'url')))question=w.course(name);
 if(!question)return plan;
 return {...plan,text:question,actions:[],controls:[],tasks:plan.tasks.map(t=>t.actionIndexes.length||t.controlIndexes.length?{...t,outcome:'needs-input',actionIndexes:[],controlIndexes:[],detail:question}:t)};
}
