import {expect,it} from 'vitest';
import {blankAssistantData} from '../src/assistant/actions';
import type {AssistantReply} from '../src/assistant/actions';
import {checkExplicitSection} from '../src/assistant/explicitSection';
const state=blankAssistantData();
state.scopes[0].sections=[{id:'jobs',name:'Job applications',revision:0}];
const reply=(sectionId:string):AssistantReply=>({text:'Review',actions:[{target:'projects',action:'create',id:'card',scope:'personal',values:{name:'آيه',sectionId,dueDate:'2026-10-28'}}],controls:[],files:[],tasks:[{title:'Create card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]});
it('rejects choosing an unrelated existing section for an explicitly named Arabic section',()=>{
 expect(()=>checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,reply('jobs'))).toThrow('assistant-reference');
});
it('accepts named existing section, and requires new section action when missing',()=>{
 state.scopes[0].sections.push({id:'ayush',name:'أيوش',revision:0});
 expect(()=>checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,reply('ayush'))).not.toThrow();
 state.scopes[0].sections.pop();
 const good=reply('new-section');
 good.actions.unshift({target:'sections',action:'create',id:'new-section',scope:'personal',values:{name:'أيوش'}});
 expect(()=>checkExplicitSection('أضف بطاقة آيه في قسم أيوش بتاريخ 28 الشهر',state,good)).not.toThrow();
});
