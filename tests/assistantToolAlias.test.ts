import {expect,it} from 'vitest';
import {readWorkspaceToolProposal} from '../push-worker/src/assistantTools.mjs';
it('assigns unique creation aliases when provider leaves id empty',()=>{
 const p={text:'Review',actions:[{target:'tasks',action:'create',id:'',values:{title:'Homework 2',courseId:'course',kind:'assignment'}},{target:'tasks',action:'create',id:'',values:{title:'Homework 3',courseId:'course',kind:'assignment'}}],controls:[],files:[],tasks:[{title:'two tasks',outcome:'proposed',actionIndexes:[0,1],controlIndexes:[],detail:''}]};
 const got=JSON.parse(readWorkspaceToolProposal(JSON.stringify(p)));
 expect(got.actions[0].id).toMatch(/^new-tasks-/);
 expect(got.actions[1].id).not.toBe(got.actions[0].id);
});
it('never rewrites an existing target id or accepts empty update id',()=>{
 const p={text:'Review',actions:[{target:'tasks',action:'update',id:'',values:{title:'Homework 2'}}],controls:[],files:[],tasks:[{title:'edit',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
 expect(()=>readWorkspaceToolProposal(JSON.stringify(p))).toThrow('ai-incomplete-proposal');
});

it('drops provider null and empty enum placeholders on create without discarding real data',()=>{
 const p={text:'Review',actions:[{target:'projects',action:'create',id:'',scope:'personal',values:{name:'Ammar',description:'Hello, it worked',dueDate:'2026-10-25',archivedAt:null,trashedAt:null,kind:'',status:'',rank:0,sectionId:''}}],controls:[],files:[],tasks:[{title:'Create card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
 const a=JSON.parse(readWorkspaceToolProposal(JSON.stringify(p))).actions[0];
 expect(a.values).toMatchObject({name:'Ammar',description:'Hello, it worked',dueDate:'2026-10-25',rank:0,sectionId:''});
 expect(a.values).not.toHaveProperty('archivedAt');
 expect(a.values).not.toHaveProperty('trashedAt');
 expect(a.values).not.toHaveProperty('kind');
 expect(a.values).not.toHaveProperty('status');
});
it('does not drop invalid null on update',()=>{
 const p={text:'Review',actions:[{target:'projects',action:'update',id:'card',scope:'personal',values:{archivedAt:null}}],controls:[],files:[],tasks:[{title:'Update card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]};
 expect(()=>readWorkspaceToolProposal(JSON.stringify(p))).toThrow('ai-incomplete-proposal');
});
