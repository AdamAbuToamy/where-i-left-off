import type { Language } from '../translations';
import { assistantPresentation } from './presentationWords';
export type AssistantPhase='reading'|'repairing'|'thinking'|'saving'|'undoing'|'model';
export function AssistantMark(){return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 3 14.7 9.3 21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" fill="currentColor"/></svg>;}
export default function AssistantWaiting({phase,language,progress}:{phase:AssistantPhase;language:Language;progress:number}){
 const t=assistantPresentation[language];
 return <div className="assistant-waiting" role="status" aria-live="polite" aria-atomic="true">
  <span className="assistant-waiting-mark" aria-hidden="true"><AssistantMark/></span>
  <div className="assistant-waiting-content"><div className="assistant-waiting-line"><strong>{t[phase]}</strong><span className="assistant-dots" aria-hidden="true"><i/><i/><i/></span></div>
   {phase==='model'?<progress value={progress} max={1} aria-label={t.model}/>:<span className="assistant-waiting-hint">{t.waiting}</span>}
  </div>
 </div>;
}
