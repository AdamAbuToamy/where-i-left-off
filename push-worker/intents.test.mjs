import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readIntents,verifyIntentCoverage,reconcileIntentProposal,INTENT_FORMAT} from './src/assistantIntents.mjs';
import {assistant,assistantResponseText,ASSISTANT_MODEL} from './src/assistant.mjs';
import {database} from './test-db.mjs';
const message='أضف بطاقة باسم عمار وضعها في الاسبوع يوم 25 الشهر\nأضف للملاحظات: مرحبا';
const req=(field,value,operation='create',match='equals')=>({target:'projects',operation,field,expectedJson:JSON.stringify(value),match});
const intents=[
 {title:'إضافة بطاقة عمار',source:'أضف بطاقة باسم عمار',subject:'card-ammar',outcome:'proposed',requirements:[req('name','عمار')]},
 {title:'موعد البطاقة 25 أكتوبر',source:'وضعها في الاسبوع يوم 25 الشهر',subject:'card-ammar',outcome:'proposed',requirements:[req('dueDate','2026-10-25')]},
 {title:'إضافة ملاحظة مرحبا',source:'أضف للملاحظات: مرحبا',subject:'card-ammar',outcome:'proposed',requirements:[req('description','مرحبا','create','contains')]},
];
const proposal=()=>({text:'راجع التغييرات',actions:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'عمار',dueDate:'2026-10-25',description:'مرحبا'}}],controls:[],files:[],tasks:intents.map(i=>({title:i.title,outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}))});
test('three independent user effects remain three tasks even in one document write',()=>{
 assert.equal(readIntents(JSON.stringify({intents}),message).length,3);
 assert.equal(verifyIntentCoverage(proposal(),intents),true);
 for(const field of ['name','dueDate','description']){const p=proposal();delete p.actions[0].values[field];assert.equal(verifyIntentCoverage(p,intents),false,field);}
 const p=proposal();p.tasks.pop();assert.equal(reconcileIntentProposal(p,intents).proposal.tasks.length,3);
});
test('navigation and confident text cannot substitute for requested persisted fields',()=>{
 const p=proposal();delete p.actions[0].values.dueDate;p.controls=[{kind:'navigate',values:{page:'personal',view:'week',weekOf:'2026-10-25'}}];p.tasks[1].controlIndexes=[0];p.text='Everything saved';
 assert.equal(verifyIntentCoverage(p,intents),false);
 p.tasks[1].outcome='unsupported';assert.equal(verifyIntentCoverage(p,intents),false);
});
test('a note cannot be fulfilled on an unrelated new card',()=>{
 const p=proposal();delete p.actions[0].values.description;p.actions.push({target:'projects',action:'create',id:'wrong-note-card',scope:'personal',values:{name:'مرحبا',description:'مرحبا'}});p.tasks[2].actionIndexes=[1];
 assert.equal(verifyIntentCoverage(p,intents),false);
});
test('inventory sources must occur in the actual user request and fields must be declared',()=>{
 assert.throws(()=>readIntents(JSON.stringify({intents:[{...intents[0],source:'delete everything'}]}),message),/ai-intent-format/);
 assert.throws(()=>readIntents(JSON.stringify({intents:[{...intents[0],requirements:[req('__proto__','bad')]}]}),message),/ai-intent-format/);
});
test('ten requested edits rebuild ten tasks even if the model reports nine',()=>{
 const list=Array.from({length:10},(_,i)=>({...intents[0],title:`Card ${i}`,subject:`card-${i}`,requirements:[req('name',`Card ${i}`)]}));
 const p={text:'Review',actions:list.map((_,i)=>({target:'projects',action:'create',id:`card-${i}`,values:{name:`Card ${i}`}})),controls:[],files:[],tasks:list.map((i,index)=>({title:i.title,outcome:'proposed',actionIndexes:[index],controlIndexes:[],detail:''}))};
 assert.equal(verifyIntentCoverage(p,list),true);p.tasks.pop();assert.equal(reconcileIntentProposal(p,list).proposal.tasks.length,10);
});
test('provider text extraction supports messages and excludes reasoning from Responses output',()=>{
 assert.equal(assistantResponseText({output:[{type:'reasoning',content:[{type:'text',text:'private thought'}]},{type:'message',content:[{type:'output_text',text:'Final JSON'}]}]}),'Final JSON');
 assert.equal(assistantResponseText({choices:[{message:{content:[{type:'text',text:'OK'}]}}]}),'OK');
});
test('worker inventories before execution, repairs an omitted note once, and never writes app data',async()=>{
 const calls=[],env={DB:database(),ASSISTANT_FREE_ONLY:'true',AI:{run:async(model,input)=>{
  calls.push({model,input});if(input.response_format===INTENT_FORMAT)return {response:{intents}};
  const p=proposal();if(calls.length===2)delete p.actions[0].values.description;return {response:p};
 }}};
 env.DB.sqlite.prepare("INSERT INTO accounts(uid,prefs) VALUES('alice','{}')").run();
 const result=await assistant(env,'alice',{mode:'workspace',message,language:'ar',context:'{"localDate":"2026-10-23"}'});
 assert.equal(calls.length,3);assert.equal(calls[0].model,ASSISTANT_MODEL);assert.equal(JSON.parse(result.text).tasks.length,3);assert.equal(JSON.parse(result.text).actions[0].values.description,'مرحبا');
 assert.ok(!calls[0].input.messages.some(m=>m.content.includes('INDEPENDENT REQUEST INVENTORY')));
 assert.match(calls[1].input.messages.at(-1).content,/INDEPENDENT REQUEST INVENTORY/);
});
test('worker refuses repeated omissions rather than returning a partial success',async()=>{
 let calls=0;const env={DB:database(),ASSISTANT_FREE_ONLY:'true',AI:{run:async(model,input)=>{
  calls++;if(input.response_format===INTENT_FORMAT)return {response:{intents}};
  const p=proposal();delete p.actions[0].values.description;return {response:p};
 }}};
 env.DB.sqlite.prepare("INSERT INTO accounts(uid,prefs) VALUES('alice','{}')").run();
 await assert.rejects(()=>assistant(env,'alice',{mode:'workspace',message,language:'ar'}),/ai-incomplete-proposal/);assert.equal(calls,3);
});

