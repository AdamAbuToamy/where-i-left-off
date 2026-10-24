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
