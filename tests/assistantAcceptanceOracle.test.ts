import {expect,it} from 'vitest';
import {acceptanceCases} from './fixtures/assistant/corpus.mjs';
import {evaluateAcceptance} from './fixtures/assistant/oracle';
import {readWorkspaceToolProposal} from '../push-worker/src/assistantTools.mjs';
const proposal=(actions:unknown)=>readWorkspaceToolProposal(JSON.stringify({text:'Review',actions,controls:[],files:[]}));
it('accepts arbitrary valid IDs for new course topics when the user specified only the title and completion state',()=>{
 const c=acceptanceCases.find(c=>c.id==='update-courses-topics-ar')!,actions=structuredClone(c.actions);actions[0].values.topics[0].id='chapter-1';
 expect(()=>evaluateAcceptance(c,proposal(actions))).not.toThrow();
 actions[0].values.topics[0].done=true;expect(()=>evaluateAcceptance(c,proposal(actions))).toThrow('oracle-field:courses.topics');
});
it('still requires the existing topic identity when marking an existing topic complete',()=>{
 const c=acceptanceCases.find(c=>c.id==='complete-topic-ar')!,actions=structuredClone(c.actions);actions[0].values.topics[0].id='replacement-topic';
 expect(()=>evaluateAcceptance(c,proposal(actions))).toThrow('oracle-field:courses.topics');
});
it('checks rendered checklist items and completion state rather than an optional unchecked marker',()=>{
 const c=acceptanceCases.find(c=>c.id==='update-projects-checklist-en')!,actions=structuredClone(c.actions);actions[0].values.checklist='One\n[x] Two';
 expect(()=>evaluateAcceptance(c,proposal(actions))).not.toThrow();
 actions[0].values.checklist='One|false\nTwo|true';expect(()=>evaluateAcceptance(c,proposal(actions))).toThrow('oracle-field:projects.checklist');
});