test('reconstructs request tasks from valid edits despite merged, shuffled or missing model task metadata',()=>{
 for(const tasks of [[],proposal().tasks.slice(0,1),proposal().tasks.reverse()]){
  const checked=reconcileIntentProposal({...proposal(),tasks},intents);
  assert.deepEqual(checked.issues,[]);assert.equal(checked.proposal.tasks.length,3);
 }
});
test('create followed by alias update is equivalent to one complete create',()=>{
 const p=proposal();delete p.actions[0].values.description;p.actions.push({target:'projects',action:'update',scope:'personal',id:'new-card',values:{description:'مرحبا'}});
 assert.deepEqual(reconcileIntentProposal(p,intents).issues,[]);
});
test('equivalent ISO instants do not fail because one response uses UTC',()=>{
 const i={title:'Date',source:'date',subject:'task',recordId:'task',outcome:'proposed',requirements:[{target:'tasks',operation:'update',field:'due',expectedJson:'"2026-11-01T12:00:00+02:00"',match:'equals'}]};
 const p={text:'Review',actions:[{target:'tasks',action:'update',id:'task',values:{due:'2026-11-01T10:00:00.000Z'}}],controls:[],files:[],tasks:[]};
 assert.deepEqual(reconcileIntentProposal(p,[i],{study:{tasks:[{id:'task',due:''}]}}).issues,[]);
});
test('append requirements preserve existing notes instead of overwriting them',()=>{
 const i={...intents[2],recordId:'card',subject:'card',requirements:[{...intents[2].requirements[0],operation:'update'}]};
 const context={scopes:[{id:'personal',projects:[{id:'card',description:'Keep'}]}]};
 const p={text:'Review',actions:[{target:'projects',action:'update',scope:'personal',id:'card',values:{description:'مرحبا'}}],controls:[],files:[],tasks:[]};
 assert.notEqual(reconcileIntentProposal(p,[i],context).issues.length,0);
 p.actions[0].values.description='Keep\nمرحبا';assert.deepEqual(reconcileIntentProposal(p,[i],context).issues,[]);
});
test('two equally matching new cards require disambiguation rather than arbitrary selection',()=>{
 const p=proposal();p.actions.push({...p.actions[0],id:'another-card'});
 assert.ok(reconcileIntentProposal(p,intents).issues.some(i=>i.reason==='ambiguous-subject'));
});
test('an additional unrelated write is rejected even if every requested field exists',()=>{
 const p=proposal();p.actions.push({target:'courses',action:'create',id:'unrequested',values:{name:'Unexpected'}});
 assert.ok(reconcileIntentProposal(p,intents).issues.some(i=>i.reason==='unassigned-action'));
});
test('missing requested downloadable file is rejected while normal answers have no writes',()=>{
 const i={title:'File',source:'file',subject:'file',outcome:'answer',requirements:[{target:'files',operation:'file',field:'',expectedJson:'null',match:'equals'}]};
 const p={text:'Summary',actions:[],controls:[],files:[],tasks:[]};
 assert.equal(reconcileIntentProposal(p,[i]).issues[0].reason,'missing-file');p.files.push({name:'summary.txt',content:'Summary'});assert.deepEqual(reconcileIntentProposal(p,[i]).issues,[]);
});
test('handoff navigation remains unsupported rather than falsely counted as account completion',()=>{
 const i={title:'Change password',source:'password',subject:'account',outcome:'unsupported',requirements:[]};
 const p={text:'Open settings and use the password form.',actions:[],controls:[{kind:'navigate',values:{page:'settings'}}],files:[],tasks:[]};
 const checked=reconcileIntentProposal(p,[i]);assert.deepEqual(checked.issues,[]);assert.equal(checked.proposal.tasks[0].outcome,'unsupported');assert.deepEqual(checked.proposal.tasks[0].controlIndexes,[0]);
});
test('new course references resolve inventory subject keys to executor aliases',()=>{
 const req=(target,operation,field,value)=>({target,operation,field,expectedJson:JSON.stringify(value),match:'equals'});
 const i=[{title:'Course',subject:'new-subject',recordId:'',outcome:'proposed',requirements:[req('courses','create','name','Physics')]},{title:'Lesson',subject:'class',recordId:'',outcome:'proposed',requirements:[req('lessons','create','courseId','new-subject'),req('lessons','create','start','09:00')]}];
 const p={text:'Review',actions:[{target:'courses',action:'create',id:'executor-course',values:{name:'Physics'}},{target:'lessons',action:'create',id:'executor-class',values:{courseId:'executor-course',start:'09:00'}}],controls:[],files:[],tasks:[]};
 assert.deepEqual(reconcileIntentProposal(p,i).issues,[]);
 p.actions[1].values.courseId='wrong-course';assert.ok(reconcileIntentProposal(p,i).issues.length>0);
});
test('prerequisite set order is irrelevant to the requested graph',()=>{
 const i={title:'Link',subject:'c',recordId:'c',outcome:'proposed',requirements:[{target:'courses',operation:'update',field:'requires',expectedJson:'["a","b"]',match:'equals'}]};
 const p={text:'Review',actions:[{target:'courses',action:'update',id:'c',values:{requires:['b','a']}}],controls:[],files:[],tasks:[]};
 assert.deepEqual(reconcileIntentProposal(p,[i],{study:{courses:[{id:'c',requires:[]},{id:'a'},{id:'b'}]}}).issues,[]);
});
test('safe diagnostics never include raw values, names or provider payloads',async()=>{
 const {safeCoverageIssues}=await import('./src/assistantIntents.mjs');
 assert.deepEqual(safeCoverageIssues([{task:1,reason:'missing-effect',target:'projects',field:'description',value:'secret'},{task:2,reason:'missing-effect',target:'private raw value',field:'token'}]),[{task:1,reason:'missing-effect',target:'projects',field:'description'},{task:2,reason:'missing-effect',target:'',field:''}]);
});
test('trash intent requires the final state to remain in trash',()=>{
 const i={title:'Trash',subject:'card',recordId:'card',outcome:'proposed',requirements:[{target:'projects',operation:'trash',field:'',expectedJson:'null',match:'equals'}]};
 const p={text:'Review',actions:[{target:'projects',action:'trash',id:'card',values:{}},{target:'projects',action:'update',id:'card',values:{trashedAt:0}}],controls:[],files:[],tasks:[]};
 assert.ok(reconcileIntentProposal(p,[i],{scopes:[{id:'personal',projects:[{id:'card'}]}]}).issues.length);
});
test('incorrect display metadata cannot crash an otherwise valid effect reconciliation',()=>{
 const p={text:'An answer',actions:[],controls:[],files:[],tasks:{not:'an array'}};
 const i={title:'Question',subject:'question',outcome:'answer',requirements:[]};
 const checked=reconcileIntentProposal(p,[i]);assert.deepEqual(checked.issues,[]);assert.equal(checked.proposal.tasks[0].detail,'An answer');
});
