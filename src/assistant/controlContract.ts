import { backgrounds, themes } from '../lib/theme';
export type AssistantControl={kind:'appearance'|'language'|'sleep'|'workflow'|'navigate'|'tour';values:Record<string,unknown>};
export type ControlPlan={control:AssistantControl;before:Record<string,unknown>;after:Record<string,unknown>};
export type ControlResult={plan:ControlPlan;ok:boolean;reason?:string};
const fields={appearance:['theme','background'],language:['language'],sleep:['enabled'],workflow:['autoArchive','reminders','desktop','reviewDays'],navigate:['page','groupId','tab','courseId','view','filter','search','section','mine'],tour:[]};
const pages=['personal','resume','university','groups','settings','notifications','library','analytics','logs','support'];
const invalid=()=>{throw new Error('assistant-invalid');};
export function parseControls(raw:unknown):AssistantControl[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>20)invalid();
 return (raw as unknown[]).map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
  const c=value as AssistantControl;
  if(!Object.hasOwn(fields,c.kind)||Object.keys(c).some(k=>!['kind','values'].includes(k))||!c.values||typeof c.values!=='object'||Array.isArray(c.values))return invalid();
  const v=c.values;
  if(Object.keys(v).some(key=>!(fields[c.kind] as string[]).includes(key)))return invalid();
  if(c.kind!=='tour'&&!Object.keys(v).length)return invalid();
  if('theme' in v&&!themes.includes(v.theme as never)||'background' in v&&!backgrounds.includes(v.background as never))return invalid();
  if(c.kind==='language'&&!['ar','en','he'].includes(String(v.language)))return invalid();
  for(const key of ['enabled','autoArchive','reminders','desktop'])if(key in v&&typeof v[key]!=='boolean')return invalid();
  if('reviewDays' in v&&![7,14,30,60,90].includes(v.reviewDays as number))return invalid();
  if(c.kind==='navigate'&&(!pages.includes(String(v.page))||v.groupId!==undefined&&(typeof v.groupId!=='string'||!/^[-\w]{1,100}$/.test(v.groupId)||v.page!=='groups')))return invalid();
  if(c.kind==='navigate'){
   if('tab' in v&&(v.page!=='university'||!['overview','schedule','map'].includes(String(v.tab))))return invalid();
   if('courseId' in v&&(v.page!=='university'||typeof v.courseId!=='string'||!/^[-\w]{1,100}$/.test(v.courseId)))return invalid();
   if('view' in v&&!(v.page==='library'?['archive','trash','review','ideas']:['personal','groups'].includes(String(v.page))?['board','week']:[]).includes(String(v.view)))return invalid();
   for(const key of ['filter','search','section','mine'])if(key in v&&!['personal','groups'].includes(String(v.page)))return invalid();
   if('filter' in v&&!['all','today','waiting','overdue','upcoming','active','later','done','ideas'].includes(String(v.filter)))return invalid();
   if('search' in v&&(typeof v.search!=='string'||v.search.length>300))return invalid();
   if('section' in v&&(typeof v.section!=='string'||!/^[-\w]{1,100}$/.test(v.section)))return invalid();
   if('mine' in v&&typeof v.mine!=='boolean')return invalid();
  }
  return {kind:c.kind,values:{...v}};
 });
}
