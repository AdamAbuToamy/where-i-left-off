import {useEffect,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {LoaderCircle,Sparkles} from 'lucide-react';
import type {Language} from '../translations';
import {assistantPresentation} from './presentationWords';
import {experienceWords} from './experienceWords';
export type AssistantPhase='reading'|'repairing'|'receiving'|'thinking'|'saving'|'undoing'|'model';
export function AssistantMark(){return <Sparkles aria-hidden="true" strokeWidth={1.6}/>;}
export default function AssistantWaiting({phase,language,progress}:{phase:AssistantPhase;language:Language;progress:number}){
 const t=assistantPresentation[language],x=experienceWords[language],reduced=useReducedMotion(),[seconds,setSeconds]=useState(0);
 useEffect(()=>{const started=Date.now(),timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[]);
 const saving=phase==='saving'||phase==='undoing';
 return <div className="assistant-waiting" role="status" aria-live="polite" aria-atomic="true">
  <span className="assistant-waiting-mark" aria-hidden="true"><span className="assistant-orbit"/><AssistantMark/></span>
  <div className="assistant-waiting-content">
   <div className="assistant-waiting-line"><AnimatePresence mode="wait" initial={false}><motion.strong key={phase} initial={{opacity:0,y:reduced?0:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.14}}>{t[phase]}</motion.strong></AnimatePresence><span className="assistant-dots" aria-hidden="true"><i/><i/><i/></span></div>
   {phase==='model'?<progress value={progress} max={1} aria-label={t.model}/>:<span className="assistant-waiting-hint">{saving?t.waiting:seconds>=12?x.slow:x.waiting}</span>}
   <span className="assistant-waiting-time" aria-hidden="true">{seconds}{x.seconds}</span>
   <div className="assistant-stage-track" aria-hidden="true"><span className="is-current"><LoaderCircle/>{t[phase].replace('…','')}</span></div>
  </div>
 </div>;
}
