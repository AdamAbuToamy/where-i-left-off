import {it,expect} from 'vitest';
import {blankAssistantData,planAssistantChanges} from '../src/assistant/actions';
import {quickFollowUp} from '../src/assistant/quickFollowUp';
import {checkExplicitSection} from '../src/assistant/explicitSection';
import {plainNumericText,comparableRecordName} from '../src/assistant/safeText';

function fixture(){
 const data=blankAssistantData(),scope=data.scopes[0];
 scope.sections=[{id:'section-popo',name:'بوبو',revision:0},{id:'other-section',name:'آخر',revision:0}];
 scope.projects=[{id:'card-aya',name:'&#x627;يه',sectionId:'section-popo',revision:0,rank:0,trashedAt:0},
 {id:'card-else',name:'ايه',sectionId:'other-section',revision:0,rank:1,trashedAt:0}] as typeof scope.projects;
 return data;
}
const saved=[{role:'assistant' as const,text:'تم تطبيق التغييرات',resolved:true,receipt:{changes:[
 {target:'sections' as const,scope:'personal',id:'section-popo',before:null,after:{name:'بوبو'}},
 {target:'projects' as const,scope:'personal',id:'card-aya',before:null,after:{name:'&#x627;يه',sectionId:'section-popo'}},
 ]}}];
it('decodes numeric Arabic references as plain text without processing named HTML',()=>{
 expect(plainNumericText('&#x627;يه')).toBe('ايه');
 expect(plainNumericText('&lt;script&gt;')).toBe('&lt;script&gt;');
 expect(comparableRecordName('آيه')).toBe(comparableRecordName('&#x627;يه'));
});
it('resolves the explicit matching section and its own card, not same-name card elsewhere',()=>{
 const d=fixture(),reply=quickFollowUp('قسم بوبو وبطاقة ايه احذفهم',d,[])!;
 expect(reply.actions).toEqual([
  {target:'projects',action:'trash',scope:'personal',id:'card-aya',values:{}},
  {target:'sections',action:'delete',scope:'personal',id:'section-popo',values:{}},
 ]);
 expect(()=>checkExplicitSection('قسم بوبو وبطاقة ايه احذفهم',d,reply)).not.toThrow();
 const changes=planAssistantChanges(d,reply.actions);
 expect(changes.some(c=>c.target==='sections'&&c.id==='section-popo'&&c.after===null)).toBe(true);
 expect(changes.some(c=>c.target==='projects'&&c.id==='card-aya'&&(c.after as {trashedAt:number}).trashedAt>0)).toBe(true);
});
it('resolves plural deletion from a confirmed pair, but never from guessed history',()=>{
 const data=fixture();
 expect(quickFollowUp('احذفهم',data,saved)?.actions).toHaveLength(2);
 expect(quickFollowUp('احذف القسم ايضا',data,saved)?.actions).toHaveLength(2);
 expect(quickFollowUp('احذفهم',data,[])?.actions).toEqual([]);
 expect(quickFollowUp('احذفهم',data,[...saved,{role:'user',text:'غير موضوع'}])?.actions).toEqual([]);
});
it('asks instead of deleting when explicit card or section is ambiguous',()=>{
 const data=fixture();
 expect(quickFollowUp('قسم بوبو وبطاقة مفقودة احذفهم',data,[])?.actions).toEqual([]);
 data.scopes[0].projects.push({...data.scopes[0].projects[0],id:'duplicate'});
 expect(quickFollowUp('قسم بوبو وبطاقة ايه احذفهم',data,[])?.actions).toEqual([]);
});
