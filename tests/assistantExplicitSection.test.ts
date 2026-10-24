import {expect,it} from 'vitest';
import {blankAssistantData} from '../src/assistant/actions';
import type {AssistantReply} from '../src/assistant/actions';
import {checkExplicitSection} from '../src/assistant/explicitSection';
const state=blankAssistantData();
state.scopes[0].sections=[{id:'jobs',name:'Job applications',revision:0}];
const reply=(sectionId:string):AssistantReply=>({text:'Review',actions:[{target:'projects',action:'create',id:'card',scope:'personal',values:{name:'آيه',sectionId,dueDate:'2026-10-28'}}],controls:[],files:[],tasks:[{title:'Create card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]});
it('rejects choosing an unrelated existing section for an explicitly named Arabic section',()=>{
 const proposed=reply('jobs');checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,proposed);expect(proposed.actions).toHaveLength(2);expect(proposed.actions[0]).toMatchObject({target:'sections',action:'create',values:{name:'أيوش'}});expect(proposed.actions[1].values?.sectionId).toBe(proposed.actions[0].id);
 const second=reply('jobs');checkExplicitSection('أضف بطاقة آيه لقسم أيوش بتاريخ 28 الشهر',state,second);expect(second.actions[0]).toMatchObject({target:'sections',action:'create',values:{name:'أيوش'}});
});
it('accepts named existing section, and requires new section action when missing',()=>{
 state.scopes[0].sections.push({id:'ayush',name:'أيوش',revision:0});
 expect(()=>checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,reply('ayush'))).not.toThrow();
 state.scopes[0].sections.pop();
 const good=reply('new-section');
 good.actions.unshift({target:'sections',action:'create',id:'new-section',scope:'personal',values:{name:'أيوش'}});
 expect(()=>checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,good)).not.toThrow();
});

it('routes delete-it to one confirmed recent card, not an unrelated project',async()=>{
 const {quickFollowUp}=await import('../src/assistant/quickFollowUp');
 const d=blankAssistantData();d.scopes[0].projects=[{id:'card-1',name:'آيه',revision:0,rank:0,trashedAt:0}] as typeof d.scopes[0]['projects'];
 const turns=[{role:'assistant' as const,receipt:{changes:[{target:'projects' as const,scope:'personal',id:'card-1',before:null,after:{name:'آيه'}}]}}];
 expect(quickFollowUp('احذفها',d,turns)?.actions[0]).toMatchObject({action:'trash',id:'card-1'});
 expect(quickFollowUp('احذفها',d,[])).toBeNull();
 expect(quickFollowUp('احذفها',d,[{role:'assistant',receipt:{changes:[...turns[0].receipt.changes,{target:'projects',scope:'personal',id:'card-2',before:null,after:{name:'other'}}]}}])).toBeNull();
});

it('preserves section mismatch failure code in user diagnostics',async()=>{const {AssistantFailure}=await import('../src/assistant/failure');const {friendlyFailure}=await import('../src/assistant/friendlyFailure');const failure=AssistantFailure.from(new Error('assistant-reference'),'request');expect(failure.diagnostic().code).toBe('assistant-reference');expect(friendlyFailure(failure,'ar')).toContain('القسم');});
