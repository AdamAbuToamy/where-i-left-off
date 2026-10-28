import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeToolProposal,nativeWorkspaceInput,runNativeWorkspace} from './src/assistantNativeTools.mjs';
import {workspaceOverview,readWorkspaceContext} from './src/assistantContext.mjs';
import {readConversationChoice} from './src/assistantConversation.mjs';
const context={study:{courses:[],tasks:[],lessons:[]},scopes:[{id:'personal',projects:[{id:'live',name:'Active'},{id:'archive',name:'Archive',archivedAt:10},{id:'trash-1',name:'One',trashedAt:20},{id:'trash-2',name:'Two',trashedAt:30,archivedAt:10}],sections:[]},{id:'group-a',projects:[{id:'group-trash',name:'Group',trashedAt:30}],sections:[]}]};
const call=(name,args={},id=name)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const parse=(calls,c=context)=>JSON.parse(nativeToolProposal(calls,c,'','en'));
test('the model-selected empty Trash function expands the complete personal snapshot, not names supplied by the model',()=>{
 const plan=parse([call('empty_trash')]);assert.deepEqual(plan.actions.map(a=>[a.id,a.action,a.scope,a.values]),[['trash-1','delete','personal',{}],['trash-2','delete','personal',{}]]);
 assert.match(plan.text,/permanent/);assert.match(plan.text,/confirmation/);
});
test('empty Trash is an explicit no-op, not an incomplete proposal or false success',()=>{
 const c=structuredClone(context);c.scopes[0].projects=c.scopes[0].projects.filter(p=>!p.trashedAt);
 const plan=parse([call('empty_trash')],c);assert.deepEqual(plan.actions,[]);assert.match(plan.text,/empty/);assert.match(plan.text,/Nothing was deleted/);
});
test('bulk limits never produce a partial deletion or apply unrelated clauses',()=>{
 const c=structuredClone(context);c.scopes[0].projects=Array.from({length:51},(_,i)=>({id:'trash-'+i,trashedAt:1}));
 const plan=parse([call('create_card',{name:'New'},'create'),call('empty_trash')],c);assert.deepEqual(plan.actions,[]);assert.match(plan.text,/50/);
 c.scopes[0].projects.pop();assert.equal(parse([call('empty_trash')],c).actions.length,50);
 assert.deepEqual(parse([call('empty_trash'),call('create_card',{name:'New'},'create')],c).actions,[]);
});
test('neither the bulk nor individual permanent-delete tool accepts a group scope, arbitrary IDs or extra filters',()=>{
 for(const tool of ['empty_trash','permanently_delete_card'])assert.throws(()=>parse([call(tool,{scope:'group-a',...(tool==='permanently_delete_card'?{id:'group-trash'}:{})})]),/ai-incomplete-proposal/);
 assert.throws(()=>parse([call('empty_trash',{ids:['live']})]),/ai-incomplete-proposal/);
 for(const id of ['live','archive','missing','group-trash'])assert.throws(()=>parse([call('permanently_delete_card',{id})]),/ai-incomplete-proposal/);
 assert.equal(parse([call('permanently_delete_card',{id:'trash-1'})]).actions[0].id,'trash-1');
});
test('Trash state reads filter before name search and pagination and expose lifecycle state in catalogs',()=>{
 const source=JSON.stringify(context),overview=JSON.parse(workspaceOverview(source));
 assert.equal(overview.scopes[0].trashCount,2);assert.equal(overview.scopes[0].archiveCount,1);assert.equal(overview.scopes[0].projectCatalog.items.find(p=>p.id==='trash-1').trashedAt,20);
 const read=(cardState,extra={})=>readWorkspaceContext(source,{requests:[{target:'projects',view:'catalog',cardState,...extra}]}).results[0];
 assert.deepEqual(read('trash').items.map(p=>p.id),['trash-1','trash-2']);assert.deepEqual(read('active').items.map(p=>p.id),['live']);assert.deepEqual(read('archive').items.map(p=>p.id),['archive']);
 assert.equal(read('trash',{query:'Two'}).items[0].id,'trash-2');assert.equal(read('trash',{offset:1,limit:1}).items[0].id,'trash-2');
 assert.throws(()=>read('trash',{scope:'foreign'}),/ai-incomplete-proposal/);
 assert.throws(()=>readWorkspaceContext(source,{requests:[{target:'courses',view:'catalog',cardState:'trash'}]}),/ai-incomplete-proposal/);
 assert.throws(()=>read('deleted'),/ai-incomplete-proposal/);
});
test('scope injection never widens personal-only tool schemas when group memberships exist',()=>{
 const input=nativeWorkspaceInput({language:'en',message:'Empty my trash',context:JSON.stringify(context)},[]);
 for(const name of ['empty_trash','permanently_delete_card'])assert.deepEqual(input.tools.find(t=>t.function.name===name).function.parameters.properties.scope.enum,['personal']);
 const route=readConversationChoice({message:{tool_calls:[call('request_workspace',{requirements:[],functions:['empty_trash']})]}});
 assert.deepEqual(route.conversation.functions,['empty_trash']);
});
test('native tool routing reads real Trash and builds the proposal through the same adapter for English and Arabic requests',async()=>{
 for(const message of ['remove everything in the trash','احذف كل شيء في سلة المهملات حذف نهاءي']){
  let count=0;
  const result=await runNativeWorkspace({message,language:'ar',context:JSON.stringify(context),functions:['empty_trash']},[],async input=>{
   assert.ok(input.tools.some(t=>t.function.name==='empty_trash'));
   if(++count===1)return {message:{tool_calls:[call('read_workspace',{requests:[{target:'projects',view:'catalog',cardState:'trash'}]})]}};
   const read=JSON.parse(input.messages.at(-1).content);assert.equal(read.results[0].total,2);return {message:{tool_calls:[call('empty_trash')]}};
  });assert.equal(JSON.parse(result).actions.length,2);assert.equal(count,2);
 }
});
