import type {AssistantData,AssistantReply,Change,Action} from './actions';
type Recent={role:'user'|'assistant';receipt?:{changes:Change[]};failed?:boolean;undone?:boolean};
const create=(change:Change)=>!change.before&&!!change.after;
const nameOf=(c:Change)=>String(((c.after||c.before) as {name?:string}|null)?.name||'');
function reply(text:string,actions:Action[]):AssistantReply {
 return {text,actions,controls:[],files:[],tasks:actions.map((a,i)=>({title:a.target==='projects'?'حذف البطاقة':'حذف القسم',outcome:'proposed' as const,actionIndexes:[i],controlIndexes:[],detail:''}))};
}
/** Use verified write receipts as references, never guessed item names.
 * The model handles free-form language; this is a narrow deterministic safety net
 * for high-impact follow-ups and factual questions about this session.
 */
export function quickFollowUp(message:string,data:AssistantData,turns:Recent[]):AssistantReply|null {
 const q=message.trim().normalize('NFKC').replace(/[.!؟]+$/,'').trim();
 const saved=turns.filter(t=>t.role==='assistant'&&!t.failed&&!t.undone&&t.receipt?.changes?.length).flatMap(t=>t.receipt!.changes).filter(create);
 const personal=data.scopes.find(s=>s.id==='personal');
 const lastCard=[...saved].reverse().find(c=>c.target==='projects'&&c.scope==='personal'&&personal?.projects.some(p=>p.id===c.id));
 const lastSection=[...saved].reverse().find(c=>c.target==='sections'&&c.scope==='personal'&&personal?.sections.some(s=>s.id===c.id));
 if(/^(?:ايش|ما|ما هي|شو|ما اسم)\s+(?:آخر|اخر)\s+بطاقة\s+(?:عملتها|أضفتها|اضفتها|أنشأتها|انشأتها)(?:\s*\?)?$/i.test(q)){
  const card=personal?.projects.find(p=>p.id===lastCard?.id);
  return reply(card?`آخر بطاقة أضفتها في هذه المحادثة هي «${card.name}»${card.dueDate?`، بتاريخ ${card.dueDate}`:''}.`:'لا أملك سجل إنشاء مؤكدا يحدد آخر بطاقة أضفتها في هذه المحادثة. لن أخمّن من ترتيب البطاقات.',[]);
 }
 const singular=/^(?:احذفها|إحذفها|امسحها|احذف البطاقة|delete it|delete the card|מחק אותה)$/i.test(q);
 const both=/^(?:احذفهما|امسحهما|احذف الاثنين|احذف الاثنين معا|delete both|delete them both|מחק את שניהם)$/i.test(q);
 const latestPair=/^(?:احذف|امسح)\s+(?:آخر|اخر)\s+بطاقة\s+(?:أضفتها|اضفتها|عملتها|أنشأتها|انشأتها)\s+و(?:آخر|اخر)\s+قسم\s+(?:أضفته|اضفته|عملته|أنشأته|انشأته)$/i.test(q);
 if(!singular&&!both&&!latestPair)return null;
 if(singular){
  const latestReceipt=[...turns].reverse().find(t=>t.role==='assistant'&&t.receipt?.changes?.length&&!t.undone)?.receipt;
  const cards=latestReceipt?.changes.filter(c=>c.target==='projects'&&c.scope==='personal'&&create(c))||[];
  if(cards.length!==1)return null;
  const card=personal?.projects.find(p=>p.id===cards[0].id);
  if(!card||card.trashedAt)return null;
  return reply('سأنقل البطاقة إلى سلة المهملات. راجع التغيير قبل تطبيقه.',[{target:'projects',action:'trash',scope:'personal',id:card.id,values:{}}]);
 }
 let cardChange:Change|undefined,sectionChange:Change|undefined;
 if(both){
  const receipt=[...turns].reverse().find(t=>t.role==='assistant'&&t.receipt?.changes?.length&&!t.undone)?.receipt;
  const created=receipt?.changes.filter(c=>create(c))||[];
  if(created.length!==2||created.some(c=>c.scope!=='personal'||!['projects','sections'].includes(c.target)))return null;
  cardChange=created.find(c=>c.target==='projects');
  sectionChange=created.find(c=>c.target==='sections');
 }else{
  cardChange=lastCard;
  sectionChange=lastSection;
 }
 if(!cardChange||!sectionChange)return null;
 const card=personal?.projects.find(p=>p.id===cardChange.id);
 const section=personal?.sections.find(s=>s.id===sectionChange.id);
 if(!card||card.trashedAt||!section)return null;
 return reply('سأنقل البطاقة إلى السلة وأحذف القسم. البطاقات الأخرى في القسم لن تُحذف. راجع التغييرات قبل تطبيقها.',[
  {target:'projects',action:'trash',scope:'personal',id:card.id,values:{}},
  {target:'sections',action:'delete',scope:'personal',id:section.id,values:{}}
 ]);
}
