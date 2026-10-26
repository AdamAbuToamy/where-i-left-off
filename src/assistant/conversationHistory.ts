import type { AssistantReply,Change } from './actions';
type Turn={role:'user'|'assistant';text:string;reply?:AssistantReply;changes?:Change[];resolved?:boolean;cancelled?:boolean;superseded?:boolean;undone?:boolean;failed?:boolean;receipt?:{changes:Change[]};controlResults?:{ok:boolean}[]};
/** Retain the complete unfinished dialogue, plus the last resolved reference. Never silently truncate it. */
export function conversationHistory(turns:Turn[]):{role:'user'|'assistant';content:string}[]{
 // Explanations and clarification questions are not transaction boundaries.
 // Keep the dialogue verbatim until explicit Clear; fail visibly if its budget is exceeded.
 const selected=turns.filter(turn=>!turn.failed);
 const result=selected.map(turn=>{
  if(turn.role==='user')return {role:turn.role,content:turn.text};
  const hasDraft=!!(turn.reply?.actions.length||turn.reply?.controls?.length||turn.reply?.clarification||turn.reply?.tasks?.some(t=>t.outcome==='needs-input'));
  const status=turn.undone?'undone':turn.receipt||turn.controlResults?.some(r=>r.ok)?'saved':turn.superseded?'superseded':turn.cancelled||turn.resolved&&turn.reply?'cancelled':hasDraft&&!turn.resolved?'pending':'answered';
  const saved=turn.receipt?.changes.map(c=>{const current=turn.undone?c.before:c.after,item=(current||c.before||c.after) as {name?:string;title?:string}|null;return {target:c.target,scope:c.scope,id:c.id,exists:!!current,name:item?.name||item?.title||''};});
  const proposal=!turn.resolved&&turn.reply?{clarification:turn.reply.clarification,actions:turn.reply.actions,controls:turn.reply.controls||[],questions:turn.reply.tasks?.filter(task=>task.outcome==='needs-input'||task.outcome==='unsupported'),files:turn.reply.files.map(file=>({name:file.name,contentOmitted:true}))}:undefined;
  const content=JSON.stringify({text:turn.text,status,...(saved?{saved}:{}),...(proposal?{proposal}:{})});
  return {role:turn.role,content};
 });
 if(result.length>64||result.some(m=>m.content.length>6000)||result.reduce((n,m)=>n+m.content.length,0)>16000)throw new Error('assistant-conversation-full');
 return result;
}
