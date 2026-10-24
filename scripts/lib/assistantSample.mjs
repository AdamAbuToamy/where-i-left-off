function features(c){
 const prefix=c.language+':',out=new Set([prefix+'language']);
 if(c.actions.length>1)out.add(prefix+'multiple-actions');
 if(c.actions.length>=10)out.add(prefix+'large-batch');
 for(const a of c.actions){out.add(prefix+a.target+':'+a.action);for(const field of Object.keys(a.values||{}))out.add(prefix+a.target+':'+a.action+':'+field);}
 for(const a of c.controls){out.add(prefix+'control:'+a.kind);for(const field of Object.keys(a.values||{}))out.add(prefix+'control:'+a.kind+':'+field);}
 for(const intent of c.intents||[])if(intent?.outcome)out.add(prefix+'outcome:'+intent.outcome);
 return out;
}
/** Stable broad sample; prioritizes the reported compound regressions, then uncovered operations/fields/languages. */
export function assistantSample(cases,count){
 if(!Number.isInteger(count)||count<1||count>cases.length)throw new Error('invalid-sample-size');
 const selected=[],seen=new Set(),covered=new Set(),tokens=new Map(cases.map(c=>[c.id,features(c)]));
 const add=c=>{if(selected.length>=count||seen.has(c.id))return;selected.push(c);seen.add(c.id);for(const token of tokens.get(c.id))covered.add(token);};
 for(const prefix of ['compound-card-','new-course-lesson-','ten-cards-'])for(const c of cases.filter(c=>c.id.startsWith(prefix)))add(c);
 while(selected.length<count){
  let best,score=-1;
  for(const c of cases){if(seen.has(c.id))continue;const n=[...tokens.get(c.id)].filter(t=>!covered.has(t)).length;if(n>score){best=c;score=n;}}
  add(best);
 }
 return selected;
}
