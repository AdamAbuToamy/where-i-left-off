export function readableHistory(history){
 return history.map(turn=>{
  if(turn.role!=='assistant')return turn;
  let value;try{value=JSON.parse(turn.content);}catch{return turn;}
  if(!value||typeof value.text!=='string'||typeof value.status!=='string')return turn;
  const state=value.status==='pending'?'Unfinished request; nothing saved.':`App state: ${value.status}. Do not repeat resolved operations.`;
  const references=value.saved?` Confirmed record references: ${JSON.stringify(value.saved)}`:'';
  const draft=value.status==='pending'&&value.proposal?.actions?.length?` Earlier draft for review, not saved; it may be incomplete. Its omissions do not override the original user request: ${JSON.stringify(value.proposal.actions)}`:'';
  return {role:'assistant',content:value.text+'\n'+state+references+draft};
 });
}

export function unfinishedUserMessages(history){
 const messages=[];for(const turn of history){if(turn.role==='user'){messages.push(turn.content);continue;}let state;try{state=JSON.parse(turn.content);}catch{continue;}if(['saved','cancelled','undone'].includes(state?.status))messages.length=0;}return messages;
}