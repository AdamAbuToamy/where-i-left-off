import {expect,it} from 'vitest';
import {blankAssistantData} from '../src/assistant/actions';
import type {Change} from '../src/assistant/actions';
import {quickFollowUp} from '../src/assistant/quickFollowUp';
const data=blankAssistantData();
data.scopes[0].projects=[{id:'card-1',name:'آيه',dueDate:'2026-10-28',revision:0,rank:0,trashedAt:0}] as typeof data.scopes[0]['projects'];
data.scopes[0].sections=[{id:'section-1',name:'أيوش',revision:0}];
const created:Change[]=[
 {target:'sections',scope:'personal',id:'section-1',before:null,after:{name:'أيوش'}},
 {target:'projects',scope:'personal',id:'card-1',before:null,after:{name:'آيه',dueDate:'2026-10-28',sectionId:'section-1'}}
];
const turns=[{role:'user' as const},{role:'assistant' as const,receipt:{changes:created}}];
it('uses actual confirmed receipt to resolve both in Arabic',()=>{
 const result=quickFollowUp('احذفهما',data,turns);
 expect(result?.actions).toMatchObject([{target:'projects',action:'trash',id:'card-1'},{target:'sections',action:'delete',id:'section-1'}]);
 expect(result?.tasks).toHaveLength(2);
});
it('resolves the latest card and section without guessing names',()=>{
 const result=quickFollowUp('احذف اخر بطاقة اضفتها واخر قسم اضفته',data,turns);
 expect(result?.actions).toHaveLength(2);
 expect(result?.actions.map(a=>a.id)).toEqual(['card-1','section-1']);
});
it('answers last created card only from confirmed creations',()=>{
 expect(quickFollowUp('ايش اخر بطاقة عملتها',data,turns)?.text).toContain('آيه');
 expect(quickFollowUp('ايش اخر بطاقة عملتها',data,[])?.text).not.toContain('Skills and projects');
});
it('refuses ambiguous or nonexistent deletion targets',()=>{
 expect(quickFollowUp('احذفهما',data,[])?.actions).toBeUndefined();
 expect(quickFollowUp('احذفهما',data,[{role:'assistant',receipt:{changes:created.slice(0,1)}}])?.actions).toBeUndefined();
});
