import {expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({auth:null,db:null}));
import {assistantContext,type AssistantSnapshot} from '../src/assistant/assistantRepository';
import {nativeWorkspaceInput} from '../push-worker/src/assistantNativeTools.mjs';
import {blankAssistantData} from '../src/assistant/actions';
const fixture=()=>{const data=blankAssistantData();data.study.courses=[{id:'real-course',name:'Course',notes:'Keep these notes',url:'',x:0,y:0,requires:[],source:{shortName:'C',description:'imported source text',teachers:[],sections:[],status:'available',warnings:[]}}];return {data,raw:new Map(),pending:false} as AssistantSnapshot;};
it('keeps full authorized sources locally while the model receives a bounded catalog',()=>{
 const snapshot=fixture();snapshot.data.study.courses[0].source!.description='imported private text '.repeat(50000);
 const text=assistantContext(snapshot,'لخص لي الكورسات اللي عندي');
 expect(text.length).toBeGreaterThan(1000000);
 expect(JSON.parse(text).study.courses[0].source.description).toBe(snapshot.data.study.courses[0].source!.description);
 const input=nativeWorkspaceInput({message:'لخص لي الكورسات اللي عندي',language:'ar',context:text},[]);
 expect(JSON.stringify(input)).not.toContain('imported private text');
 expect(JSON.stringify(input).length).toBeLessThan(120000);expect(JSON.stringify(input)).toContain('real-course');
});
it('accepts large source snapshots for summaries and edits without truncating them',()=>{
 const snapshot=fixture();snapshot.data.study.courses[0].source!.description='x'.repeat(250000);
 for(const message of ['لخص محتوى الكورس','Summarize the course','סכם תוכן הקורס','Add a class'])expect(JSON.parse(assistantContext(snapshot,message)).study.courses[0].source.description.length).toBe(250000);
});
