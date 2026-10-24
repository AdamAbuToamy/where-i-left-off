import type {AssistantData,AssistantReply,Change} from './actions';
type Recent={role:'user'|'assistant';receipt?:{changes:Change[]};failed?:boolean};
/** Resolve a very narrow anaphoric deletion against a confirmed save receipt.
 * Never guess when several cards might be referred to or a later user instruction
 * has intervened. The app still displays a proposal requiring Apply.
 */
export function quickFollowUp(message:string,data:AssistantData,turns:Recent[]):AssistantReply|null {
 if(!/^(?:احذفها|إحذفها|امسحها|احذف البطاقة|delete it|delete the card|מחק אותה)$/i.test(message.trim()))return null;
 const recent=[...turns].reverse().find(t=>t.role==='assistant'&&t.receipt?.changes?.length);
 if(!recent?.receipt)return null;
 const created=recent.receipt.changes.filter(c=>c.target==='projects'&&c.scope==='personal'&&!c.before&&c.after);
 if(created.length!==1)return null;
 const card=data.scopes.find(s=>s.id==='personal')?.projects.find(p=>p.id===created[0].id);
 if(!card||card.trashedAt)return null;
 return {text:'سأنقل البطاقة التي أنشأتها للتو إلى سلة المهملات. راجع التغيير قبل تطبيقه.',actions:[{target:'projects',action:'trash',scope:'personal',id:card.id,values:{}}],controls:[],files:[],tasks:[{title:'نقل البطاقة الأخيرة إلى السلة',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
}
