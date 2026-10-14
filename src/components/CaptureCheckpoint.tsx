import type { Project } from '../types'
import type { TabCapture } from '../lib/tabCapture'
import type { Language } from '../translations'
import { canonicalCaptureUrl,currentCard } from '../lib/workflow'
import { workflowText } from '../workflowText'
export default function CaptureCheckpoint({capture,projects,language,busy,onUpdate,onNew}:{capture:TabCapture;projects:Project[];language:Language;busy:boolean;onUpdate:(project:Project)=>void;onNew:()=>void}){
 const t=workflowText[language],matches=projects.filter(p=>currentCard(p)&&canonicalCaptureUrl(p.projectUrl || '')===canonicalCaptureUrl(capture.projectUrl))
 if(!capture.checkpoint||!matches.length)return null
 return <section className="capture-checkpoint"><h3>{t.capture}</h3><p>{t.capturedAt}: <bdi>{capture.checkpoint}</bdi></p>{matches.map(p=><button key={p.id} className="primary-button" disabled={busy} onClick={()=>onUpdate(p)}>{t.updateExisting}: {p.name}</button>)}<button className="secondary-button" disabled={busy} onClick={onNew}>{t.newCapture}</button></section>
}
