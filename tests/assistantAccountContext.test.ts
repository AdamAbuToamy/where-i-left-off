// @vitest-environment jsdom
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({
 user:{uid:'alice',displayName:'Alice Example',email:'alice@example.test',emailVerified:true,refreshToken:'secret-refresh',stsTokenManager:{accessToken:'secret-access'}},
 auth:{currentUser:null as null|{uid:string;displayName:string;email:string;emailVerified:boolean}},
 saveName:vi.fn(),db:{},
}));
vi.mock('../src/lib/firebase',()=>({auth:state.auth,db:state.db}));
vi.mock('../src/lib/profile',()=>({saveName:state.saveName}));
vi.mock('../src/lib/workflowPreferences',()=>({readPreferences:()=>({autoArchive:false,reminders:true,desktop:false,reviewDays:30}),patchPreferences:vi.fn()}));
import {AssistantControls} from '../src/assistant/controls';
import {parseControls} from '../src/assistant/controlContract';
import {assistantAccountContext} from '../src/assistant/accountContext';
import {workspaceOverview} from '../push-worker/src/assistantContext.mjs';
import {readWorkspaceToolProposal} from '../push-worker/src/assistantTools.mjs';
beforeEach(()=>{
 localStorage.clear();state.user.displayName='Alice Example';state.auth.currentUser=state.user;
 state.saveName.mockReset().mockImplementation(async(_db,user,name)=>{user.displayName=name;});
 document.documentElement.style.setProperty('--site-primary','#286b8e');
 location.hash='#/personal?token=must-not-copy';
});
afterEach(()=>{document.documentElement.removeAttribute('style');vi.unstubAllGlobals();});
it('exposes only current public identity, never Firebase secrets, arbitrary storage or route tokens',()=>{
 localStorage.setItem('secret','must-not-copy');
 const context=new AssistantControls('alice').context('en');
 expect(context.profile).toEqual({displayName:'Alice Example'});
 expect(context.account).toEqual({email:'alice@example.test',emailVerified:true,nameAvailable:true});
 expect(context.site.colors.primary).toBe('#286b8e');
 expect(context.site.availableThemes).toContain('ocean');
 expect(context.site.availableBackgrounds).toContain('grid');
 expect(JSON.stringify(context)).not.toMatch(/secret-refresh|secret-access|must-not-copy|stsTokenManager|refreshToken/);
 const overview=JSON.parse(workspaceOverview(JSON.stringify({controls:context,scopes:[],study:{}})));
 expect(overview.controls.profile.displayName).toBe('Alice Example');
});
it('never invents missing names or reuses identity after switching accounts',()=>{
 state.user.displayName='';
 expect(new AssistantControls('alice').context('en').account.nameAvailable).toBe(false);
 expect(new AssistantControls('alice').context('en').profile.displayName).toBe('');
 expect(()=>assistantAccountContext(state.user,'bob')).toThrow('account-changed');
 state.auth.currentUser=null;
 expect(()=>new AssistantControls('alice').context('en')).toThrow('account-changed');
});
it('proposes a name edit without writing, then uses the existing profile domain function on Apply',async()=>{
 const executor=new AssistantControls('alice');
 const plans=executor.plan([{kind:'profile',values:{displayName:'  New Name  '}}],'en',['personal']);
 expect(state.saveName).not.toHaveBeenCalled();
 expect(plans[0].after).toEqual({displayName:'New Name'});
 expect((await executor.apply(plans))[0].ok).toBe(true);
 expect(state.saveName).toHaveBeenCalledWith(state.db,state.user,'New Name');
 expect(executor.context('en').profile.displayName).toBe('New Name');
});
it('rejects stale profile proposals and account switching before any save',async()=>{
 const executor=new AssistantControls('alice');
 const plans=executor.plan([{kind:'profile',values:{displayName:'New Name'}}],'en',['personal']);
 state.user.displayName='Edited elsewhere';
 expect((await executor.apply(plans))[0]).toMatchObject({ok:false,reason:'assistant-conflict'});
 state.auth.currentUser={...state.user,uid:'bob'};
 expect((await executor.apply(plans))[0]).toMatchObject({ok:false,reason:'account-changed'});
 expect(state.saveName).not.toHaveBeenCalled();
});
it('verifies persisted name instead of claiming success when a save does not update it',async()=>{
 const executor=new AssistantControls('alice');
 state.saveName.mockResolvedValue(undefined);
 expect((await executor.apply(executor.plan([{kind:'profile',values:{displayName:'Unconfirmed'}}],'en',['personal'])))[0]).toMatchObject({ok:false,reason:'assistant-confirmation'});
});
it('forbids passwords, account deletion, email/role changes and arbitrary fields at both contracts',()=>{
 const forbidden=[
  {kind:'password',values:{password:'value'}},
  {kind:'deleteAccount',values:{}},
  {kind:'profile',values:{displayName:'Allowed',password:'value'}},
  {kind:'profile',values:{email:'other@example.test'}},
  {kind:'profile',values:{emailVerified:true}},
  {kind:'profile',values:{role:'admin'}},
 ];
 for(const control of forbidden){
  expect(()=>parseControls([control])).toThrow('assistant-invalid');
  expect(()=>readWorkspaceToolProposal(JSON.stringify({text:'Review',actions:[],controls:[control],files:[],tasks:[{title:'Change',outcome:'proposed',actionIndexes:[],controlIndexes:[0],detail:''}]}))).toThrow();
 }
 for(const displayName of ['', ' ', 'x'.repeat(101),false])expect(()=>parseControls([{kind:'profile',values:{displayName}}])).toThrow();
 expect(()=>readWorkspaceToolProposal(JSON.stringify({text:'Review',actions:[],controls:[{kind:'profile',values:{displayName:'Valid'}}],files:[],tasks:[{title:'Name',outcome:'proposed',actionIndexes:[],controlIndexes:[0],detail:''}]}))).not.toThrow();
});
