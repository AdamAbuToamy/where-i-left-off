import type {AssistantData,AssistantReply,Change} from './actions';
import {comparableRecordName,plainNumericText} from './safeText';

type Recent={
 role:'user'|'assistant';text?:string;receipt?:{changes:Change[]};
 reply?:AssistantReply;resolved?:boolean;failed?:boolean;
};
type Personal=AssistantData['scopes'][number];

const singular=/^(?:احذفها|إحذفها|امسحها|احذف البطاقة|delete it|delete the card|מחק אותה)$/i;
const plural=/^(?:احذفهم|إحذفهم|امسحهم|احذف الاثنين|احذفهما|delete both|delete them|מחק את שניהם)$/i;
const sectionAlso=/^(?:احذف|إحذف|امسح)\s+(?:ال)?قسم\s+(?:أيضا|أيضاً|كمان|كذلك)$/i;
const explicitPair=[
 /^(?:احذف|إحذف|امسح)\s+(?:ال)?قسم\s+(.+?)\s+وبطاقة\s+(.+)$/i,
 /^قسم\s+(.+?)\s+وبطاقة\s+(.+?)\s+(?:احذفهم|إحذفهم|امسحهم|احذفهما)$/i,
];
function missing(message:string):AssistantReply{
 return {text:message,actions:[],controls:[],files:[],tasks:[{title:'تحديد البطاقة والقسم',outcome:'needs-input',actionIndexes:[],controlIndexes:[],detail:message}]};
}
function findOnly<T extends {name:string}>(values:T[],name:string):T|null{
 const found=values.filter(x=>comparableRecordName(x.name)===comparableRecordName(name));
 return found.length===1?found[0]:null;
}
function both(section:Personal['sections'][number],card:Personal['projects'][number]):AssistantReply{
 return {
  text:'سأنقل البطاقة "'+plainNumericText(card.name)+'" إلى سلة المهملات وأحذف القسم "'+plainNumericText(section.name)+'". البطاقات الأخرى داخل القسم ستبقى في حسابك دون قسم. راجع التغييرات قبل تطبيقها.',
  actions:[
   {target:'projects',action:'trash',scope:'personal',id:card.id,values:{}},
   {target:'sections',action:'delete',scope:'personal',id:section.id,values:{}},
  ],
  controls:[],files:[],tasks:[
   {title:'نقل البطاقة إلى السلة',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},
   {title:'حذف القسم',outcome:'proposed',actionIndexes:[1],controlIndexes:[],detail:''},
  ],
 };
}
function namedPair(message:string,personal:Personal):AssistantReply|null{
 const parsed=explicitPair.map(pattern=>message.match(pattern)).find(Boolean);
 if(!parsed)return null;
 const section=findOnly(personal.sections,parsed[1].trim().replace(/^[«"' ]+|[»"' ]+$/g,''));
 if(!section)return missing('لم أجد قسمًا واحدًا واضحًا بالاسم المطلوب. حدّد القسم الصحيح؛ لم أحذف شيئًا.');
 // Resolve a card by BOTH its title and section; never trash a same-name card elsewhere.
 const candidates=personal.projects.filter(p=>p.sectionId===section.id&&comparableRecordName(p.name)===comparableRecordName(parsed[2].trim().replace(/^[«"' ]+|[»"' ]+$/g,'')));
 if(candidates.length!==1||candidates[0].trashedAt)return missing('لم أجد بطاقة نشطة واحدة بهذا الاسم داخل القسم المحدد. راجع الاسم أو القسم؛ لم أحذف شيئًا.');
 return both(section,candidates[0]);
}
function lastCreatedPair(turns:Recent[],personal:Personal):{section:Personal['sections'][number];card:Personal['projects'][number]}|null{
 const savedIndex=turns.findLastIndex(t=>t.role==='assistant'&&t.receipt?.changes?.length&&!t.failed);
 if(savedIndex<0)return null;
 const since=turns.slice(savedIndex+1);
 // Never use an older creation after unrelated requests or too many follow-ups.
 if(since.filter(t=>t.role==='user').length>3||
   since.some(t=>t.role==='user'&&!plural.test((t.text||'').trim())&&!sectionAlso.test((t.text||'').trim())))return null;
 const created=turns[savedIndex].receipt!.changes.filter(c=>!c.before&&c.after&&c.scope==='personal');
 const cards=created.filter(c=>c.target==='projects');
 const sections=created.filter(c=>c.target==='sections');
 if(cards.length!==1||sections.length!==1)return null;
 const card=personal.projects.find(p=>p.id===cards[0].id);
 const section=personal.sections.find(s=>s.id===sections[0].id);
 if(!card||!section||card.sectionId!==section.id||card.trashedAt)return null;
 return {section,card};
}
/** Resolve only unambiguous, user-authorized deletions from current account IDs.
 * Always return a proposal; actual writes require review and an explicit Apply.
 */
export function quickFollowUp(message:string,data:AssistantData,turns:Recent[]):AssistantReply|null{
 const request=message.normalize('NFKC').trim();
 const personal=data.scopes.find(s=>s.id==='personal');
 if(!personal)return null;
 const named=namedPair(request,personal);
 if(named)return named;
 if(plural.test(request)||sectionAlso.test(request)){
  const pair=lastCreatedPair(turns,personal);
  return pair?both(pair.section,pair.card):missing('لم أستطع تحديد البطاقة والقسم معًا من آخر عملية حفظ. اكتب: قسم [الاسم] وبطاقة [الاسم] احذفهم. لم أحذف شيئًا.');
 }
 if(!singular.test(request))return null;
 // Preserve the existing safe single-card behavior.
 const recent=[...turns].reverse().find(t=>t.role==='assistant'&&t.receipt?.changes?.length);
 if(!recent?.receipt)return null;
 const created=recent.receipt.changes.filter(c=>c.target==='projects'&&c.scope==='personal'&&!c.before&&c.after);
 if(created.length!==1)return null;
 const card=personal.projects.find(p=>p.id===created[0].id);
 if(!card||card.trashedAt)return null;
 return {text:'سأنقل البطاقة التي أنشأتها للتو إلى سلة المهملات. راجع التغيير قبل تطبيقه.',actions:[{target:'projects',action:'trash',scope:'personal',id:card.id,values:{}}],controls:[],files:[],tasks:[{title:'نقل البطاقة الأخيرة إلى السلة',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
}
