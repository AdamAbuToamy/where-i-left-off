import { useState } from 'react'
import type { TaskEntry } from '../lib/taskOverview'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { logEvent } from '../lib/logging'
export default function SummaryPdfButton({entries,language,title,userName,cached=false,disabled=false,scopeLabel=false}:{entries:TaskEntry[];language:Language;title:string;userName:string;cached?:boolean;disabled?:boolean;scopeLabel?:boolean}) {
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),t=featureText[language]
 return <div className="pdf-export"><button className="secondary-button" disabled={busy || disabled || !entries.length} onClick={()=>{setBusy(true);setFailed(false);void import('../lib/tasksPdf').then(module=>module.downloadTasksPdf(entries,{language,title,userName,cached})).catch(error=>{setFailed(true);logEvent('pdf.export',error)}).finally(()=>setBusy(false))}}>{busy?t.pdfBusy:scopeLabel?t.pdfScope:t.pdf}</button>{failed&&<p role="alert">{t.pdfFail}</p>}</div>
}
