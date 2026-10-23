import {expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({auth:null,db:null}));
import {assistantContext} from '../src/assistant/assistantRepository';
import type {AssistantSnapshot} from '../src/assistant/assistantRepository';
import {blankAssistantData} from '../src/assistant/actions';
const fixture=()=>{
 const data=blankAssistantData();data.study.courses=[{id:'real-course',name:'Course',notes:'Keep these notes',url:'',x:0,y:0,requires:[],source:{shortName:'C',description:'imported source text',teachers:[],sections:[],status:'available',warnings:[]}}];
 return {data,raw:new Map(),pending:false} as AssistantSnapshot;
};
it('omits imported page bodies for ordinary edits while keeping real IDs, notes and timetable',()=>{
 const snapshot=fixture(),context=JSON.parse(assistantContext(snapshot,'Move my class to Sunday'));
 expect(context.study.courses[0]).toMatchObject({id:'real-course',notes:'Keep these notes',sourceOmitted:true});expect(context.study.courses[0].source).toBeUndefined();
 expect(snapshot.data.study.courses[0].source?.description).toBe('imported source text');
});
it('retains imported content for analysis and never silently truncates a summary source',()=>{
 const snapshot=fixture();for(const message of ['لخص محتوى الكورس','Summarize the course','סכם תוכן הקורס'])expect(assistantContext(snapshot,message)).toContain('imported source text');
 snapshot.data.study.courses[0].source!.description='x'.repeat(50000);
 expect(()=>assistantContext(snapshot,'Summarize the course')).toThrow('assistant-too-large');
 expect(assistantContext(snapshot,'Add a class')).not.toContain('x'.repeat(100));
});
