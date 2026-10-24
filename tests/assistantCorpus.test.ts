import {expect,it} from 'vitest';
import {acceptanceCases,acceptanceContext} from './fixtures/assistant/corpus.mjs';
import {evaluateAcceptance} from './fixtures/assistant/oracle';
import {readIntents,reconcileIntentProposal} from '../push-worker/src/assistantIntents.mjs';
for(const testCase of acceptanceCases)it(`${testCase.id}: ${testCase.message}`,()=>{
 const context=acceptanceContext(testCase.id),intents=readIntents(JSON.stringify({intents:testCase.intents}),testCase.message);
 // Deliberately different model grouping: one task for all operations. The application
 // must reconstruct every requested effect rather than rejecting a correct mutation.
 const proposed={text:'Review',actions:structuredClone(testCase.actions),controls:structuredClone(testCase.controls),files:[],tasks:[]};
 const checked=reconcileIntentProposal(proposed,intents,context);
 expect(checked.issues).toEqual([]);expect(checked.proposal.tasks).toHaveLength(intents.length);
 const planned=evaluateAcceptance(testCase,JSON.stringify(checked.proposal));
 expect(planned.changes.length+planned.controls.length).toBeGreaterThan(0);
 // Every actual operation still needs an authoritative task reference.
 expect(new Set(checked.proposal.tasks.flatMap(t=>t.actionIndexes)).size).toBe(testCase.actions.length);
});
it('has over 200 unique requests, all languages and all editable targets',()=>{
 expect(acceptanceCases).toHaveLength(618);expect(new Set(acceptanceCases.map(c=>c.message)).size).toBe(618);
 expect(new Set(acceptanceCases.map(c=>c.language))).toEqual(new Set(['ar','en','he']));
 expect(new Set(acceptanceCases.flatMap(c=>c.actions.map(a=>a.target)))).toEqual(new Set(['projects','sections','courses','tasks','lessons']));
});

function compoundGrouped(){
 const c=acceptanceCases.find(c=>c.id==='compound-card-ar')!;
 return {testCase:c,reply:{text:'Review',actions:structuredClone(c.actions),controls:[],files:[],tasks:[{title:'Create card with date and note',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]}};
}
it('accepts a single plan item only when all three requested card fields are actually present',()=>{
 const {testCase,reply}=compoundGrouped();const result=evaluateAcceptance(testCase,JSON.stringify(reply));
 expect(result.changes).toHaveLength(1);expect(result.changes[0].after).toMatchObject({name:'عمار',dueDate:'2026-10-25',description:'مرحبا نجحت'});
});
it.each(['dueDate','description'])('grouping cannot hide the missing requested field %s',field=>{
 const {testCase,reply}=compoundGrouped();delete (reply.actions[0].values as Record<string,unknown>)[field];
 expect(()=>evaluateAcceptance(testCase,JSON.stringify(reply))).toThrow('oracle-field:projects.'+field);
});
it('grouped plans still reject extra records and a note placed on another card',()=>{
 const {testCase,reply}=compoundGrouped();reply.actions.push({...reply.actions[0],id:'extra-card',values:{name:'Extra'}});reply.tasks[0].actionIndexes.push(1);
 expect(()=>evaluateAcceptance(testCase,JSON.stringify(reply))).toThrow('oracle-extra-record');
 delete (reply.actions[0].values as Record<string,unknown>).description;reply.actions[1].values={name:'Extra',description:'مرحبا نجحت'};
 expect(()=>evaluateAcceptance(testCase,JSON.stringify(reply))).toThrow('oracle-field:projects.description');
});
it('mutation grouping does not erase an explicitly required answer or handoff',()=>{
 const {testCase,reply}=compoundGrouped();const withQuestion={...testCase,intents:[...testCase.intents,{outcome:'answer'}]};
 expect(()=>evaluateAcceptance(withQuestion,JSON.stringify(reply))).toThrow('oracle-request-omitted');
});

it('a grouped valid data plan cannot conceal an unrequested preference change',()=>{
 const {testCase,reply}=compoundGrouped();
 const withControl={...reply,controls:[{kind:'appearance',values:{theme:'rose'}}],tasks:[{...reply.tasks[0],controlIndexes:[0]}]};
 expect(()=>evaluateAcceptance(testCase,JSON.stringify(withControl))).toThrow('oracle-extra-control');
});
