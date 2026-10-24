import type { AssistantReply,Change } from './actions';
type Turn={role:'user'|'assistant';text:string;reply?:AssistantReply;changes?:Change[];resolved?:boolean;undone?:boolean;receipt?:{changes:Change[]};controlResults?:{ok:boolean}[]};
/** Retain the complete unfinished dialogue, plus the last resolved reference. Never silently truncate it. */
export function conversationHistory(turns:Turn[]):{role:'user'|'assistant';content:string}[]{
 let boundary=-1;
 for(let i=0;i<turns.length;i++){
  const turn=turns[i];
  if(turn.role==='assistant'&&(turn.resolved||(!turn.reply?.tasks?.some(t=>t.outcome==='needs-input')&&!turn.changes?.length&&!turn.reply?.controls?.length)))boundary=i;
 }
 const selected=turns.slice(Math.max(0,boundary-1));
 const result=selected.map(turn=>{
  if(turn.role==='user')return {role:turn.role,content:turn.text};
  const status=turn.undone?'undone':turn.resolved?(turn.receipt||turn.controlResults?.some(r=>r.ok)?'saved':'cancelled'):'pending';
  const saved=turn.receipt?.changes.map(c=>{const item=(c.after||c.before) as {name?:string;title?:string}|null;return {target:c.target,scope:c.scope,id:c.id,exists:!!c.after,name:item?.name||item?.title||''};});
  const proposal=!turn.resolved&&turn.reply?{clarification:turn.reply.clarification,actions:turn.reply.actions,controls:turn.reply.controls||[],questions:turn.reply.tasks?.filter(task=>task.outcome==='needs-input'||task.outcome==='unsupported'),files:turn.reply.files.map(file=>({name:file.name,contentOmitted:true}))}:undefined;
  const content=JSON.stringify({text:turn.text,status,...(saved?{saved}:{}),...(proposal?{proposal}:{})});
  return {role:turn.role,content};
 });
 if(result.length>16||result.some(m=>m.content.length>6000)||result.reduce((n,m)=>n+m.content.length,0)>16000)throw new Error('assistant-conversation-full');
 return result;
}
