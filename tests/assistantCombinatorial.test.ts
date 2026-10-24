import {expect,it} from 'vitest';
import {blankAssistantData,planAssistantProposal,parseAssistantReply} from '../src/assistant/actions';
import {acceptanceCases} from './fixtures/assistant/corpus.mjs';
import {paraphraseCases,sequencePatterns} from './fixtures/assistant/paraphraseMatrix.mjs';

it('generates broad reproducible paraphrases from existing AR EN HE oracles',()=>{
 const generated=paraphraseCases(acceptanceCases);
 expect(generated.length).toBeGreaterThan(acceptanceCases.length*1.5);
 expect(new Set(generated.map(c=>c.id)).size).toBe(generated.length);
 for(const language of ['ar','en','he']){
  const subset=generated.filter(c=>c.language===language);
  expect(subset.length).toBeGreaterThan(250);
  for(const target of ['projects','sections','courses','tasks','lessons'])
   expect(subset.some(c=>c.actions.some(a=>a.target===target))).toBe(true);
  expect(subset.some(c=>c.actions.some(a=>a.action==='create'))).toBe(true);
  expect(subset.some(c=>c.actions.some(a=>a.action==='update'))).toBe(true);
  expect(subset.some(c=>c.actions.some(a=>a.action==='delete'||a.action==='trash'))).toBe(true);
 }
 expect(sequencePatterns.length).toBeGreaterThanOrEqual(6);
});

function plan(actions:Parameters<typeof planAssistantProposal>[1]){
 const data=blankAssistantData();
 return planAssistantProposal(data,actions);
}
it('safe atomic section create → card create → edit → trash → section delete',()=>{
 for(let index=0;index<120;index++){
  const name='Item '+index,section='Group '+index;
  const changes=plan([
   {target:'sections',action:'create',id:'new-section',values:{name:section}},
   {target:'projects',action:'create',id:'new-card',values:{name,sectionId:'new-section'}},
   {target:'projects',action:'update',id:'new-card',values:{description:'Note '+index,dueDate:'2026-10-28'}},
   {target:'projects',action:'trash',id:'new-card',values:{}},
   {target:'sections',action:'delete',id:'new-section',values:{}},
  ]);
  expect(changes).toHaveLength(1);
  const card=changes.find(c=>c.target==='projects')!;
  expect(card.before).toBeNull();
  expect(card.after).toMatchObject({name,sectionId:'',description:'Note '+index,dueDate:'2026-10-28'});
  expect(Number((card.after as {trashedAt:number}).trashedAt)).toBeGreaterThan(0);
  expect(changes.find(c=>c.target==='sections')).toBeUndefined();
 }
});
it('three creates and a later edit retain exact targets and values',()=>{
 for(let index=0;index<100;index++){
  const changes=plan([
   {target:'projects',action:'create',id:'one',values:{name:'First '+index}},
   {target:'projects',action:'create',id:'two',values:{name:'Second '+index}},
   {target:'projects',action:'create',id:'three',values:{name:'Third '+index}},
   {target:'projects',action:'update',id:'two',values:{description:'Updated '+index,dueDate:'2026-10-28'}},
  ]);
  expect(changes.filter(c=>c.target==='projects')).toHaveLength(3);
  expect(changes.find(c=>(c.after as {name:string})?.name==='Second '+index)?.after).toMatchObject({description:'Updated '+index,dueDate:'2026-10-28'});
 });
});
it('new course alias can be used for its task and class, but nonexistent IDs fail safely',()=>{
 for(let index=0;index<60;index++){
  const changes=plan([
   {target:'courses',action:'create',id:'course-new',values:{name:'Course '+index}},
   {target:'tasks',action:'create',id:'task-new',values:{title:'Assignment '+index,courseId:'course-new',kind:'assignment'}},
   {target:'lessons',action:'create',id:'lesson-new',values:{courseId:'course-new',day:0,start:'09:20',end:'11:00',sessionType:'lecture'}},
   {target:'courses',action:'update',id:'course-new',values:{notes:'Notes '+index}},
  ]);
  const course=changes.find(c=>c.target==='courses')!,task=changes.find(c=>c.target==='tasks')!,lesson=changes.find(c=>c.target==='lessons')!;
  expect(course.after).toMatchObject({name:'Course '+index,notes:'Notes '+index});
  expect(task.after).toMatchObject({courseId:course.id,title:'Assignment '+index});
  expect(lesson.after).toMatchObject({courseId:course.id,day:0,start:'09:20',end:'11:00'});
 }
 expect(()=>plan([{target:'projects',action:'update',id:'unrelated',values:{name:'Wrong'}}])).toThrow('assistant-invalid');
});
it('no unrequested write on incomplete or invalid model JSON',()=>{
 for(const invalid of ['{}','[]','not JSON','{"text":"Oops","actions":[{"target":"projects","action":"create","id":"x","values":{"name":""}}],"files":[],"tasks":[]}']){
  try{const parsed=parseAssistantReply(invalid);expect(()=>planAssistantProposal(blankAssistantData(),parsed.actions)).toThrow();}catch(error){expect(error).toBeInstanceOf(Error);}
 }
});
