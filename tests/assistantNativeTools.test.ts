import {expect,it} from 'vitest';
import {nativeToolProposal,zonedDeadline,nativeWorkspaceInput,runNativeWorkspace} from '../push-worker/src/assistantNativeTools.mjs';
import {validateWorkspaceReply} from '../src/assistant/workspaceValidation';
import {acceptanceContext} from './fixtures/assistant/corpus.mjs';
const call=(name:string,args:unknown,id='call')=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
it('serializes checklist item state through code and updates the actual existing card',()=>{
 const context=acceptanceContext(),text=nativeToolProposal([call('update_card',{id:'card',changes:{checklist:[{text:'One',done:false},{text:'Two',done:true}],checkpoint:'Page 12',status:'waiting'}})],context);
 const {changes}=validateWorkspaceReply('',context,text);expect(changes[0].after).toMatchObject({checklist:'[ ] One\n[x] Two',checkpoint:'Page 12',status:'waiting'});
});
it('computes a university local deadline from the account timezone including winter and summer offset',()=>{
 expect(zonedDeadline({date:'2026-11-01',time:'12:00'},'Asia/Jerusalem')).toBe('2026-11-01T10:00:00.000Z');
 expect(zonedDeadline({date:'2026-07-01',time:'12:00'},'Asia/Jerusalem')).toBe('2026-07-01T09:00:00.000Z');
});
it('archive, trash, postpone and done are separate ready functions or typed status values',()=>{
 const context=acceptanceContext();
 const archived=JSON.parse(nativeToolProposal([call('archive_card',{id:'card'})],context));expect(archived.actions[0].values.archivedAt).toBeGreaterThan(0);expect(archived.actions[0].action).toBe('update');
 const trash=JSON.parse(nativeToolProposal([call('trash_card',{id:'card'})],context));expect(trash.actions[0].action).toBe('trash');
});
it('append preserves snapshot notes and new aliases while replacement sets exactly the supplied text',()=>{
 const context=acceptanceContext();const append=JSON.parse(nativeToolProposal([call('update_card',{id:'card',changes:{appendNotes:'New'}})],context));expect(append.actions[0].values.description).toBe('Keep\nNew');
 const replace=JSON.parse(nativeToolProposal([call('update_card',{id:'card',changes:{description:'New'}})],context));expect(replace.actions[0].values.description).toBe('New');
 const batch=nativeToolProposal([call('create_course',{name:'New',alias:'new-course'},'a'),call('update_course',{id:'new-course',changes:{appendNotes:'Note'}},'b')],context);expect(()=>validateWorkspaceReply('',context,batch)).not.toThrow();
});
it('deletion carries no spurious id field inside values and course/class aliases link to generated IDs',()=>{
 const context=acceptanceContext(),deleted=nativeToolProposal([call('delete_task',{id:'task'})],context);expect(()=>validateWorkspaceReply('',context,deleted)).not.toThrow();
 const created=nativeToolProposal([call('create_course',{name:'Physics',alias:'physics'},'a'),call('create_lesson',{courseId:'physics',day:0,start:'00:00',end:'01:00'},'b')],context);const {changes}=validateWorkspaceReply('',context,created);expect(changes[1].after.courseId).toBe(changes[0].id);
});
it('rejects undeclared arguments, invalid checklist states, missing IDs and mixed arbitrary calls',()=>{
 const context=acceptanceContext();for(const c of [call('update_card',{id:'card',changes:{eval:'bad'}}),call('update_card',{id:'card',changes:{checklist:[{text:'One',done:'true'}]}}),call('update_card',{changes:{name:'New'}}),call('execute_code',{code:'bad'})])expect(()=>nativeToolProposal([c],context)).toThrow();
});
it('tool scopes come only from the account and no free-form action plan is exposed',()=>{
 const input=nativeWorkspaceInput({message:'Change a card',language:'en',context:JSON.stringify(acceptanceContext())},[]);expect(input.tools.some(t=>t.function.name==='propose_workspace_actions')).toBe(false);expect(input.tools.find(t=>t.function.name==='update_card')?.function.parameters.properties.scope.enum).toEqual(['personal']);
});
it('prepares a requested text file without silently adding any record or setting changes',()=>{
 const result=JSON.parse(nativeToolProposal([call('prepare_file',{name:'cards.txt',content:'عمار'})],acceptanceContext()));expect(result.files).toEqual([{name:'cards.txt',content:'عمار'}]);expect(result.actions).toEqual([]);expect(result.controls).toEqual([]);
});
it('rejects impossible dates instead of normalizing them into another calendar day',()=>{
 expect(()=>zonedDeadline({date:'2026-02-31',time:'12:00'},'Asia/Jerusalem')).toThrow('assistant-task-date');
});
it('asks for an unavailable required URL without returning a partial card mutation',async()=>{
 const context=acceptanceContext();let turns=0;const text=await runNativeWorkspace({message:'Create a card with a video URL',language:'en',context:JSON.stringify(context),requirements:[{target:'projects',fields:['name','projectUrl']}]},[],async()=>{turns++;return {message:{tool_calls:[call('create_card',{name:'Ammar'})]}};});
 const reply=JSON.parse(text);expect(turns).toBe(1);expect(reply.actions).toEqual([]);expect(reply.tasks[0].outcome).toBe('needs-input');expect(reply.text).toContain('direct URL');
});
it('repairs a dropped URL that the user already supplied instead of asking them to repeat it',async()=>{
 const context=acceptanceContext();let turns=0;const text=await runNativeWorkspace({message:'Create a card with https://example.test/video',language:'en',context:JSON.stringify(context),requirements:[{target:'projects',fields:['name','projectUrl']}]},[],async()=>({message:{tool_calls:[call('create_card',{name:'Ammar',...(++turns===2?{projectUrl:'https://example.test/video'}:{})})]}}));
 expect(turns).toBe(2);expect(JSON.parse(text).actions[0].values.projectUrl).toBe('https://example.test/video');
});
it('prepares PDF source for the browser renderer without database mutations',()=>{
 const reply=JSON.parse(nativeToolProposal([call('prepare_file',{name:'courses.pdf',content:'# My courses'})],acceptanceContext()));expect(reply.files).toEqual([{name:'courses.pdf',content:'# My courses'}]);expect(reply.actions).toEqual([]);
});it('explains exhausted read capacity without a generic error or partial changes',async()=>{
 let turns=0;const text=await runNativeWorkspace({message:'Summarize every course',language:'en',context:JSON.stringify(acceptanceContext())},[],async()=>{turns++;return {message:{tool_calls:[call('read_workspace',{requests:[{target:'courses',view:'catalog'}]})]}};});
 expect(turns).toBe(9);const reply=JSON.parse(text);expect(reply.actions).toEqual([]);expect(reply.controls).toEqual([]);expect(reply.text).toContain('could not read all');
});it('repairs a compound proposal that dropped its explicitly requested PDF',async()=>{
 let turns=0;const text=await runNativeWorkspace({message:'Create a card and give me a PDF',language:'en',context:JSON.stringify(acceptanceContext()),outputFormat:'pdf'},[],async input=>{
  turns++;if(turns===2)expect(JSON.stringify(input.messages.at(-1))).toContain('files.pdf');
  return {message:{tool_calls:[call('create_card',{name:'Ammar'}),...(turns===2?[call('prepare_file',{name:'report.pdf',content:'# Proposed changes\nCreate Ammar'},'pdf-call')]:[])]}};
 });
 const reply=JSON.parse(text);expect(turns).toBe(2);expect(reply.actions).toHaveLength(1);expect(reply.files[0].name).toBe('report.pdf');
});it('sends only model-selected function schemas and retains PDF and authorized reads',()=>{
 const context=JSON.stringify(acceptanceContext()),base={message:'Create two cards and a section then PDF',language:'en',context};
 const all=nativeWorkspaceInput(base,[]),selected=nativeWorkspaceInput({...base,functions:['create_card','create_section'],outputFormat:'pdf'},[]);
 expect(selected.tools.map(t=>t.function.name)).toEqual(['create_card','create_section','prepare_file','read_workspace']);
 expect(JSON.stringify(selected).length).toBeLessThan(JSON.stringify(all).length*0.6);
});