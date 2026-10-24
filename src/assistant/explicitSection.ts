import type {AssistantData,AssistantReply} from './actions';

/** Validate explicitly named destinations against existing or proposed section IDs.
 * Untrusted language-model aliases are never allowed to silently substitute a
 * different named section. Ambiguous commands are left to normal clarification.
 */
export function checkExplicitSection(message:string,data:AssistantData,reply:AssistantReply):void {
 const normalized=message.normalize('NFKC');
 const match=normalized.match(/(?:في|داخل|إلى|الى|ضمن|بـ?|ب)\s*قسم\s+([^،,.؟!?\n]+?)(?=\s+(?:بتاريخ|تاريخ|يوم|بموعد|ثم|وبعد|واضف|وأضف|مع|وضع|واحذف)\b|$)/i);
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
 if(!expected)throw new Error('assistant-reference');
 const cards=reply.actions.filter(a=>a.target==='projects'&&['create','update'].includes(a.action));
 if(!cards.length||!cards.some(a=>a.values?.sectionId===expected))throw new Error('assistant-reference');
}
