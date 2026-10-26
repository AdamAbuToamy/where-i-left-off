import {it,expect} from 'vitest';
import {conversationHistory} from '../src/assistant/conversationHistory';
import {blankAssistantData,planAssistantProposal} from '../src/assistant/actions';
const question=(text:string)=>({role:'assistant' as const,text,reply:{text,actions:[],controls:[],files:[],tasks:[{title:'Create card',outcome:'needs-input' as const,actionIndexes:[],controlIndexes:[],detail:text}]}});
it('retains an unfinished request across more than four messages without losing the name or skipped fields',()=>{
 const turns=[{role:'user' as const,text:'أضف بطاقة'},question('ماذا تريد تسميتها؟'),{role:'user' as const,text:'مراجعة خوارزميات'},question('موعد أو قسم أو ملاحظات أو رابط؟'),{role:'user' as const,text:'بدون موعد'},question('وأي قسم؟'),{role:'user' as const,text:'Study'}];
 const history=conversationHistory(turns);expect(history).toHaveLength(7);expect(history[0].content).toBe('أضف بطاقة');expect(history[2].content).toBe('مراجعة خوارزميات');expect(history[4].content).toBe('بدون موعد');
});
it('keeps confirmed record IDs for follow-up edits but never replays the completed proposal',()=>{
 const history=conversationHistory([{role:'user',text:'Create Networks'},{role:'assistant',text:'Saved',resolved:true,reply:{text:'Review',actions:[{target:'courses',action:'create',id:'new',values:{name:'Networks'}}],controls:[],files:[]},receipt:{changes:[{target:'courses',id:'actual-id',scope:'personal',before:null,after:{name:'Networks'}}]}}]);
 const saved=JSON.parse(history[1].content);expect(saved.status).toBe('saved');expect(saved.saved[0].id).toBe('actual-id');expect(saved.proposal).toBeUndefined();
});
it('fails explicitly rather than silently dropping a pending dialogue beyond its budget',()=>{
 expect(()=>conversationHistory([{role:'user',text:'x'.repeat(6001)},question('Name?')])).toThrow('assistant-conversation-full');
});
for(const target of ['projects','courses','tasks','sections'] as const)it(`blocks unnamed ${target} even if a malformed model omits the title`,()=>{
 expect(()=>planAssistantProposal(blankAssistantData(),[{target,action:'create',id:'new',values:{}}])).toThrow('assistant-invalid');
});


it('excludes failed requests and failed assistant replies from future model context',()=>{
 const turns=[{role:'user' as const,text:'احذف القسم',failed:true},{role:'assistant' as const,text:'لم أنفذ الطلب',failed:true,resolved:true},{role:'user' as const,text:'مرحبا'}];
 expect(conversationHistory(turns)).toEqual([{role:'user',content:'مرحبا'}]);
});
it('greetings are answered locally without inference or a data mutation',async()=>{
 const {quickGreeting}=await import('../src/assistant/quickGreeting');
 expect(quickGreeting('مرحبا','ar')).toContain('أهلًا');
 expect(quickGreeting('שלום','he')).not.toBeNull();
 expect(quickGreeting('احذف القسم','ar')).toBeNull();
});
it('incomplete proposals get natural-language feedback without implying a save',async()=>{
 const {AssistantFailure}=await import('../src/assistant/failure');
 const {friendlyFailure}=await import('../src/assistant/friendlyFailure');
 const reply=friendlyFailure(new AssistantFailure('ai-incomplete-proposal','provider'),'ar');
 expect(reply).toContain('لم أحفظ أي تغييرات');
 expect(reply).not.toContain('ai-incomplete-proposal');
 expect(friendlyFailure(new AssistantFailure('assistant-confirmation','save'),'ar')).toContain('ربما');
});
it('keeps the last confirmed IDs after failed follow-up turns instead of resetting context at the error',()=>{
 const turns=[{role:'user' as const,text:'Create card and section'},{role:'assistant' as const,text:'Saved',resolved:true,receipt:{changes:[{target:'sections' as const,id:'confirmed-section',scope:'personal',before:null,after:{name:'S'}},{target:'projects' as const,id:'confirmed-card',scope:'personal',before:null,after:{name:'C',sectionId:'confirmed-section'}}]}},{role:'user' as const,text:'delete them',failed:true},{role:'assistant' as const,text:'Failed',failed:true,resolved:true}];
 const history=conversationHistory(turns);
 expect(history).toHaveLength(2);expect(history[1].content).toContain('confirmed-section');expect(history[1].content).toContain('confirmed-card');
});

