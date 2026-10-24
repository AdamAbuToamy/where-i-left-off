import {expect,it} from 'vitest';
import {reconcileIntentProposal} from '../push-worker/src/assistantIntents.mjs';
const intents=[
 {title:'إنشاء بطاقة',source:'بطاقة باسم عمار',subject:'new-card-1',recordId:'',outcome:'proposed',requirements:[{target:'projects',operation:'create',field:'name',expected:'عمار',match:'equals'}]},
 {title:'موعد',source:'25 الشهر',subject:'new-card-1',recordId:'',outcome:'proposed',requirements:[{target:'projects',operation:'create',field:'dueDate',expected:'2026-10-25',match:'equals'}]},
 {title:'ملاحظة',source:'مرحبا نجحت',subject:'new-card-1',recordId:'',outcome:'proposed',requirements:[{target:'projects',operation:'create',field:'description',expected:'مرحبا نجحت',match:'contains'}]}
];
it('repairs missing date and note from independent inventory for a uniquely matched new card',()=>{
 const proposal={text:'done',actions:[{target:'projects',action:'create',id:'new-card-1',scope:'personal',values:{name:'عمار'}}],controls:[],files:[],tasks:[]};
 const checked=reconcileIntentProposal(proposal,intents,{scopes:[{id:'personal',projects:[],sections:[]}],study:{}});
 expect(checked.issues).toEqual([]);
 expect(checked.proposal.actions[0].values).toMatchObject({name:'عمار',dueDate:'2026-10-25',description:'مرحبا نجحت'});
 expect(checked.proposal.tasks).toHaveLength(3);
});
it('does not invent fields when the created-card identity is ambiguous',()=>{
 const proposal={text:'done',actions:[{target:'projects',action:'create',id:'a',values:{name:'عمار'}},{target:'projects',action:'create',id:'b',values:{name:'عمار'}}],controls:[],files:[]};
 reconcileIntentProposal(proposal,intents,{});
 expect(proposal.actions.every(a=>!('description' in a.values))).toBe(true);
});
