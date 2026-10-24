import {expect,it} from 'vitest';
import {blankAssistantData,parseAssistantReply,planAssistantChanges,planAssistantProposal} from '../src/assistant/actions';
import type {Action} from '../src/assistant/actions';
const fixture=()=>{const d=blankAssistantData();d.study.courses=[{id:'a',name:'A',url:'',notes:'keep',requires:[],x:0,y:0},{id:'b',name:'B',url:'',notes:'',requires:[],x:300,y:0}];return d;};
it('links courses using exact IDs and preserves notes; rejects cycles and missing dependencies',()=>{
 const d=fixture(),changes=planAssistantChanges(d,[{target:'courses',action:'update',id:'b',values:{requires:['a']}}]);
 expect(changes[0].after).toMatchObject({id:'b',requires:['a']});expect(d.study.courses[1].requires).toEqual([]);
 expect(()=>planAssistantChanges(d,[{target:'courses',action:'update',id:'b',values:{requires:['a']}},{target:'courses',action:'update',id:'a',values:{requires:['b']}}])).toThrow();
 expect(()=>planAssistantChanges(d,[{target:'courses',action:'update',id:'b',values:{requires:['foreign']}}])).toThrow();
});
it('creates a course, task and timetable row using aliases, with local generated identity',()=>{
 const changes=planAssistantChanges(fixture(),[{target:'courses',action:'create',id:'new-course',values:{name:'C'}},{target:'tasks',action:'create',id:'new-task',values:{courseId:'new-course',title:'Read',due:'2026-11-01T09:00:00+02:00'}},{target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:2,start:'10:00',end:'11:00',room:'104',sessionType:'tutorial'}}]);
 expect(changes).toHaveLength(3);expect(changes[0].id).not.toBe('new-course');expect(changes[1].after).toMatchObject({courseId:changes[0].id,due:'2026-11-01T07:00:00.000Z'});expect(changes[2].after).toMatchObject({courseId:changes[0].id,sessionType:'tutorial'});
});
it('rejects arbitrary fields, code targets, foreign scopes, invalid deadlines and broken class times',()=>{
 const d=fixture();for(const action of [
 {target:'courses',action:'update',id:'a',values:{uid:'bob'}},
 {target:'projects',action:'create',id:'new',scope:'foreign',values:{name:'No'}},
 {target:'tasks',action:'create',id:'new',values:{courseId:'a',title:'X',due:'2026-11-01T09:00'}},
 {target:'lessons',action:'create',id:'new',values:{courseId:'a',start:'11:00',end:'10:00'}},
 ] as Action[])expect(()=>planAssistantChanges(d,[action])).toThrow();
 expect(()=>parseAssistantReply('{"text":"x","actions":[{"target":"users","action":"delete"}],"files":[]}')).toThrow();
 expect(()=>parseAssistantReply('{"text":"x","actions":[{"target":"courses","action":"update","id":"a/b","values":{}}],"files":[]}')).toThrow();
});
it('edits cards through the existing domain rules and trashes instead of permanent deletion',()=>{
 const d=fixture();let c=planAssistantChanges(d,[{target:'projects',action:'create',id:'card',values:{name:'Robot',nextStep:'Assemble',status:'active'}}])[0];d.scopes[0].projects.push(c.after as never);
 c=planAssistantChanges(d,[{target:'projects',action:'update',id:c.id,values:{name:'Robot arm',status:'done'}}],123)[0];expect(c.after).toMatchObject({name:'Robot arm',status:'done',revision:1,completedAt:123});
 expect(()=>planAssistantChanges(d,[{target:'projects',action:'delete',id:c.id}])).toThrow();expect(planAssistantChanges(d,[{target:'projects',action:'trash',id:c.id}],234)[0].after).toMatchObject({trashedAt:234});
});
it('requires explicit removal of dependent records and protects linked reminders',()=>{
 const d=fixture();d.study.tasks.push({id:'t',courseId:'a',title:'Exam',due:'2026-11-01T09:00:00Z',kind:'exam',done:false,notes:'',url:'',reminderProjectId:'linked'});
 expect(()=>planAssistantChanges(d,[{target:'courses',action:'delete',id:'a'}])).toThrow();
 expect(()=>planAssistantChanges(d,[{target:'tasks',action:'update',id:'t',values:{done:true}}])).toThrow('assistant-linked-reminder');
});
it('downloads only inert text files and rejects malformed output rather than exposing action JSON',()=>{
 const r=parseAssistantReply(JSON.stringify({text:'Summary',actions:[],files:[{name:'../summary.html',content:'<script>bad</script>'}]}));expect(r.files[0].name).toMatch(/\.txt$/);expect(r.files[0].name).not.toContain('/');
 expect(()=>parseAssistantReply('I changed your cards!')).toThrow('assistant-format');
});

it('accepts ordinary JSON chat replies without optional arrays, without validating unrelated legacy records',()=>{
 const reply=parseAssistantReply('{"text":"مرحبا"}');expect(reply.actions).toEqual([]);expect(reply.files).toEqual([]);
 const data=fixture();data.study.tasks.push({id:'legacy',courseId:'missing',title:'Keep local',kind:'task',due:'',notes:'',done:false,url:''});
 expect(planAssistantChanges(data,reply.actions)).toEqual([]);
 expect(()=>parseAssistantReply('{"text":"x","actions":null,"files":[]}')).toThrow('assistant-format');
 expect(()=>parseAssistantReply('{"text":"x","actions":[')).toThrow('assistant-format');
});

it('only permits permanent deletion of already-trashed personal cards',async()=>{
 const {blankAssistantData,planAssistantProposal}=await import('../src/assistant/actions');
 const state=blankAssistantData();state.scopes[0].projects=[{id:'trashed',name:'Old',trashedAt:123,revision:0},{id:'live',name:'Live',trashedAt:0,revision:0}] as typeof state.scopes[0]['projects'];
 const allowed=planAssistantProposal(state,[{target:'projects',action:'delete',id:'trashed',scope:'personal',values:{}}]);
 expect(allowed).toMatchObject([{id:'trashed',after:null}]);
 expect(()=>planAssistantProposal(state,[{target:'projects',action:'delete',id:'live',values:{}}])).toThrow();
});


it('plans trash card then delete its section as one safe proposal',()=>{
 const state=blankAssistantData();
 state.scopes[0].sections=[{id:'section-a',name:'Ayush',revision:0}];
 state.scopes[0].projects=[{id:'card-a',name:'Card',sectionId:'section-a',nextStep:'',rank:0,revision:0,trashedAt:0,status:'active'}] as typeof state.scopes[0]['projects'];
 const plan=planAssistantProposal(state,[{target:'projects',action:'trash',id:'card-a',scope:'personal',values:{}},{target:'sections',action:'delete',id:'section-a',scope:'personal',values:{}}]);
 expect(plan).toEqual(expect.arrayContaining([expect.objectContaining({target:'projects',id:'card-a',after:expect.objectContaining({sectionId:'',trashedAt:expect.any(Number)})}),expect.objectContaining({target:'sections',id:'section-a',after:null})]));
 expect(plan.filter(c=>c.target==='projects')).toHaveLength(1);
});
