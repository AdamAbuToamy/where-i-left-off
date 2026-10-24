import {expect,it} from 'vitest';
import {readIntents,reconcileIntentProposal} from '../push-worker/src/assistantIntents.mjs';
const req=(target,operation,field,expected,match='equals')=>({target,operation,field,expected,match});
it('normalizes an empty subject for named multi-create records',()=>{
 const raw={intents:[1,2].map(n=>({title:'card',source:'Create Item 1 through Item 2',subject:'',recordId:'',outcome:'proposed',requirements:[req('projects','create','name','Item '+n)]}))};
 const got=readIntents(JSON.stringify(raw),'Create Item 1 through Item 2');
 expect(got.map(i=>i.subject)).toEqual(['projects:Item 1','projects:Item 2']);
});
it('normalizes delete id inventory to supported empty field',()=>{
 const raw={intents:[{title:'delete',source:'احذف الكورس',subject:'course',recordId:'course',outcome:'proposed',requirements:[req('courses','delete','id','course')]}]};
 expect(readIntents(JSON.stringify(raw),'احذف الكورس')[0].requirements[0]).toMatchObject({field:'',expected:null});
});
it('turns a navigation request into a proposed control and fills timetable tab',()=>{
 const raw={intents:[{title:'open',source:'افتح الجدول الجامعي',subject:'',recordId:'',outcome:'answer',requirements:[req('navigate','control','page','university')]}]};
 const intents=readIntents(JSON.stringify(raw),'افتح الجدول الجامعي');
 expect(intents[0].outcome).toBe('proposed');
 const proposal={text:'open',actions:[],controls:[{kind:'navigate',values:{page:'university'}}],files:[]};
 expect(reconcileIntentProposal(proposal,intents).issues).toEqual([]);
 expect(proposal.controls[0].values.tab).toBe('schedule');
});
it('fills a missing sessionType for the exact existing lesson',()=>{
 const intents=[{title:'move',source:'Move class to lab',subject:'lesson',recordId:'lesson',outcome:'proposed',requirements:[req('lessons','update','day',0),req('lessons','update','sessionType','lab')]}];
 const proposal={text:'',actions:[{target:'lessons',action:'update',id:'lesson',values:{day:0}}],controls:[],files:[]};
 expect(reconcileIntentProposal(proposal,intents,{study:{lessons:[{id:'lesson',day:1,sessionType:'lecture'}]}}).issues).toEqual([]);
 expect(proposal.actions[0].values.sessionType).toBe('lab');
});
it('preserves previous notes on append but permits replacing a next step',()=>{
 const intents=[{title:'step',source:'step Go',subject:'card',recordId:'card',outcome:'proposed',requirements:[req('projects','update','nextStep','Go','contains')]}];
 const proposal={text:'',actions:[{target:'projects',action:'update',id:'card',values:{nextStep:'Go'}}],controls:[],files:[]};
 expect(reconcileIntentProposal(proposal,intents,{scopes:[{id:'personal',projects:[{id:'card',nextStep:'Keep'}]}]}).issues).toEqual([]);
});
