import {expect,it} from 'vitest';
import {acceptanceCases} from './fixtures/assistant/corpus.mjs';
import {buildStressCorpus,STRESS_TOTAL} from './fixtures/assistant/stressCorpus.mjs';
it('builds 2000 unique grounded assistant requests per language without changing expected operations',()=>{
 const cases=buildStressCorpus();
 expect(cases).toHaveLength(STRESS_TOTAL);
 for(const language of ['ar','en','he']){
  const selected=cases.filter(c=>c.language===language);
  expect(selected).toHaveLength(2000);
  expect(new Set(selected.map(c=>c.message)).size).toBe(2000);
  expect(selected.some(c=>c.actions.length>1)).toBe(true);
  for(const testCase of selected){
   const original=acceptanceCases.find(c=>c.id===testCase.sourceId);
   expect(original).toBeDefined();
   expect(testCase.actions).toEqual(original.actions);
   expect(testCase.controls).toEqual(original.controls);
   expect(testCase.intents).toEqual(original.intents);
  }
 }
});