it('retains the last saved card reference after a plain clarification without replaying its actions',()=>{
 const turns=[{role:'user' as const,text:'اضف بطاقة باسم عمار'},{role:'assistant' as const,text:'تم الحفظ',resolved:true,receipt:{changes:[{target:'projects' as const,scope:'personal',id:'saved-ammar',before:null,after:{name:'عمار'}}]}},{role:'user' as const,text:'ضعها في قسم ادم'},{role:'assistant' as const,text:'أي بطاقة تقصد؟',resolved:true},{role:'user' as const,text:'عمار'}];
 const history=conversationHistory(turns),reference=JSON.parse(history.find(t=>t.role==='assistant')!.content);
 expect(reference.saved).toEqual([{target:'projects',scope:'personal',id:'saved-ammar',exists:true,name:'عمار'}]);expect(reference.proposal).toBeUndefined();expect(history.at(-1)?.content).toBe('عمار');
});
it('an undone creation reference correctly says that the created card no longer exists',()=>{
 const history=conversationHistory([{role:'user',text:'Create card'},{role:'assistant',text:'Undone',resolved:true,undone:true,receipt:{changes:[{target:'projects',scope:'personal',id:'gone',before:null,after:{name:'Card'}}]}}]);
 expect(JSON.parse(history[1].content).saved[0].exists).toBe(false);
});
it('keeps an original unsaved card and all details after an explanation and a missing-section clarification',()=>{
 const message='اضف بطاقة عمار لقسم ادم مع ملاحظة مروان ورابط أول فيديو يوتيوب باسم ادم وضع البطاقة بتاريخ 28 الشهر';
 const draft={text:'Review',actions:[{target:'projects' as const,action:'create' as const,id:'new',values:{name:'عمار',description:'مروان',dueDate:'2026-10-28'}}],controls:[],files:[]};
 const turns=[{role:'user' as const,text:message},{role:'assistant' as const,text:'Review',reply:draft,changes:[{target:'projects' as const,scope:'personal',id:'new-id',before:null,after:{name:'عمار'}}]},{role:'user' as const,text:'لماذا لم تضعها في قسم ادم؟'},{role:'assistant' as const,text:'القسم غير موجود؛ هل تريد إنشاءه؟',reply:{text:'Section missing',actions:[],controls:[],files:[]}},{role:'user' as const,text:'قسم جديد باسم ادم ضع فيه البطاقة بالتفاصيل التي طلبتها منك'}];
 const history=conversationHistory(turns);expect(history).toHaveLength(5);expect(history[0].content).toBe(message);expect(JSON.parse(history[1].content).proposal.actions[0].values).toEqual(draft.actions[0].values);expect(JSON.parse(history[3].content).status).toBe('answered');
});
it('does not label ordinary chat answers as cancellation or drop the earlier request',()=>{
 const history=conversationHistory([{role:'user',text:'Add Ammar with note Marwan'},{role:'assistant',text:'What section?',resolved:true},{role:'user',text:'Adam'}]);expect(history[0].content).toContain('Ammar');expect(JSON.parse(history[1].content).status).toBe('answered');
});
it('records an explicit cancellation separately from a replaced draft',()=>{
 const reply={text:'Review',actions:[],controls:[],files:[]};const history=conversationHistory([{role:'assistant',text:'Old draft',reply,resolved:true,superseded:true},{role:'assistant',text:'Cancelled',reply,resolved:true,cancelled:true}]);expect(history.map(t=>JSON.parse(t.content).status)).toEqual(['superseded','cancelled']);
});