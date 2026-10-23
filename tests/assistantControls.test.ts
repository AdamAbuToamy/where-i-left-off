// @vitest-environment jsdom
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const runtime=vi.hoisted(()=>({auth:{currentUser:{uid:'alice'}},preferences:{autoArchive:false,reminders:true,desktop:false,reviewDays:30},save:vi.fn()}));
vi.mock('../src/lib/firebase',()=>({auth:runtime.auth}));
vi.mock('../src/lib/workflowPreferences',()=>({readPreferences:()=>runtime.preferences,patchPreferences:runtime.save}));
import {AssistantControls} from '../src/assistant/controls';
import {parseControls} from '../src/assistant/controlContract';
beforeEach(()=>{localStorage.clear();localStorage.setItem('language','en');runtime.auth.currentUser={uid:'alice'};runtime.save.mockReset();});
afterEach(()=>vi.unstubAllGlobals());
it('validates capability names and values rather than executing arbitrary selectors, code or paths',()=>{
 for(const raw of [[{kind:'eval',values:{code:'x'}}],[{kind:'navigate',values:{page:'https://evil.test'}}],[{kind:'appearance',values:{theme:'unknown'}}],[{kind:'sleep',values:{enabled:'false'}}],[{kind:'workflow',values:{reviewDays:1}}],[{kind:'navigate',values:{page:'settings',groupId:'g'}}]])expect(()=>parseControls(raw)).toThrow('assistant-invalid');
});
it('persists and verifies appearance, language and sleep, then reads them after recreating the adapter',async()=>{
 const executor=new AssistantControls('alice');const plans=executor.plan([{kind:'appearance',values:{theme:'olive',background:'paper'}},{kind:'language',values:{language:'he'}},{kind:'sleep',values:{enabled:false}}],'en',['personal']);
 expect((await executor.apply(plans)).every(r=>r.ok)).toBe(true);
 expect(new AssistantControls('alice').context('he')).toMatchObject({appearance:{theme:'olive',background:'paper'},language:{language:'he'},sleep:{enabled:false}});
});
it('rejects stale device settings and stops later controls without claiming them completed',async()=>{
 const executor=new AssistantControls('alice'),plans=executor.plan([{kind:'appearance',values:{theme:'olive'}},{kind:'sleep',values:{enabled:false}}],'en',['personal']);
 localStorage.setItem('site-theme:alice','rose');const results=await executor.apply(plans);
 expect(results).toHaveLength(1);expect(results[0]).toMatchObject({ok:false,reason:'assistant-conflict'});expect(localStorage.getItem('idle-sleep:alice')).toBeNull();
});
it('cannot open a foreign group or execute after an account change',async()=>{
 const executor=new AssistantControls('alice');expect(()=>executor.plan([{kind:'navigate',values:{page:'groups',groupId:'foreign'}}],'en',['personal'])).toThrow();
 const plans=executor.plan([{kind:'sleep',values:{enabled:false}}],'en',['personal']);runtime.auth.currentUser={uid:'bob'};expect((await executor.apply(plans))[0].ok).toBe(false);expect(localStorage.getItem('idle-sleep:alice')).toBeNull();
});
it('does not bypass browser permission when enabling desktop notifications',async()=>{
 vi.stubGlobal('Notification',{permission:'default'});const executor=new AssistantControls('alice'),plans=executor.plan([{kind:'workflow',values:{desktop:true}}],'en',['personal']);
 expect((await executor.apply(plans))[0]).toMatchObject({ok:false,reason:'assistant-browser-permission'});expect(runtime.save).not.toHaveBeenCalled();
});
it('opens only validated existing views and preserves literal search text as URL data',async()=>{
 const executor=new AssistantControls('alice');const plans=executor.plan([{kind:'navigate',values:{page:'personal',view:'week',filter:'upcoming',search:'x&filter=done'}},{kind:'navigate',values:{page:'university',tab:'schedule'}}],'en',['personal']);
 expect((await executor.apply(plans)).every(r=>r.ok)).toBe(true);expect(location.hash).toBe('#/university?tab=schedule');
 expect(()=>parseControls([{kind:'navigate',values:{page:'settings',tab:'schedule'}}])).toThrow();
});
