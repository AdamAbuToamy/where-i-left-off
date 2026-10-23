import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readIntents,verifyIntentCoverage,INTENT_FORMAT} from './src/assistantIntents.mjs';
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
 const p=proposal();p.tasks.pop();assert.equal(verifyIntentCoverage(p,intents),false);
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
test('ten requested edits cannot be reduced to nine tasks',()=>{
 const list=Array.from({length:10},(_,i)=>({...intents[0],title:`Card ${i}`,subject:`card-${i}`,requirements:[req('name',`Card ${i}`)]}));
 const p={text:'Review',actions:list.map((_,i)=>({target:'projects',action:'create',id:`card-${i}`,values:{name:`Card ${i}`}})),controls:[],files:[],tasks:list.map((i,index)=>({title:i.title,outcome:'proposed',actionIndexes:[index],controlIndexes:[],detail:''}))};
 assert.equal(verifyIntentCoverage(p,list),true);p.tasks.pop();assert.equal(verifyIntentCoverage(p,list),false);
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
