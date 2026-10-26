import {expect,it} from 'vitest';
import {parseLocalToolCall} from '../src/assistant/localProtocol';
const call={name:'read_workspace',arguments:{requests:[{target:'projects',view:'catalog'}]}};
it('reads JSON after the Qwen reasoning envelope observed during real local inference',()=>{
 expect(parseLocalToolCall('<think>\n\n</think>\n\n'+JSON.stringify(call))).toEqual(call);
 expect(parseLocalToolCall('<think>Read matching records first.</think>\n```json\n'+JSON.stringify(call)+'\n```')).toEqual(call);
});
it('never extracts commands from prose, incomplete reasoning, multiple calls or unsupported tools',()=>{
 for(const text of ['I suggest '+JSON.stringify(call),'<think>'+JSON.stringify(call),JSON.stringify([call]),JSON.stringify(call)+JSON.stringify(call),JSON.stringify({name:'execute_code',arguments:{}}),JSON.stringify({...call,arguments:null})])expect(()=>parseLocalToolCall(text)).toThrow('ai-incomplete-proposal');
});
it('builds review references in code without asking the model to produce indexes',()=>{
 const parsed=parseLocalToolCall(JSON.stringify({text:'Review changes',actions:[{target:'sections',action:'create',id:'new-s',values:{name:'Work'}}],controls:[{kind:'sleep',values:{enabled:true}}],files:[]}));
 expect(parsed.arguments.tasks).toEqual([
  {title:'Review changes',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},
  {title:'Review changes',outcome:'proposed',actionIndexes:[],controlIndexes:[0],detail:''},
 ]);
 expect(parseLocalToolCall('{"read":[{"target":"courses","view":"catalog"}]}').arguments).toEqual({requests:[{target:'courses',view:'catalog'}]});
});
it('rejects mixed reads and mutations and does not repair arbitrary command fields',()=>{
 expect(()=>parseLocalToolCall('{"read":[],"actions":[]}')).toThrow('ai-incomplete-proposal');
 expect(()=>parseLocalToolCall('{"text":"x","actions":[],"controls":[],"files":[],"execute":"code"}')).toThrow('ai-incomplete-proposal');
});
it('fills unused envelope arrays without guessing actions or accepting malformed arrays',()=>{
 expect(parseLocalToolCall('{"text":"Review","actions":[]}').arguments).toMatchObject({actions:[],controls:[],files:[]});
 expect(()=>parseLocalToolCall('{"text":"Review","actions":null}')).toThrow('ai-incomplete-proposal');
});
it('preloads only real authorized names and IDs, and makes large catalogs explicitly paged',async()=>{
 const {localRecordCatalog}=await import('../src/assistant/localProtocol');
 const {blankAssistantData}=await import('../src/assistant/actions');
 const data=blankAssistantData();
 data.scopes[0].sections=[{id:'s-real',name:'My actual section',revision:0}];
 data.study.courses=[{id:'c-real',name:'Actual course',notes:'PRIVATE LONG BODY',url:'',requires:[],topics:[],x:0,y:0}];
 const catalog=localRecordCatalog(data);
 expect(catalog).toContain('s-real');expect(catalog).toContain('Actual course');expect(catalog).not.toContain('PRIVATE LONG BODY');
 data.scopes[0].sections=Array.from({length:300},(_,i)=>({id:'section-'+i,name:'Long title '+i,revision:0}));
 expect(localRecordCatalog(data)).toContain('pagination');expect(localRecordCatalog(data)).not.toContain('section-0');
});
it('resolves declared reads before accepting a fully specified proposal, without applying it',()=>{
 const reads=[{target:'projects',view:'details',ids:['card'],fields:['name']}];
 const value={text:'Review',read:reads,actions:[{target:'projects',action:'update',id:'card',values:{name:'Robot'}}],controls:[],files:[]};
 const seen:unknown[][]=[];
 const result=parseLocalToolCall(JSON.stringify(value),requests=>{seen.push(requests);});
 expect(seen).toEqual([reads]);expect(result.name).toBe('propose_workspace_actions');expect(result.arguments.actions).toEqual(value.actions);
 expect(()=>parseLocalToolCall(JSON.stringify(value))).toThrow('ai-incomplete-proposal');
 expect(()=>parseLocalToolCall(JSON.stringify(value),()=>{throw new Error('unauthorized read');})).toThrow('ai-incomplete-proposal');
});
it('does not offer profile mutations for a card-only plan or record mutations for a settings-only plan',async()=>{
 const {schemaForLocalPlan}=await import('../src/assistant/localProtocol');
 expect(schemaForLocalPlan(['projects'])).toMatchObject({properties:{actions:{items:{properties:{target:{enum:['projects']}}}},controls:{maxItems:0},files:{maxItems:0}}});
 expect(schemaForLocalPlan(['language'])).toMatchObject({properties:{actions:{maxItems:0},controls:{items:{properties:{kind:{enum:['language']}}}}}});
});
it('allocates fresh creation aliases while preserving references and unrelated existing records',async()=>{
 const {normalizeLocalCreateAliases}=await import('../src/assistant/localProtocol');const {blankAssistantData,parseAssistantReply,planAssistantChanges}=await import('../src/assistant/actions');
 const data=blankAssistantData();data.scopes[0].sections=[{id:'s',name:'Existing',revision:0}];
 const text=JSON.stringify({text:'Review',actions:[{target:'sections',action:'create',scope:'personal',id:'s',values:{name:'New'}},{target:'projects',action:'create',scope:'personal',id:'p',values:{name:'Card',sectionId:'s'}}],controls:[],files:[]});
 const normalized=JSON.parse(normalizeLocalCreateAliases(data,text));expect(normalized.actions[0].id).not.toBe('s');expect(normalized.actions[1].values.sectionId).toBe(normalized.actions[0].id);expect(data.scopes[0].sections[0].name).toBe('Existing');
 expect(planAssistantChanges(data,parseAssistantReply(JSON.stringify(normalized)).actions)).toHaveLength(2);
});