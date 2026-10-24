import type {AssistantData,AssistantReply} from './actions';

/** Validate explicitly named destinations against existing or proposed section IDs.
 * Untrusted language-model aliases are never allowed to silently substitute a
 * different named section. Ambiguous commands are left to normal clarification.
 */
export function checkExplicitSection(message:string,data:AssistantData,reply:AssistantReply):void {
 const normalized=message.normalize('NFKC');
 const match=normalized.match(/(?:في|داخل|إلى|الى|ضمن|بـ?|لـ?)\s*قسم\s+([^،,.؟!?\n]+?)(?=\s+(?:بتاريخ|تاريخ|يوم|بموعد|ثم|وبعد|واضف|وأضف|مع|وضع|واحذف)|$)/i);
 if(!match)return;
 const requested=match[1].trim().replace(/[«»"']/g,'').trim().toLocaleLowerCase();
 if(!requested||requested.length>60)return;
 const scope=data.scopes.find(s=>s.id==='personal');
 if(!scope)return;
 const section=scope.sections.find(s=>s.name.trim().toLocaleLowerCase()===requested);
 const creates=reply.actions.filter(a=>a.target==='sections'&&a.action==='create'&&String(a.values?.name||'').trim().toLocaleLowerCase()===requested);
 const expected=section?.id||creates[0]?.id;
 // If the section is missing, creating it is part of the request. Don't silently
 // attach the card to a different section or ignore its requested destination.
 if(!expected){
  // When the user explicitly names a missing section, a single new personal
  // card may safely be completed with a new section. Do not guess if the
  // model suggested multiple cards, existing-card edits, or section operations.
  const cards=reply.actions.filter(a=>a.target==='projects'&&a.action==='create'&&(a.scope||'personal')==='personal');
  if(cards.length!==1||reply.actions.length!==1)throw new Error('assistant-reference');
  const alias='wilo-section-'+Math.random().toString(36).slice(2,12);
  reply.actions.unshift({target:'sections',action:'create',id:alias,scope:'personal',values:{name:match[1].trim().replace(/[«»"']/g,'')}});
  cards[0].values={...cards[0].values,sectionId:alias};
  for(const task of reply.tasks||[])if(task.actionIndexes.length)task.actionIndexes=[0,...task.actionIndexes.map(i=>i+1)];
  return;
 }
 const cards=reply.actions.filter(a=>a.target==='projects'&&['create','update'].includes(a.action));
 if(!cards.length||!cards.some(a=>a.values?.sectionId===expected))throw new Error('assistant-reference');
}
