import {expect,it} from 'vitest';
import {blankAssistantData,parseAssistantReply,planAssistantChanges} from '../src/assistant/actions';
import type {Action} from '../src/assistant/actions';
import {parseControls} from '../src/assistant/controlContract';
import {assistantCapabilities} from '../src/assistant/capabilities';
import {ProjectEntity} from '../src/lib/projectEntity';
const fixture=()=>{const data=blankAssistantData();data.study.courses=[{id:'course',name:'Course',url:'',notes:'Keep',requires:[],x:0,y:0},{id:'prerequisite',name:'Other',url:'',notes:'',requires:[],x:0,y:0}];data.study.tasks=[{id:'task',courseId:'course',title:'Task',kind:'task',due:'',done:false,notes:'',url:''}];data.study.lessons=[{id:'lesson',courseId:'course',day:1,start:'09:00',end:'10:00',room:'',sessionType:'lecture'}];data.scopes[0].sections=[{id:'section',name:'Section',revision:0}];data.scopes[0].projects=[ProjectEntity.create('card','Card','Keep',100,{},100).snapshot()];return data;};
const patches:Record<Action['target'],Record<string,unknown>>={
 projects:{name:'New',nextStep:'Next',status:'waiting',description:'Description',dueDate:'2026-10-25',followUpDate:'2026-11-01',checkpoint:'Page 12',checklist:'[ ] One\n[x] Two',sectionId:'section',projectUrl:'https://example.test/project',attachmentUrl:'https://example.test/notes',links:['https://example.test/link'],resourceType:'book',progressUnits:12,totalUnits:100,kind:'deadline',rank:400,assignedTo:'',coverUrl:'https://example.test/cover.png',archivedAt:200,trashedAt:300},
 courses:{name:'Renamed',url:'https://example.test/course',notes:'New notes',requires:['prerequisite'],topics:[{id:'topic',title:'Chapter 1',done:true}],x:400,y:500},
 tasks:{courseId:'prerequisite',title:'Exam',kind:'exam',due:'2026-11-01T12:00:00+02:00',done:true,notes:'Bring ID',url:'https://example.test/exam'},
 lessons:{courseId:'prerequisite',sessionType:'tutorial',day:4,start:'09:20',end:'16:00',room:'104',notes:'Flipped classroom'},
 sections:{name:'Renamed section'},
};
for(const [target,values] of Object.entries(patches))for(const [field,value] of Object.entries(values))it(`supports ${target}.${field} updates while preserving the rest of the record`,()=>{
 const data=fixture(),before=structuredClone(data),id={projects:'card',courses:'course',tasks:'task',lessons:'lesson',sections:'section'}[target]!;
 const reply=parseAssistantReply(JSON.stringify({text:'Review',actions:[{target,action:'update',id,scope:'personal',values:{[field]:value}}]}));
 const change=planAssistantChanges(data,reply.actions,1000)[0];expect(change).toBeDefined();
 const actual=field==='due'?'2026-11-01T10:00:00.000Z':value;
 expect(change.after).toMatchObject({[field]:actual});expect(data).toEqual(before);
});
it('plans ten connected requests as one complete proposal with aliases across all five data types and site controls',()=>{
 const actions:Action[]=[
 {target:'sections',action:'create',id:'new-section',values:{name:'Study'}},
 {target:'projects',action:'create',id:'new-card',values:{name:'عمار',sectionId:'new-section',dueDate:'2026-10-25'}},
 {target:'projects',action:'update',id:'new-card',values:{nextStep:'Solve two exercises'}},
 {target:'courses',action:'create',id:'new-course',values:{name:'محمد'}},
 {target:'courses',action:'update',id:'new-course',values:{requires:['prerequisite']}},
 {target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:0,start:'00:00',end:'01:00',sessionType:'lecture',room:''}},
 {target:'tasks',action:'create',id:'new-task',values:{courseId:'new-course',title:'Assignment',kind:'assignment',due:'2026-10-25T18:00:00+02:00'}},
 {target:'courses',action:'update',id:'new-course',values:{topics:[{id:'topic',title:'Introduction',done:false}]}},
 ];
 const controls=[{kind:'appearance',values:{theme:'ocean',background:'grid'}},{kind:'navigate',values:{page:'personal',view:'week',weekOf:'2026-10-25'}}];
 const tasks=[...actions.map((_,i)=>({title:'Request '+i,outcome:'proposed',actionIndexes:[i],controlIndexes:[],detail:''})),...controls.map((_,i)=>({title:'Control '+i,outcome:'proposed',actionIndexes:[],controlIndexes:[i],detail:''}))];
 const reply=parseAssistantReply(JSON.stringify({text:'Review',actions,controls,tasks,files:[{name:'advice.txt',content:'Study in shorter sessions.'}]})),changes=planAssistantChanges(fixture(),reply.actions,1000,true);
 expect(reply.tasks).toHaveLength(10);expect(changes).toHaveLength(5);
 const course=changes.find(c=>c.target==='courses')!,section=changes.find(c=>c.target==='sections')!;
 expect(changes.find(c=>c.target==='lessons')!.after).toMatchObject({courseId:course.id,start:'00:00',end:'01:00'});
 expect(changes.find(c=>c.target==='projects')!.after).toMatchObject({sectionId:section.id,dueDate:'2026-10-25'});
 expect(changes.flatMap(c=>c.actionIndexes)).toEqual(expect.arrayContaining([0,1,2,3,4,5,6,7]));
});
it('deletes dependents before a course and supports trash and section removal without permanent card deletion',()=>{
 const data=fixture();expect(planAssistantChanges(data,[{target:'tasks',action:'delete',id:'task'},{target:'lessons',action:'delete',id:'lesson'},{target:'courses',action:'delete',id:'course'}])).toHaveLength(3);
 expect(planAssistantChanges(data,[{target:'sections',action:'delete',id:'section'},{target:'projects',action:'trash',id:'card'}],1000).find(c=>c.target==='projects')?.after).toMatchObject({trashedAt:1000});
});
it('enforces midnight precision, required lesson times and duplicate prevention for cloud proposals too',()=>{
 const data=fixture(),values={courseId:'course',day:1,start:'09:00',end:'10:00',sessionType:'lecture',room:'Invented'};
 expect(planAssistantChanges(data,[{target:'lessons',action:'create',id:'duplicate',values}])).toEqual([]);
 expect(()=>planAssistantChanges(data,[{target:'lessons',action:'create',id:'missing-time',values:{courseId:'course'}}])).toThrow('assistant-invalid');
 expect(()=>planAssistantChanges(data,[{target:'projects',action:'create',id:'bad-date',values:{name:'Bad',dueDate:'2026-02-30'}}])).toThrow('invalid-due-date');
});
it('rejects a ledger that silently fails to account for any proposed operation',()=>{
 expect(()=>parseAssistantReply(JSON.stringify({text:'Review',actions:[{target:'courses',action:'create',id:'x',values:{name:'X'}}],tasks:[{title:'Only an answer',outcome:'answer',actionIndexes:[],controlIndexes:[],detail:'Hello'}]}))).toThrow('assistant-invalid');
});
it('keeps every published capability attached to an executor mode or explicit UI handoff',()=>{
 expect(new Set(assistantCapabilities.map(c=>c.id)).size).toBe(assistantCapabilities.length);
 for(const capability of assistantCapabilities){expect(['edit','control','answer','handoff']).toContain(capability.mode);expect(capability.detail.length).toBeGreaterThan(30);}
 for(const page of ['personal','resume','university','groups','settings','notifications','library','analytics','logs','support'])expect(parseControls([{kind:'navigate',values:{page}}])).toHaveLength(1);
});
it.each(['2026-02-30T10:00:00Z','2026-10-25T24:10:00Z','2026-10-25T12:00'])('rejects invalid or timezone-free university deadlines: %s',due=>{
 expect(()=>planAssistantChanges(fixture(),[{target:'tasks',action:'update',id:'task',values:{due}}])).toThrow('assistant-invalid');
});
it('resolves navigation to a course/section created in the same proposal and rejects deleted or foreign references',async()=>{
 const {planAssistantProposal,resolveProposalControls}=await import('../src/assistant/actions');
 const data=fixture(),actions:Action[]=[{target:'courses',action:'create',id:'new-course',values:{name:'New'}},{target:'sections',action:'create',id:'new-section',values:{name:'New'}}],changes=planAssistantProposal(data,actions);
 const controls=resolveProposalControls(data,actions,changes,[{kind:'navigate',values:{page:'university',courseId:'new-course'}},{kind:'navigate',values:{page:'personal',section:'new-section'}}]);
 expect(controls[0].values.courseId).toBe(changes[0].id);expect(controls[1].values.section).toBe(changes[1].id);
 for(const values of [{page:'university',courseId:'missing'},{page:'personal',section:'foreign'}])expect(()=>resolveProposalControls(data,actions,changes,[{kind:'navigate',values}])).toThrow('assistant-invalid');
});

it('rejects unsupported lesson types instead of silently converting a tutorial typo into a lecture',()=>{
 expect(()=>planAssistantChanges(fixture(),[{target:'lessons',action:'update',id:'lesson',values:{sessionType:'Tutorial'}}])).toThrow('assistant-invalid');
});
