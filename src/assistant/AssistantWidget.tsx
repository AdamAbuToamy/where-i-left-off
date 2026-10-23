import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Language } from '../translations';
import { auth } from '../lib/firebase';
import { pushCall } from '../lib/pushNotifications';
import type { LocalAssistantModel } from './localModel';
import { assistantValidationHint } from './validationHint';
import { quickAssistantReply } from './quickActions';
import { parseAssistantReply, planAssistantChanges } from './actions';
import type { AssistantReply, Change } from './actions';
import { AssistantRepository, assistantContext } from './assistantRepository';
import type { AssistantSnapshot, AssistantReceipt } from './assistantRepository';
import { assistantWords, assistantFieldNames } from './words';
import AssistantWaiting, { AssistantMark } from './AssistantWaiting';
import type { AssistantPhase } from './AssistantWaiting';
import { assistantPresentation } from './presentationWords';
import './assistant.css';
type Message={role:'user'|'assistant';text:string;reply?:AssistantReply;changes?:Change[];snapshot?:AssistantSnapshot;receipt?:AssistantReceipt;resolved?:boolean};
function download(name:string,content:string){const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function AssistantWidget({user,language}:{user:User;language:Language}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const button=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null),mounted=useRef(true),lock=useRef(false);
 const [repository]=useState(()=>new AssistantRepository(user.uid));
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
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 function useCloud(){local.current?.dispose();local.current=null;setLocalReady(false);setPreferLocal(false);try{localStorage.removeItem('wilo-assistant-local');}catch{/* Optional preference. */}}
 function close(){setOpen(false);button.current?.focus();}
 function report(e:unknown){const code=(e as {code?:string}).code?.replace(/^firestore\//,'')||(e as Error).message;setError(code==='permission-denied'?t.permission:code==='assistant-confirmation'?t.confirmation:code==='ai-rate-limit'?t.rate:code==='ai-provider-limit'?t.providerLimit:code==='assistant-local-unsupported'?t.localUnsupported:code==='assistant-local-context'?t.localContext:/^assistant-local-/.test(code)?t.localLoadError:code==='ai-not-configured'?t.setup:/ai-(?:user|daily)-limit/.test(code)?t.limit:code==='assistant-format'||code==='ai-response-too-large'?t.format:code==='assistant-invalid'?[t.invalid,assistantValidationHint(e,language)].filter(Boolean).join(' '):code==='assistant-conflict'?t.conflict:code==='assistant-pending'?t.pending:code==='assistant-linked-reminder'?t.linked:code==='assistant-too-large'?t.large:t.unavailable);}
 async function send(){
  if(lock.current||!text.trim())return;
  const message=text.trim();lock.current=true;setBusy(true);setPhase('reading');setError('');
  setMessages(old=>[...old.slice(-15),{role:'user',text:message}]);setText('');
  try{
   const snapshot=await repository.read();
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   const quick=quickAssistantReply(message,snapshot.data,language,messages.map(m=>({role:m.role,content:m.text+(m.resolved?' [proposal resolved; do not repeat]':'')})));
   const request={mode:'workspace',message,language,context:quick?'':assistantContext(snapshot,message),history:messages.slice(-4).map(m=>({role:m.role,content:(m.text+(m.resolved?' [proposal resolved; do not repeat]':'')).slice(0,1200)}))};
   if(JSON.stringify(request).length>65000)throw new Error('assistant-too-large');
   if(!quick&&preferLocal&&!localReady)throw new Error('assistant-local-not-ready');
   setPhase('thinking');
   const result=quick?{text:JSON.stringify(quick)}:localReady?await local.current!.answer(request):await pushCall<{text:string}>(request,{path:'/assistant',timeout:60000});
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   const reply=parseAssistantReply(result.text);
   let changes:Change[];
   try{changes=planAssistantChanges(snapshot.data,reply.actions);}catch(e){if((e as Error).message==='assistant-linked-reminder')throw e;throw new Error('assistant-invalid',{cause:e});}
   setMessages(old=>[...old,{role:'assistant',text:reply.text,reply,changes,snapshot}]);
  }catch(e){if(mounted.current)report(e);}
  finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 async function apply(index:number,undo=false){
  if(lock.current)return;lock.current=true;setBusy(true);setPhase(undo?'undoing':'saving');setError('');
  const m=messages[index];
  try{
   let receipt:AssistantReceipt|undefined;
   if(undo)await repository.undo(m.receipt!);
   else receipt=await repository.apply(m.snapshot!,m.changes!);
   if(!mounted.current||auth?.currentUser?.uid!==user.uid)return;
   setMessages(old=>old.map((value,i)=>i===index?{...value,resolved:true,receipt,text:value.text+'\n\n'+(undo?t.undone:t.applied)}:value));
  }catch(e){if(mounted.current)report(e);}
  finally{lock.current=false;if(mounted.current){setBusy(false);setPhase(null);}}
 }
 function name(value:unknown){const item=value as {name?:string;title?:string;room?:string}|null;return item?.name||item?.title||item?.room||'';}
 function display(value:unknown,snapshot:AssistantSnapshot){
  const labels=new Map([...snapshot.data.study.courses,...snapshot.data.scopes.flatMap(s=>s.sections)].map(x=>[x.id,x.name]));
  if(typeof value==='string')return labels.get(value)||value;
  if(Array.isArray(value))return value.map(v=>typeof v==='string'?(labels.get(v)||v):JSON.stringify(v)).join(', ');
  return JSON.stringify(value)??'—';
 }
 return <div className="assistant-root" dir={language==='en'?'ltr':'rtl'}>
  <button ref={button} className="assistant-launcher" aria-label={t.open} aria-expanded={open} aria-controls="wilo-assistant" onClick={()=>open?close():setOpen(true)}><span className="assistant-launcher-mark"><AssistantMark/></span><span>{t.name}</span><span className="assistant-launcher-dot" aria-hidden="true"/></button>
  {open&&<section id="wilo-assistant" role="dialog" aria-label={t.name} className="assistant-panel" aria-busy={busy} onKeyDown={e=>{if(e.key==='Escape')close();}}>
   <header className="assistant-header"><span className="assistant-brand-mark"><AssistantMark/></span><div className="assistant-heading"><strong>{t.name}</strong><span><i aria-hidden="true"/>{localReady?ui.local:preferLocal?ui.notReady:ui.cloud}</span></div><button type="button" className="assistant-close" aria-label={t.close} onClick={close}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button></header>
   <div ref={conversation} className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text"><div className="assistant-intro"><span className="assistant-intro-title">{ui.welcome}</span><p>{t.intro}</p><span className="assistant-review-hint">{ui.hint}</span></div>{messages.map((m,i)=><article className={'assistant-message is-'+m.role} key={i}><span className="assistant-message-author">{m.role==='user'?ui.you:ui.assistant}</span><p dir="auto">{m.text}</p>
    {m.reply?.files.map((file,index)=><button type="button" key={index} onClick={()=>download(file.name,file.content)}>{t.download}: {file.name}</button>)}
    {m.changes?.length&&!m.resolved?<div className="assistant-proposal"><strong>{t.review} ({m.changes.length})</strong>{m.changes.map((c,index)=>{
      const before=(c.before||{}) as Record<string,unknown>,after=(c.after||{}) as Record<string,unknown>;
      const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!['id','revision'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));
      return <details key={index}><summary>{t.titles[c.target]} · {c.scope==='personal'?t.personal:m.snapshot!.data.scopes.find(s=>s.id===c.scope)?.name}: {name(c.after)||name(c.before)}{!c.before?' · '+t.create:!c.after?' · '+t.remove:''}</summary>{keys.map(key=><div className="assistant-diff" key={key}><strong>{assistantFieldNames[key]?.[language==='ar'?0:language==='en'?1:2]||key}</strong><span>{t.before}: <bdi>{display(before[key],m.snapshot!)}</bdi></span><span>{t.after}: <bdi>{display(after[key],m.snapshot!)}</bdi></span></div>)}</details>;
     })}<button type="button" disabled={busy} onClick={()=>void apply(i)}>{t.apply}</button><button type="button" disabled={busy} onClick={()=>setMessages(old=>old.map((v,index)=>index===i?{...v,resolved:true}:v))}>{t.cancel}</button></div>:null}
    {m.receipt&&!m.receipt.changes.some(c=>!c.before&&['projects','sections'].includes(c.target))&&<button type="button" disabled={busy} onClick={()=>void apply(i,true)}>{t.undo}</button>}
   </article>)}{busy&&phase&&<AssistantWaiting phase={phase} language={language} progress={progress}/>}</div>
   <form onSubmit={e=>{e.preventDefault();void send();}}>
    <details className="assistant-model-options"><summary><span className="assistant-option-icon" aria-hidden="true">◈</span>{ui.settings}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{t.localInfo}</p>{localReady?<button type="button" disabled={busy} onClick={useCloud}>{t.remote}</button>:<button type="button" disabled={busy} onClick={()=>void activateLocal()}>{localLoading?`${t.localLoading} ${Math.round(progress*100)}%`:t.local}</button>}{preferLocal&&!localReady&&<button type="button" disabled={busy} onClick={useCloud}>{t.remote}</button>}</details>
    <label>{t.input}<textarea ref={input} value={text} maxLength={6000} rows={2} placeholder={ui.placeholder} onChange={e=>setText(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}
    <div className="assistant-actions"><button className="primary-button assistant-send" disabled={busy||!text.trim()}><svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m10 15 0-10m-4 4 4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>{busy?t.busy:t.send}</button><button type="button" onClick={()=>{setMessages([]);setError('');}} disabled={busy}>{t.clear}</button></div>
    <details className="assistant-privacy"><summary>{ui.privacy}<span className="assistant-chevron" aria-hidden="true"/></summary><p>{preferLocal?t.localReady:t.privacy}</p></details>
   </form>
  </section>}
 </div>;
}
