import {expect,it,vi} from 'vitest';
import {quickTrashPurge} from '../src/assistant/quickTrashPurge';
import {blankAssistantData} from '../src/assistant/actions';
import {reliableAssistantRead} from '../src/assistant/assistantRepository';
it('routes exact Arabic full trash purge locally without contacting AI',()=>{
 const state=blankAssistantData();
 state.scopes[0].projects=[{id:'trash-1',name:'Trashed',trashedAt:123},{id:'live-1',name:'Live',trashedAt:0}] as typeof state.scopes[0]['projects'];
 const reply=quickTrashPurge('احذف جميع بطاقات سلة المهملات حذف نهائي',state,'ar');
 expect(reply?.actions).toEqual([{target:'projects',action:'delete',scope:'personal',id:'trash-1',values:{}}]);
 expect(reply?.tasks?.[0].outcome).toBe('proposed');
 expect(quickTrashPurge('احذف بطاقة','ar' as never,'ar')).toBeNull();
});
it('does not turn ordinary or negated deletion requests into irreversible changes',()=>{
 const state=blankAssistantData();
 for(const phrase of ['احذف البطاقة','لا تحذف جميع بطاقات سلة المهملات حذف نهائي','افتح سلة المهملات','delete all active cards','empty trash'])expect(quickTrashPurge(phrase,state,'ar')).toBeNull();
});
it('one safe retry of temporary Firestore unavailability, never permission errors',async()=>{
 const work=vi.fn().mockRejectedValueOnce({code:'unavailable'}).mockResolvedValueOnce('ok');
 const pause=vi.fn(async()=>{});
 await expect(reliableAssistantRead(work,pause)).resolves.toBe('ok');
 expect(work).toHaveBeenCalledTimes(2);expect(pause).toHaveBeenCalledTimes(1);
 const forbidden=vi.fn().mockRejectedValue({code:'permission-denied'});
 await expect(reliableAssistantRead(forbidden,pause)).rejects.toMatchObject({code:'permission-denied'});
 expect(forbidden).toHaveBeenCalledTimes(1);
});
