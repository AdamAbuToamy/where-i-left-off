import {AssistantFailure} from './failure';
import {failureWords,failureMessage} from './failureWords';
import {coverageHint} from './coverageHint';
import { AssistantProposalClient } from './proposalClient';
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Language } from '../translations';
import { auth } from '../lib/firebase';
import { assistantRequest } from './api';
import type { LocalAssistantModel } from './localModel';
import { assistantValidationHint } from './validationHint';
import { proposalStatus } from './replyStatus';
import { parseAssistantReply, planAssistantProposal, resolveProposalControls } from './actions';
import type { AssistantReply, Change } from './actions';
import { AssistantRepository, assistantContext } from './assistantRepository';
import type { AssistantSnapshot, AssistantReceipt } from './assistantRepository';
import { assistantWords, assistantFieldNames } from './words';
import AssistantWaiting, { AssistantMark } from './AssistantWaiting';
import type { AssistantPhase } from './AssistantWaiting';
import { AssistantControls } from './controls';
import type { ControlPlan,ControlResult } from './controls';
import { controlWords } from './controlWords';
import { AssistantChangeReveal } from './changeReveal';
import { assistantCapabilities } from './capabilities';
import { assistantPresentation } from './presentationWords';
import './assistant.css';
type Message={role:'user'|'assistant';text:string;reply?:AssistantReply;changes?:Change[];snapshot?:AssistantSnapshot;receipt?:AssistantReceipt;controlPlans?:ControlPlan[];controlResults?:ControlResult[];resolved?:boolean;undone?:boolean};
function download(name:string,content:string){const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AssistantWidget({user,language}:{user:User;language:Language}){
 const [open,setOpen]=useState(false),[present,setPresent]=useState(false),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [failure,setFailure]=useState<AssistantFailure|null>(null),[health,setHealth]=useState<{provider:string;protocol:string}|null>(null),[copied,setCopied]=useState(false);
 const fw=failureWords[language];
 const button=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null),mounted=useRef(true),lock=useRef(false);
 const [repository]=useState(()=>new AssistantRepository(user.uid));
 const [controls]=useState(()=>new AssistantControls(user.uid));
 const [reveal]=useState(()=>new AssistantChangeReveal());
 useEffect(()=>()=>reveal.dispose(),[reveal]);
 useEffect(()=>{document.body.classList.toggle('assistant-docked',open);const timer=!open?setTimeout(()=>setPresent(false),240):undefined;return()=>{clearTimeout(timer);document.body.classList.remove('assistant-docked');};},[open]);
 const ct=controlWords[language];
 const t=assistantWords[language],ui=assistantPresentation[language];
 const [phase,setPhase]=useState<AssistantPhase|null>(null);
 const conversation=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open&&conversation.current)conversation.current.scrollTop=conversation.current.scrollHeight;},[messages,phase,open]);
 const local=useRef<LocalAssistantModel|null>(null);
 const [preferLocal,setPreferLocal]=useState(()=>{try{return localStorage.getItem('wilo-assistant-local')==='true';}catch{return false;}});
 const [localReady,setLocalReady]=useState(false),[localLoading,setLocalLoading]=useState(false),[progress,setProgress]=useState(0);
 useEffect(()=>()=>{local.current?.dispose();local.current=null;},[]);
 async function activateLocal(){
  if(lock.current)return;lock.current=true;setBusy(true);setPhase('model');setLocalLoading(true);setError('');
  try{const {LocalAssistantModel}=await import('./localModel');const engine=new LocalAssistantModel();local.current=engine;await engine.load(f=>{if(mounted.current)setProgress(f);});if(!mounted.current){engine.dispose();return;}setLocalReady(true);setPreferLocal(true);try{localStorage.setItem('wilo-assistant-local','true');}catch{/* Device storage is optional. */}}
  catch(e){local.current?.dispose();local.current=null;if(mounted.current)report(e);}
  finally{lock.current=false;if(mounted.current){setLocalLoading(false);setBusy(false);setPhase(null);}}
 }
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(open&&present)input.current?.focus();else if(!open&&present)button.current?.focus();},[open,present]);
 function useCloud(){local.current?.dispose();local.current=null;setLocalReady(false);setPreferLocal(false);try{localStorage.removeItem('wilo-assistant-local');}catch{/* Optional preference. */}}
 function openPanel(){setPresent(true);setOpen(true);}
 function close(){setOpen(false);button.current?.focus();}
 function report(e:unknown,stage:'request'|'save'='request'){const failed=AssistantFailure.from(e,stage);setFailure(failed);setCopied(false);e=failed;const code=(e as {code?:string}).code?.replace(/^firestore\//,'')||(e as Error).message;setError(failed.stage==='read'?failureMessage(failed,language,fw.stage.read+': '+t.unavailable):code==='permission-denied'?t.permission:code==='assistant-confirmation'?t.confirmation:code==='ai-rate-limit'?t.rate:code==='ai-provider-context'?t.providerContext:code==='ai-provider-access'?t.providerAccess:code==='ai-provider-limit'?t.providerLimit:code==='assistant-local-unsupported'?t.localUnsupported:code==='assistant-local-context'?t.localContext:/^assistant-local-/.test(code)?t.localLoadError:code==='ai-incomplete-proposal'||code==='ai-intent-format'?[t.incomplete,coverageHint(e,language)].filter(Boolean).join(' '):code==='ai-not-configured'?t.setup:/ai-(?:user|daily)-limit/.test(code)?t.limit:code==='assistant-format'||code==='ai-response-too-large'?t.format:code==='assistant-invalid'?[t.invalid,assistantValidationHint(e,language)].filter(Boolean).join(' '):code==='assistant-conflict'?t.conflict:code==='assistant-pending'?t.pending:code==='assistant-linked-reminder'?t.linked:code==='assistant-too-large'?t.large:failureMessage(failed,language,t.unavailable));}
 async function send(){
  if(lock.current||!text.trim())return;
  const message=text.trim();lock.current=true;setBusy(true);setPhase('reading');setError('');setFailure(null);setHealth(null);setCopied(false);
  setMessages(old=>[...old.slice(-15),{role:'user',text:message}]);setText('');
  try{
   const snapshot=await repository.read().catch(error=>{throw AssistantFailure.from(error,'read');});
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   const request={mode:'workspace',message,language,context:JSON.stringify({...JSON.parse(assistantContext(snapshot,message)),controls:controls.context(language),capabilities:assistantCapabilities}),history:messages.slice(-4).map(m=>({role:m.role,content:(m.text+(m.resolved?' [proposal resolved; do not repeat]':'')).slice(0,1200)}))};
   if(request.context.length>44000||JSON.stringify(request).length>65000)throw new Error('assistant-too-large');
   if(preferLocal&&!localReady)throw new Error('assistant-local-not-ready');
   setPhase('thinking');
   const validate=(text:string)=>{
    const reply=parseAssistantReply(text);
    if(request.mode==='workspace'&&(reply.actions.length||reply.controls?.length)&&!reply.tasks?.length)throw new Error('assistant-invalid',{cause:new Error('assistant-task-coverage')});
    let changes:Change[];
    try{changes=planAssistantProposal(snapshot.data,reply.actions);}catch(e){if((e as Error).message==='assistant-linked-reminder')throw e;throw new Error('assistant-invalid',{cause:e});}
    const controlPlans=controls.plan(resolveProposalControls(snapshot.data,reply.actions,changes,reply.controls||[]),language,snapshot.data.scopes.map(s=>s.id));
    return {reply,controlPlans,changes};
   };
   const prepared=localReady?validate((await local.current!.answer(request)).text):await new AssistantProposalClient(async(payload,timeout)=>{
    if(!mounted.current||auth?.currentUser?.uid!==user.uid)throw new Error('account-changed');
    return assistantRequest<{text:string}>(payload,timeout);
   }).prepare(request,validate,()=>{if(mounted.current)setPhase('repairing');});
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   const {reply,controlPlans,changes}=prepared;
   setMessages(old=>[...old,{role:'assistant',text:changes.length||controlPlans.length?ui.reviewReady:proposalStatus(reply.text,changes,language),reply,changes,snapshot,controlPlans}]);
  }catch(e){if(mounted.current){report(e);setText(current=>current||message);}}
  finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 async function apply(index:number,undo=false){
  if(lock.current)return;lock.current=true;setBusy(true);setPhase(undo?'undoing':'saving');setError('');
  const m=messages[index];
  try{
   let receipt:AssistantReceipt|undefined;let controlResults:ControlResult[]=[];
   if(undo)await repository.undo(m.receipt!);
   else {if(m.changes?.length)receipt=await repository.apply(m.snapshot!,m.changes);controlResults=await controls.apply(m.controlPlans||[]);}
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   setMessages(old=>old.map((value,i)=>i===index?{...value,resolved:true,undone:undo,receipt,controlResults:undo?value.controlResults:controlResults,text:undo?t.undone+(value.controlPlans?.length?' '+ct.dataOnlyUndo:''):(receipt||controlResults.some(r=>r.ok)?t.applied:'')}:value));
   if(undo&&m.receipt?.changes.length){const first=m.receipt.changes[0];showChange({...first,before:first.after,after:first.before});}
   if(!undo){if(receipt?.changes.length)showChange(receipt.changes[0],controlResults.some(r=>r.ok&&r.plan.control.kind==='navigate'));else{const succeeded=controlResults.filter(r=>r.ok).map(r=>r.plan);if(succeeded.length){reveal.showControls(succeeded);if(window.matchMedia?.('(max-width: 1099px)').matches)close();}}}
  }catch(e){if(mounted.current)report(e,'save');}
  finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 function showChange(change:Change,preserveView=false){reveal.show(change,preserveView);if(window.matchMedia?.('(max-width: 1099px)').matches)close();}
 async function checkConnection(){
  if(lock.current)return;lock.current=true;setBusy(true);setPhase('reading');setCopied(false);
  try{await repository.read().catch(error=>{throw AssistantFailure.from(error,'read');});const result=await assistantRequest<{status:string;provider:string;protocol:string;inferenceTested:boolean}>({mode:'health'},20000);
   if(result.status!=='ready'||!['groq','cloudflare','gemini'].includes(result.provider)||result.inferenceTested!==false||!/^wilo-assistant-[a-z0-9-]{1,40}$/.test(result.protocol))throw new AssistantFailure('assistant-server-response','request');
   if(mounted.current)setHealth({provider:result.provider,protocol:result.protocol});
  }catch(e){if(mounted.current)report(e);}finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 async function copyFailure(){
  if(!failure)return;const report=JSON.stringify({client:'wilo-assistant-connection-v2',failure:failure.diagnostic(),...(health?{connection:health}:{})},null,2);
  try{await navigator.clipboard.writeText(report);setCopied(true);}catch{download('wilo-assistant-diagnostic.json',report);}
 }
 function name(value:unknown,snapshot?:AssistantSnapshot){
  const item=value as {name?:string;title?:string;room?:string;courseId?:string;day?:number;start?:string;end?:string}|null;
  if(item?.name||item?.title)return item.name||item.title||'';
  if(item?.courseId&&item.start&&item.end){const course=snapshot?.data.study.courses.find(c=>c.id===item.courseId)?.name||item.courseId;const day=Number.isInteger(item.day)?new Intl.DateTimeFormat(language,{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,9,18+item.day!))):'';return `${course} · ${day} · ${item.start}–${item.end}`;}
  return item?.room||'';
 }
 function display(value:unknown,snapshot:AssistantSnapshot){
  const labels=new Map([...snapshot.data.study.courses,...snapshot.data.scopes.flatMap(s=>s.sections)].map(x=>[x.id,x.name]));
  if(typeof value==='string')return labels.get(value)||value;
  if(Array.isArray(value))return value.map(v=>typeof v==='string'?(labels.get(v)||v):JSON.stringify(v)).join(', ');
  return JSON.stringify(value)??'—';
 }
 return <div className={"assistant-root"+(open?" is-open":"")} dir={language==='en'?'ltr':'rtl'}>
  <button ref={button} className="assistant-launcher" aria-label={t.open} aria-expanded={open} aria-controls="wilo-assistant" onClick={()=>open?close():openPanel()}><span className="assistant-launcher-mark"><AssistantMark/></span><span>{t.name}</span><span className="assistant-launcher-dot" aria-hidden="true"/></button>
  {present&&<section id="wilo-assistant" role="dialog" aria-label={t.name} className={"assistant-panel"+(!open?" is-closing":"")} inert={!open} aria-busy={busy} onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <header className="assistant-header"><span className="assistant-brand-mark"><AssistantMark/></span><div className="assistant-heading"><strong>{t.name}</strong><span><i aria-hidden="true"/>{localReady?ui.local:preferLocal?ui.notReady:ui.cloud}</span></div><button type="button" className="assistant-close" aria-label={t.close} onClick={close}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button></header>
   {preferLocal&&!localReady&&<div className="assistant-intro"><p>{ui.notReady}</p><button type="button" disabled={busy} onClick={useCloud}>{t.remote}</button></div>}
   <div ref={conversation} className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">{!messages.length&&<div className="assistant-intro"><span className="assistant-intro-emblem"><AssistantMark/></span><span className="assistant-intro-title">{ui.welcome}</span><p>{ui.placeholder}</p></div>}{messages.map((m,i)=><article className={'assistant-message is-'+m.role} key={i}><p dir="auto">{m.text}</p>
    {m.reply?.tasks?.some(task=>task.outcome==='needs-input'||task.outcome==='unsupported')&&<details className="assistant-followups"><summary>{ui.followups}</summary>{m.reply.tasks.filter(task=>task.outcome==='needs-input'||task.outcome==='unsupported').map((task,index)=><p key={index}>{task.detail||task.title}</p>)}</details>}
    {m.reply?.files.map((file,index)=><button type="button" key={index} onClick={()=>download(file.name,file.content)}>{t.download}: {file.name}</button>)}
    {((m.changes?.length||0)+(m.controlPlans?.length||0))>0&&!m.resolved?<div className="assistant-proposal"><strong>{t.review} ({(m.changes?.length||0)+(m.controlPlans?.length||0)})</strong>{m.changes?.map((c,index)=>{
      const before=(c.before||{}) as Record<string,unknown>,after=(c.after||{}) as Record<string,unknown>;
      const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!['id','revision'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));
      return <details key={index}><summary>{t.titles[c.target]} · {c.scope==='personal'?t.personal:m.snapshot!.data.scopes.find(s=>s.id===c.scope)?.name}: {name(c.after,m.snapshot)||name(c.before,m.snapshot)}{!c.before?' · '+t.create:!c.after?' · '+t.remove:''}</summary>{keys.map(key=><div className="assistant-diff" key={key}><strong>{assistantFieldNames[key]?.[language==='ar'?0:language==='en'?1:2]||key}</strong><span>{t.before}: <bdi>{display(before[key],m.snapshot!)}</bdi></span><span>{t.after}: <bdi>{display(after[key],m.snapshot!)}</bdi></span></div>)}</details>;
     })}{m.controlPlans?.map((plan,index)=><details key={'control-'+index}><summary>{ct.kind[plan.control.kind]}</summary><p dir="auto">{JSON.stringify(plan.control.values)}</p></details>)}<button type="button" disabled={busy} onClick={()=>void apply(i)}>{t.apply}</button><button type="button" disabled={busy} onClick={()=>setMessages(old=>old.map((v,index)=>index===i?{...v,resolved:true}:v))}>{t.cancel}</button></div>:null}
    {!!m.receipt?.changes.length&&!m.undone&&<details className="assistant-saved"><summary>{ui.showChanges} ({m.receipt.changes.length})</summary>{m.receipt.changes.map((change,index)=><button type="button" key={index} onClick={()=>showChange(change)}>{name(change.after,m.snapshot)||name(change.before,m.snapshot)||t.titles[change.target]} <span aria-hidden="true">↗</span></button>)}</details>}
    {m.controlResults&&m.controlPlans?.map((plan,index)=>{const result=m.controlResults![index];return result?.ok?null:<p key={'result-'+index} role={result&&!result.ok?'alert':undefined}>{ct.kind[plan.control.kind]}: {result?(result.ok?ct.done:ct.failed+(result.reason==='assistant-browser-permission'?' · '+ct.permission:' · '+(result.reason==='assistant-conflict'?t.conflict:t.unavailable))):ct.pending}</p>;})}
    {m.receipt&&!m.undone&&!m.receipt.changes.some(c=>!c.before&&['projects','sections'].includes(c.target))&&<button type="button" disabled={busy} onClick={()=>void apply(i,true)}>{m.controlPlans?.length?ct.dataOnlyUndo:t.undo}</button>}
   </article>)}{busy&&phase&&<AssistantWaiting phase={phase} language={language} progress={progress}/>}</div>
   <form onSubmit={e=>{e.preventDefault();void send();}}>
    <label>{t.input}<textarea ref={input} value={text} maxLength={6000} rows={2} placeholder={ui.placeholder} onChange={e=>setText(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}{failure&&<details className="assistant-privacy"><summary>{fw.details}</summary><p>{fw.stage[failure.stage]} · {failure.code}{failure.status?' · HTTP '+failure.status:''}</p>{failure.requestId&&<p dir="ltr">{failure.requestId}</p>}{failure.providerFailure&&<pre dir="ltr">{JSON.stringify(failure.providerFailure,null,2)}</pre>}<button type="button" disabled={busy} onClick={()=>void checkConnection()}>{fw.check}</button><button type="button" onClick={()=>void copyFailure()}>{copied?fw.copied:fw.copy}</button>{health&&<p role="status">{fw.ready} · {health.provider}</p>}</details>}
    <div className="assistant-actions"><button className="primary-button assistant-send" disabled={busy||!text.trim()}><svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m10 15 0-10m-4 4 4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>{busy?t.busy:t.send}</button><button type="button" onClick={()=>{setMessages([]);setError('');setFailure(null);setHealth(null);}} disabled={busy}>{t.clear}</button></div>
    <details className="assistant-preferences"><summary>{ui.options}<span className="assistant-chevron" aria-hidden="true"/></summary><div className="assistant-preferences-body">    <details className="assistant-model-options"><summary><span className="assistant-option-icon" aria-hidden="true">◈</span>{ui.settings}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{ui.localCaution}</p><p>{t.localInfo}</p>{localReady?<button type="button" disabled={busy} onClick={useCloud}>{t.remote}</button>:<button type="button" disabled={busy} onClick={()=>void activateLocal()}>{localLoading?`${t.localLoading} ${Math.round(progress*100)}%`:t.local}</button>}{preferLocal&&!localReady&&<button type="button" disabled={busy} onClick={useCloud}>{t.remote}</button>}</details>
    <details className="assistant-privacy"><summary>{ct.title}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{language==='ar'?'يمكنني تعديل البطاقات والأقسام والكورسات والمهام والجدول، وضبط المظهر واللغة والسكون والتنظيم وفتح الصفحات. الأذونات وكلمة المرور وحذف الحساب وإدارة أعضاء المجموعات تتطلب نماذجها الأصلية. يمكنك طلب عدة مهام معًا؛ لا يُعلن الحفظ قبل تأكيده.':language==='he'?'ניתן לערוך כרטיסים, מדורים, קורסים, משימות ומערכת שעות, לשנות מראה, שפה והעדפות ולפתוח עמודים. הרשאות, סיסמאות, מחיקת חשבון וניהול חברים מתבצעים בטפסים הקיימים. אפשר לבקש כמה משימות יחד.':'Edit cards, sections, courses, tasks and timetable; change appearance, language, sleep and workflow; open pages. Permissions, passwords, account deletion and group membership use their existing forms. You can request several tasks together.'}</p></details>
    <details className="assistant-privacy"><summary>{ui.privacy}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{preferLocal?t.localReady:t.privacy}</p></details>
</div></details>
   </form>
  </section>}
 </div>;
}
