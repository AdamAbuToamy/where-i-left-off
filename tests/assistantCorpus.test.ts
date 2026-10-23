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
