import type { Language } from '../translations';
import { backgrounds, themes, readBackground, readTheme, saveBackground, saveTheme } from '../lib/theme';
import { readSleepEnabled, saveSleepEnabled } from '../lib/idleSleep';
import { readPreferences, patchPreferences } from '../lib/workflowPreferences';
import { auth, db } from '../lib/firebase';
import { saveName } from '../lib/profile';
import { assistantAccountContext } from './accountContext';
import { parseControls } from './controlContract';
import type { AssistantControl,ControlPlan,ControlResult } from './controlContract';
export type { AssistantControl,ControlPlan,ControlResult } from './controlContract';
const invalid=()=>{throw new Error('assistant-invalid');};
export class AssistantControls {
 private readonly uid:string;
 constructor(uid:string){this.uid=uid;}
 private check(){if(auth?.currentUser?.uid!==this.uid)throw new Error('account-changed');}
 context(language:Language){this.check();return {...assistantAccountContext(auth?.currentUser||null,this.uid),appearance:{theme:readTheme(this.uid),background:readBackground(this.uid)},language:{language},sleep:{enabled:readSleepEnabled(this.uid)},workflow:readPreferences(this.uid)};}
 plan(controls:AssistantControl[],language:Language,scopeIds:string[]):ControlPlan[]{
  this.check();const state=structuredClone(this.context(language));
  return parseControls(controls).map(control=>{
   if(control.kind==='navigate'&&control.values.groupId&&!scopeIds.includes(String(control.values.groupId)))return invalid();
   if(control.kind==='navigate'||control.kind==='tour')return {control,before:{},after:control.values};
   const before={...state[control.kind]},after={...before,...control.values};
   Object.assign(state[control.kind],after);
   return {control,before,after};
  });
 }
 async apply(plans:ControlPlan[]):Promise<ControlResult[]>{
  const results:ControlResult[]=[];
  for(const plan of plans){
   try{
    this.check();const {kind,values}=plan.control;
    if(kind==='navigate'){const query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(!['page','groupId'].includes(key))query.set(key,String(value));location.hash='/'+String(values.page)+(values.groupId?'/'+String(values.groupId):'')+(query.size?'?'+query.toString():'');}
    else if(kind==='tour'){window.dispatchEvent(new Event('replay-welcome-tour'));}
    else{
     const current=this.context((localStorage.getItem('language')||'en') as Language)[kind];
     for(const key of Object.keys(values))if(JSON.stringify(current[key as keyof typeof current])!==JSON.stringify(plan.before[key]))throw new Error('assistant-conflict');
     if(kind==='profile'){
      if(!db||!auth?.currentUser)throw new Error('account-changed');
      await saveName(db,auth.currentUser,String(values.displayName));
     }else if(kind==='workflow'){
      if(values.desktop===true&&(!('Notification' in window)||Notification.permission!=='granted'))throw new Error('assistant-browser-permission');
      await patchPreferences(this.uid,plan.before as ReturnType<typeof readPreferences>,values);
     }else if(kind==='appearance'){
      // Probe storage before using the regular setters, which allow session-only fallbacks.
      const key=`assistant-storage-check:${this.uid}`;localStorage.setItem(key,'ok');localStorage.removeItem(key);
      if(values.theme!==undefined)saveTheme(this.uid,values.theme as typeof themes[number]);
      if(values.background!==undefined)saveBackground(this.uid,values.background as typeof backgrounds[number]);
      window.dispatchEvent(new Event('appearance-changed'));
     }else if(kind==='language'){
      localStorage.setItem('language',String(values.language));window.dispatchEvent(new CustomEvent('language-changed',{detail:values.language}));
     }else{localStorage.setItem(`idle-sleep:${this.uid}`,values.enabled?'on':'off');saveSleepEnabled(this.uid,values.enabled as boolean);}
     this.check();const saved=this.context((localStorage.getItem('language')||'en') as Language)[kind];
     for(const key of Object.keys(values))if(JSON.stringify(saved[key as keyof typeof saved])!==JSON.stringify(values[key]))throw new Error('assistant-confirmation');
    }
    results.push({plan,ok:true});
   }catch(error){results.push({plan,ok:false,reason:(error as Error).message});break;}
  }
  return results;
 }
}
