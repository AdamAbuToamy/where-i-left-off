import {motion,MotionConfig,useReducedMotion} from 'motion/react';
import {ArrowDown,ArrowUp,Check,Copy,Download,FileText,LoaderCircle,Square,X} from 'lucide-react';
import AssistantRichText from './AssistantRichText';
import {experienceWords} from './experienceWords';
import {downloadAssistantFile} from './pdfExport';

import {PollinationsAssistant} from './pollinationsClient';
import {pollinationsConnected,connectPollinations,disconnectPollinations} from './pollinationsAuth';
import {AssistantProposalClient} from './proposalClient';
import {validateWorkspaceReply} from './workspaceValidation';
import {conversationHistory} from './conversationHistory';
import {plainNumericText} from './safeText';
import {friendlyFailure} from './friendlyFailure';



import {AssistantFailure} from './failure';
import {failureWords,failureMessage} from './failureWords';
import {coverageHint} from './coverageHint';

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Language } from '../translations';
import { auth } from '../lib/firebase';


import { assistantValidationHint } from './validationHint';
import { proposalStatus } from './replyStatus';
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
type Message={role:'user'|'assistant';text:string;reply?:AssistantReply;changes?:Change[];snapshot?:AssistantSnapshot;receipt?:AssistantReceipt;controlPlans?:ControlPlan[];controlResults?:ControlResult[];resolved?:boolean;cancelled?:boolean;superseded?:boolean;undone?:boolean;failed?:boolean};
function download(name:string,content:string){const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AssistantWidget({user,language}:{user:User;language:Language}){
 const [open,setOpen]=useState(false),[present,setPresent]=useState(false),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [failure,setFailure]=useState<AssistantFailure|null>(null),[health,setHealth]=useState<{provider:string;protocol:string}|null>(null),[copied,setCopied]=useState(false);
 const reduced=useReducedMotion(),ux=experienceWords[language];
 const [exporting,setExporting]=useState<string|null>(null),[downloaded,setDownloaded]=useState<Set<string>>(()=>new Set()),[copiedReply,setCopiedReply]=useState<number|null>(null),[atBottom,setAtBottom]=useState(true);
 const followLatest=useRef(true);
 async function copyReply(index:number,content:string){try{await navigator.clipboard.writeText(content);setCopiedReply(index);}catch{setCopiedReply(null);setError(language==='ar'?'تعذّر نسخ الرد. حاول مجددًا.':language==='he'?'העתקת התשובה נכשלה. נסו שוב.':'Could not copy the reply. Try again.');}}


 async function saveFile(file:{name:string;content:string}){
  setExporting(file.name);try{await downloadAssistantFile(file,language);setDownloaded(old=>new Set([...old,file.name]));}catch{setError(language==='ar'?'تعذّر إنشاء الملف. حاول تنزيله مجددًا.':language==='he'?'לא ניתן ליצור את הקובץ. נסו להוריד שוב.':'Could not create the file. Try downloading it again.');}finally{setExporting(null);}
 }
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
 useEffect(()=>{if(open&&conversation.current&&followLatest.current)conversation.current.scrollTop=conversation.current.scrollHeight;},[messages,phase,open]);
 const [connected,setConnected]=useState(()=>pollinationsConnected(user.uid));
 const [cloud]=useState(()=>new PollinationsAssistant(user.uid));
 const requestGeneration=useRef(0),requestAbort=useRef<AbortController|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;requestGeneration.current++;requestAbort.current?.abort();};},[]);
 useEffect(()=>{if(open&&present)input.current?.focus();else if(!open&&present)button.current?.focus();},[open,present]);
 function stopRequest(){
  requestAbort.current?.abort();requestGeneration.current++;lock.current=false;setBusy(false);setPhase(null);
  setMessages(old=>[...old.map((m,i)=>i===old.length-1&&m.role==='user'?{...m,failed:true}:m),{role:'assistant',text:ux.stopped,failed:true,resolved:true}]);
 }
 function openPanel(){setPresent(true);setOpen(true);}
 function close(){if(phase!=='saving'&&phase!=='undoing'){requestAbort.current?.abort();requestGeneration.current++;lock.current=false;setBusy(false);setPhase(null);}setOpen(false);button.current?.focus();} function report(e:unknown,stage:'request'|'save'='request'){const failed=AssistantFailure.from(e,stage);setFailure(failed);setCopied(false);e=failed;const code=(e as {code?:string}).code?.replace(/^firestore\//,'')||(e as Error).message;setError(failed.stage==='read'?failureMessage(failed,language,fw.stage.read+': '+t.unavailable):code==='permission-denied'?t.permission:code==='assistant-conversation-full'?ui.conversationFull:code==='assistant-confirmation'?t.confirmation:code==='ai-rate-limit'?t.rate:code==='ai-provider-context'?t.providerContext:code==='ai-provider-access'?t.providerAccess:code==='ai-provider-limit'?t.providerLimit:code==='assistant-local-unsupported'?t.localUnsupported:code==='assistant-local-context'?t.localContext:/^assistant-local-/.test(code)?t.localLoadError:code==='ai-incomplete-proposal'||code==='ai-intent-format'?[t.incomplete,coverageHint(e,language)].filter(Boolean).join(' '):code==='ai-not-configured'?t.setup:/ai-(?:user|daily)-limit/.test(code)?t.limit:code==='assistant-format'||code==='ai-response-too-large'?t.format:code==='assistant-invalid'?[t.invalid,assistantValidationHint(e,language)].filter(Boolean).join(' '):code==='assistant-conflict'?t.conflict:code==='assistant-pending'?t.pending:code==='assistant-linked-reminder'?t.linked:code==='assistant-too-large'?failureMessage(failed,language,t.large):failureMessage(failed,language,t.unavailable));}
 async function send(override?:string){
  if(lock.current||!connected||!(override??text).trim())return;
  requestAbort.current?.abort();const controller=new AbortController();requestAbort.current=controller;const requestSignal=AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]);
  const generation=requestGeneration.current;
  const message=(override??text).trim();lock.current=true;setBusy(true);setPhase('thinking');setError('');setFailure(null);setHealth(null);setCopied(false);
  followLatest.current=true;setAtBottom(true);setMessages(old=>[...old,{role:'user',text:message}]);setText('');
  const progress=(state:'waiting'|'receiving')=>{if(mounted.current&&generation===requestGeneration.current)setPhase(state==='receiving'?'receiving':'thinking');};
  try{

   const first=await cloud.conversation({message,language,displayName:user.displayName||'',history:conversationHistory(messages)},requestSignal,progress);
   if(!mounted.current||generation!==requestGeneration.current||auth?.currentUser?.uid!==user.uid)return;
   if(typeof first.needsWorkspace!=='boolean'||typeof first.text!=='string')throw new Error('assistant-server-response');
   if(!first.needsWorkspace){setMessages(old=>[...old,{role:'assistant',text:first.text,resolved:true}]);return;}
   setPhase('reading');
   const snapshot=await repository.read().catch(error=>{throw AssistantFailure.from(error,'read');});
   if(!mounted.current||generation!==requestGeneration.current||auth?.currentUser?.uid!==user.uid)return;
   const request={mode:'workspace',contextMode:'local-snapshot' as const,message,language,...(first.functions?{functions:first.functions}:{}),...(first.outputFormat?{outputFormat:first.outputFormat}:{}),...(first.requirements?.length?{requirements:first.requirements}:{}),context:JSON.stringify({...JSON.parse(assistantContext(snapshot,message)),controls:controls.context(language),capabilities:assistantCapabilities}),history:conversationHistory(messages)};


   setPhase('thinking');
   const validate=(text:string)=>{
    const {reply,changes,controls:resolved}=validateWorkspaceReply(message,snapshot.data,text);
    const controlPlans=controls.plan(resolved,language,snapshot.data.scopes.map(s=>s.id));
    return {reply,controlPlans,changes};
   };

   const prepared=await new AssistantProposalClient(payload=>cloud.workspace(payload as Parameters<PollinationsAssistant['workspace']>[0],requestSignal,progress),async()=>{}).prepare(request,validate,()=>{if(mounted.current&&generation===requestGeneration.current)setPhase('repairing');});
   if(!mounted.current||generation!==requestGeneration.current||auth?.currentUser?.uid!==user.uid)return;
   const {reply,controlPlans,changes}=prepared;
   setMessages(old=>[...old.map(m=>(changes.length+controlPlans.length)>0&&m.role==='assistant'&&!m.resolved&&(((m.changes?.length||0)+(m.controlPlans?.length||0))>0||m.reply?.clarification)?{...m,resolved:true,superseded:true}:m),{role:'assistant',text:reply.tasks?.some(task=>task.outcome==='needs-input')?proposalStatus(reply.text,[],language):changes.length||controlPlans.length?ui.reviewReady:proposalStatus(reply.text,changes,language),reply,changes,snapshot,controlPlans}]);
  }catch(e){if(mounted.current&&generation===requestGeneration.current){const failed=AssistantFailure.from(e,'request');if(failed.code==='ai-provider-access'){disconnectPollinations(user.uid);setConnected(false);}setFailure(failed);setCopied(false);setError('');setMessages(old=>[...old.map((m,i)=>i===old.length-1&&m.role==='user'&&m.text===message?{...m,failed:true}:m),{role:'assistant',text:friendlyFailure(failed,language),resolved:true,failed:true}]);}}
  finally{if(generation===requestGeneration.current){lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}}
 }
 async function apply(index:number,undo=false){
  if(lock.current)return;lock.current=true;setBusy(true);setPhase(undo?'undoing':'saving');setError('');
  const m=messages[index];
  try{
   let receipt:AssistantReceipt|undefined;let controlResults:ControlResult[]=[];
   if(undo)await repository.undo(m.receipt!);
   else {if(m.changes?.some(c=>c.target==='projects'&&!c.after)&&!window.confirm(language==='ar'?'تأكيد أخير: حذف بطاقات سلة المهملات نهائيًا ولا يمكن استعادتها؟':language==='he'?'אישור סופי: למחוק לצמיתות את הכרטיסים ללא אפשרות שחזור?':'Final confirmation: permanently delete these Trash cards without recovery?'))return;if(m.changes?.length)receipt=await repository.apply(m.snapshot!,m.changes);controlResults=await controls.apply(m.controlPlans||[]);}
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   setMessages(old=>old.map((value,i)=>i===index?{...value,resolved:true,undone:undo,receipt,controlResults:undo?value.controlResults:controlResults,text:undo?t.undone+(value.controlPlans?.length?' '+ct.dataOnlyUndo:''):(receipt||controlResults.some(r=>r.ok)?t.applied:'')}:value));
   if(undo&&m.receipt?.changes.length){const first=m.receipt.changes[0];showChange({...first,before:first.after,after:first.before});}
   if(!undo){if(receipt?.changes.length)showChange(receipt.changes[0],controlResults.some(r=>r.ok&&r.plan.control.kind==='navigate'));else{const succeeded=controlResults.filter(r=>r.ok).map(r=>r.plan);if(succeeded.length){reveal.showControls(succeeded);if(window.matchMedia?.('(max-width: 1099px)').matches)close();}}}
  }catch(e){if(mounted.current)report(e,'save');}
  finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 function showChange(change:Change,preserveView=false){reveal.show(change,preserveView);if(window.matchMedia?.('(max-width: 1099px)').matches)close();}
 async function checkConnection(){
  if(lock.current)return;
  lock.current=true;setBusy(true);setHealth(null);
  const controller=new AbortController(),generation=requestGeneration.current;requestAbort.current=controller;
  try{
   await repository.read().catch(error=>{throw AssistantFailure.from(error,'read');});
   const reply=await cloud.conversation({message:'Reply briefly with OK.',language:'en',history:[]},controller.signal);
   if(reply.needsWorkspace||!reply.text.trim())throw new Error('assistant-server-response');
   if(mounted.current&&generation===requestGeneration.current&&auth?.currentUser?.uid===user.uid)setHealth({provider:'Pollinations',protocol:'native-tools-stream'});
  }catch(error){if(mounted.current&&generation===requestGeneration.current)report(error);}
  finally{if(mounted.current&&generation===requestGeneration.current){lock.current=false;setBusy(false);}}
 } async function copyFailure(){
  if(!failure)return;const report=JSON.stringify({client:'wilo-assistant-connection-v2',failure:failure.diagnostic(),timings:cloud.timings?.(),...(health?{connection:health}:{})},null,2);
  try{await navigator.clipboard.writeText(report);setCopied(true);}catch{download('wilo-assistant-diagnostic.json',report);}
 }
 function name(value:unknown,snapshot?:AssistantSnapshot){
  const item=value as {name?:string;title?:string;room?:string;courseId?:string;day?:number;start?:string;end?:string}|null;
  if(item?.name||item?.title)return plainNumericText(item.name||item.title||'');
  if(item?.courseId&&item.start&&item.end){const course=snapshot?.data.study.courses.find(c=>c.id===item.courseId)?.name||item.courseId;const day=Number.isInteger(item.day)?new Intl.DateTimeFormat(language,{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,9,18+item.day!))):'';return `${course} · ${day} · ${item.start}–${item.end}`;}
  return item?.room||'';
 }
 function display(value:unknown,snapshot:AssistantSnapshot){
  const labels=new Map([...snapshot.data.study.courses,...snapshot.data.scopes.flatMap(s=>s.sections)].map(x=>[x.id,x.name]));
  if(typeof value==='string')return plainNumericText(labels.get(value)||value);
  if(Array.isArray(value))return value.map(v=>typeof v==='string'?(labels.get(v)||v):JSON.stringify(v)).join(', ');
  return JSON.stringify(value)??'—';
 }
 return <MotionConfig reducedMotion="user"><div data-wilo-release="wilo-cloud-v13-readiness-20261026" className={"assistant-root wilo-local-v3"+(open?" is-open":"")} dir={language==='en'?'ltr':'rtl'}>
  <button ref={button} className="assistant-launcher" aria-label={t.open} aria-expanded={open} aria-controls="wilo-assistant" onClick={()=>open?close():openPanel()}><span className="assistant-launcher-mark"><AssistantMark/></span><span>{t.name}</span><span className="assistant-launcher-dot" aria-hidden="true"/></button>
  {present&&<motion.section initial={{opacity:0,y:reduced?0:18,scale:reduced?1:.98}} animate={{opacity:open?1:0,y:open?0:reduced?0:12,scale:open?1:reduced?1:.985}} transition={{duration:reduced?0:.22,ease:[.16,1,.3,1]}} id="wilo-assistant" role="dialog" aria-label={t.name} className={"assistant-panel"+(!open?" is-closing":"")} inert={!open} aria-busy={busy} onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <header className="assistant-header"><span className="assistant-brand-mark"><AssistantMark/></span><div className="assistant-heading"><strong>{t.name}</strong><span><i aria-hidden="true"/>{ui.cloud}</span></div><button type="button" className="assistant-close" aria-label={t.close} onClick={close}><X aria-hidden="true"/></button></header>
   {!connected&&<div className="assistant-intro"><p>{language==='ar'?'اضغط ربط المساعد، سجّل بـGoogle ووافق. تغلق نافذة الموافقة تلقائيًا وتكمل هنا. لكل مستخدم حسابه ورصيده في الخدمة؛ الرصيد المجاني محدود.':language==='he'?'לחצו לחיבור, היכנסו עם Google ואשרו. החלון נסגר אוטומטית וחוזרים לכאן. לכל משתמש חשבון ומכסה נפרדים.':'Connect, sign in with Google and approve. The window closes automatically and you continue here. Each user has their own account and limited free allowance.'}</p><button type="button" disabled={busy} onClick={()=>{setBusy(true);setError('');void connectPollinations(user.uid).then(()=>{if(mounted.current)setConnected(pollinationsConnected(user.uid));}).catch(()=>{if(mounted.current)setError(language==='ar'?'لم يكتمل الربط. اسمح بالنافذة المنبثقة وجرّب مجددًا.':'Connection did not complete. Allow the popup and try again.');}).finally(()=>{if(mounted.current)setBusy(false);});}}>{busy?(language==='ar'?'بانتظار الموافقة…':'Waiting for approval…'):(language==='ar'?'ربط المساعد':language==='he'?'חיבור העוזר':'Connect assistant')}</button></div>}   <div ref={conversation} className="assistant-messages" onScroll={e=>{const el=e.currentTarget,near=el.scrollHeight-el.scrollTop-el.clientHeight<90;followLatest.current=near;setAtBottom(near);}} role="log" aria-live="polite" aria-relevant="additions text">{!messages.length&&<motion.div className="assistant-intro assistant-welcome" initial={{opacity:0,y:reduced?0:10}} animate={{opacity:1,y:0}} transition={{duration:.3}}>
<span className="assistant-intro-emblem"><span className="assistant-emblem-ring"/><AssistantMark/></span><span className="assistant-eyebrow">{ux.eyebrow}</span><span className="assistant-intro-title">{user.displayName?.trim()?ux.welcome+(language==='ar'?'، ':', ')+user.displayName.trim().split(/\s+/)[0]:ui.welcome}</span><p>{ui.placeholder}</p>
<div className="assistant-suggestions">{ux.suggestions.map((suggestion,index)=><motion.button type="button" key={suggestion} disabled={!connected} initial={{opacity:0,y:reduced?0:8}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:.08+index*.06}} whileTap={{scale:reduced?1:.98}} onClick={()=>{setText(suggestion);input.current?.focus();}}><span>{suggestion}</span><ArrowUp aria-hidden="true"/></motion.button>)}</div><small>{ui.hint}</small></motion.div>}{messages.map((m,i)=><motion.article initial={{opacity:0,y:reduced?0:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.24}} className={'assistant-message is-'+m.role} key={i}>{m.role==='assistant'?<AssistantRichText text={plainNumericText(m.text)}/>:<p dir="auto">{plainNumericText(m.text)}</p>}{m.role==='assistant'&&!m.failed&&<div className="assistant-message-tools"><button type="button" aria-label={copiedReply===i?ux.copied:ux.copy} title={copiedReply===i?ux.copied:ux.copy} onClick={()=>void copyReply(i,m.text)}>{copiedReply===i?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}</button>{!m.cancelled&&!!m.changes?.length&&<span className={'assistant-result-state'+(m.receipt?' is-saved':'')}>{m.receipt?<Check aria-hidden="true"/>:null}{m.receipt?ux.done:m.resolved?t.cancel:ux.review}</span>}</div>}{m.role==='assistant'&&m.failed&&connected&&i===messages.length-1&&<button type="button" disabled={busy} onClick={()=>void send([...messages.slice(0,i)].reverse().find(turn=>turn.role==='user'&&turn.failed)?.text)}>{language==='ar'?'إعادة المحاولة':language==='he'?'נסו שוב':'Try again'}</button>}
    {m.reply?.tasks?.some(task=>task.outcome==='needs-input'||task.outcome==='unsupported')&&<details className="assistant-followups"><summary>{ui.followups}</summary>{m.reply.tasks.filter(task=>task.outcome==='needs-input'||task.outcome==='unsupported').map((task,index)=><p key={index}>{task.detail||task.title}</p>)}</details>}
    {m.reply?.clarification&&!m.resolved&&<button type="button" disabled={busy} onClick={()=>void send(ui.skipExtras)}>{ui.skipExtras}</button>}
    {m.reply?.files.map((file,index)=><motion.button whileTap={{scale:reduced?1:.985}} type="button" className="assistant-file-card" key={index} disabled={!!exporting} onClick={()=>void saveFile(file)}><span className="assistant-file-icon"><FileText aria-hidden="true"/></span><span className="assistant-file-copy"><strong>{t.download}: {file.name}</strong><small>{file.name.split('.').at(-1)?.toUpperCase()} · {exporting===file.name?ux.exporting:downloaded.has(file.name)?ux.downloaded:ux.ready}</small></span>{exporting===file.name?<LoaderCircle className="assistant-spin" aria-hidden="true"/>:downloaded.has(file.name)?<Check aria-hidden="true"/>:<Download aria-hidden="true"/>}</motion.button>)}
    {((m.changes?.length||0)+(m.controlPlans?.length||0))>0&&!m.resolved?<div className="assistant-proposal"><strong>{t.review} ({(m.changes?.length||0)+(m.controlPlans?.length||0)})</strong>{m.changes?.map((c,index)=>{
      const before=(c.before||{}) as Record<string,unknown>,after=(c.after||{}) as Record<string,unknown>;
      const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!['id','revision'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));
      return <details key={index}><summary>{t.titles[c.target]} · {c.scope==='personal'?t.personal:m.snapshot!.data.scopes.find(s=>s.id===c.scope)?.name}: {name(c.after,m.snapshot)||name(c.before,m.snapshot)}{!c.before?' · '+t.create:!c.after?' · '+t.remove:''}</summary>{keys.map(key=><div className="assistant-diff" key={key}><strong>{assistantFieldNames[key]?.[language==='ar'?0:language==='en'?1:2]||key}</strong><span>{t.before}: <bdi>{display(before[key],m.snapshot!)}</bdi></span><span>{t.after}: <bdi>{display(after[key],m.snapshot!)}</bdi></span></div>)}</details>;
     })}{m.controlPlans?.map((plan,index)=><details key={'control-'+index}><summary>{ct.kind[plan.control.kind]}</summary><p dir="auto">{JSON.stringify(plan.control.values)}</p></details>)}<button type="button" disabled={busy} onClick={()=>void apply(i)}>{t.apply}</button><button type="button" disabled={busy} onClick={()=>setMessages(old=>old.map((v,index)=>index===i?{...v,resolved:true,cancelled:true}:v))}>{t.cancel}</button></div>:null}
    {!!m.receipt?.changes.length&&!m.undone&&<details className="assistant-saved"><summary>{ui.showChanges} ({m.receipt.changes.length})</summary>{m.receipt.changes.map((change,index)=><button type="button" key={index} onClick={()=>showChange(change)}>{name(change.after,m.snapshot)||name(change.before,m.snapshot)||t.titles[change.target]} <span aria-hidden="true">↗</span></button>)}</details>}
    {m.controlResults&&m.controlPlans?.map((plan,index)=>{const result=m.controlResults![index];return result?.ok?null:<p key={'result-'+index} role={result&&!result.ok?'alert':undefined}>{ct.kind[plan.control.kind]}: {result?(result.ok?ct.done:ct.failed+(result.reason==='assistant-browser-permission'?' · '+ct.permission:' · '+(result.reason==='assistant-conflict'?t.conflict:t.unavailable))):ct.pending}</p>;})}
    {m.receipt&&!m.undone&&!m.receipt.changes.some(c=>c.target==='projects'&&(!c.before||!c.after)||!c.before&&c.target==='sections')&&<button type="button" disabled={busy} onClick={()=>void apply(i,true)}>{m.controlPlans?.length?ct.dataOnlyUndo:t.undo}</button>}
   </motion.article>)}{busy&&phase&&<AssistantWaiting phase={phase} language={language} progress={0}/>}</div>
   {!atBottom&&<button type="button" className="assistant-jump" onClick={()=>{followLatest.current=true;setAtBottom(true);conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:reduced?'instant':'smooth'});}}><ArrowDown aria-hidden="true"/>{ux.jump}</button>}
   <form onSubmit={e=>{e.preventDefault();void send();}}>
    <label>{t.input}<textarea ref={input} disabled={busy||!connected} value={text} maxLength={6000} rows={2} placeholder={ui.placeholder} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} onChange={e=>setText(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}{failure&&<details className="assistant-privacy"><summary>{fw.details}</summary><p>{fw.stage[failure.stage]} · {failure.code}{failure.status?' · HTTP '+failure.status:''}</p>{failure.requestId&&<p dir="ltr">{failure.requestId}</p>}{failure.providerFailure&&<pre dir="ltr">{JSON.stringify(failure.providerFailure,null,2)}</pre>}<button type="button" disabled={busy} onClick={()=>void checkConnection()}>{fw.check}</button><button type="button" onClick={()=>void copyFailure()}>{copied?fw.copied:fw.copy}</button>{health&&<p role="status">{fw.ready} · {health.provider}</p>}</details>}
    <div className="assistant-actions"><button className="primary-button assistant-send" disabled={busy||!connected||!text.trim()}>{busy?<LoaderCircle className="assistant-spin" aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}{busy?t.busy:t.send}</button><button type="button" onClick={()=>{setMessages([]);setError('');setFailure(null);setHealth(null);}} disabled={busy}>{t.clear}</button>{busy&&phase&&phase!=='saving'&&phase!=='undoing'&&<button type="button" className="assistant-stop" onClick={stopRequest}><Square aria-hidden="true"/>{ux.stop}</button>}</div>
    <details className="assistant-preferences"><summary>{ui.options}<span className="assistant-chevron" aria-hidden="true"/></summary><div className="assistant-preferences-body">    <details className="assistant-model-options"><summary><span className="assistant-option-icon" aria-hidden="true">◈</span>{ui.settings}<span className="assistant-chevron" aria-hidden="true"/></summary><p>Pollinations · DeepSeek Flash</p><p>{language==='ar'?'التصدير المتاح: PDF ونص وMarkdown وCSV وJSON.':language==='he'?'ייצוא זמין: PDF, טקסט, Markdown, CSV ו-JSON.':'Available exports: PDF, text, Markdown, CSV and JSON.'}</p>{connected&&<button type="button" disabled={busy} onClick={()=>{disconnectPollinations(user.uid);setConnected(false);}}>{language==='ar'?'فصل حساب المودل':'Disconnect model account'}</button>}<p>{language==='ar'?'مفتاح مستقل لكل مستخدم، وموديلات مجانية فقط. تحدد الخدمة حدود الاستخدام والتوفر.':language==='he'?'עוזר ענן חינמי ללא הורדה. חלות מגבלות הספק.':'Free cloud assistant with no download. Provider usage and availability limits apply.'}</p></details>
    <details className="assistant-privacy"><summary>{ct.title}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{language==='ar'?'يمكنني تعديل البطاقات والأقسام والكورسات والمهام والجدول، وضبط المظهر واللغة والسكون والتنظيم وفتح الصفحات. الأذونات وكلمة المرور وحذف الحساب وإدارة أعضاء المجموعات تتطلب نماذجها الأصلية. يمكنك طلب عدة مهام معًا؛ لا يُعلن الحفظ قبل تأكيده.':language==='he'?'ניתן לערוך כרטיסים, מדורים, קורסים, משימות ומערכת שעות, לשנות מראה, שפה והעדפות ולפתוח עמודים. הרשאות, סיסמאות, מחיקת חשבון וניהול חברים מתבצעים בטפסים הקיימים. אפשר לבקש כמה משימות יחד.':'Edit cards, sections, courses, tasks and timetable; change appearance, language, sleep and workflow; open pages. Permissions, passwords, account deletion and group membership use their existing forms. You can request several tasks together.'}</p></details>
    <details className="assistant-privacy"><summary>{ui.privacy}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{t.privacy}</p></details>
</div></details>
   </form>
  </motion.section>}
 </div></MotionConfig>;
}
