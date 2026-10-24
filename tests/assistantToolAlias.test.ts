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
