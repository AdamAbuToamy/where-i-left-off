import type { Language } from '../translations'
import type { TaskEntry } from './taskOverview'
import { checklistItems,sortTasks } from './taskOverview'
import { featureText } from '../featureText'
export type ReportOptions={language:Language;title:string;userName:string;cached?:boolean;date?:Date}
const WIDTH=1190,HEIGHT=1684,MARGIN=82,BOTTOM=HEIGHT-90
export function wrapReportText(text:string,width:number,measure:(s:string)=>number):string[] {
 const lines:string[]=[]
 for (const paragraph of text.split('\n')) {
  let line=''
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
   if (measure(word)>width) {
    if (line) lines.push(line)
    let part=''
    for (const char of word) { if (part && measure(part+char)>width) {lines.push(part);part=''};part+=char }
    line=part
   } else if (line && measure(`${line} ${word}`)>width) {lines.push(line);line=word}
   else line=line ? `${line} ${word}` : word
  }
  lines.push(line)
 }
 return lines
}
export async function buildTasksPdf(entries:TaskEntry[],options:ReportOptions,createCanvas=(w:number,h:number)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas}) {
 const {jsPDF}=await import('jspdf'),pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
 const t=featureText[options.language],rtl=options.language!=='en',date=options.date || new Date()
 const pages:HTMLCanvasElement[]=[]
 let canvas!:HTMLCanvasElement,ctx!:CanvasRenderingContext2D,y=0
 const font=(size:number,bold=false)=>`${bold ? '700' : '400'} ${size}px Arial, Tahoma, sans-serif`
 const newPage=()=>{
  canvas=createCanvas(WIDTH,HEIGHT);ctx=canvas.getContext('2d')!;if(!ctx)throw new Error('canvas-unavailable')
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.textBaseline='top';pages.push(canvas);y=72
  ctx.fillStyle='#304533';ctx.font=font(32,true);ctx.fillText(t.report,rtl?WIDTH-MARGIN:MARGIN,y);y+=54
  ctx.fillStyle='#6c7468';ctx.font=font(18);ctx.fillText(date.toLocaleDateString(options.language),rtl?WIDTH-MARGIN:MARGIN,y);y+=44
  ctx.strokeStyle='#dce1d6';ctx.beginPath();ctx.moveTo(MARGIN,y);ctx.lineTo(WIDTH-MARGIN,y);ctx.stroke();y+=28
 }
 const write=(text:string,size=23,bold=false,color='#25332e')=>{
  ctx.font=font(size,bold)
  const lines=wrapReportText(text,WIDTH-MARGIN*2,s=>ctx.measureText(s).width)
  for(const line of lines){if(y+size*1.65>BOTTOM)newPage();ctx.font=font(size,bold);ctx.fillStyle=color;ctx.fillText(line,rtl?WIDTH-MARGIN:MARGIN,y);y+=size*1.65}
 }
 newPage();write(options.title,28,true);if(options.userName)write(options.userName,21);write(`${t.total}: ${entries.length}`,20)
 if(options.cached)write(t.reportLocal,19,false,'#71522a')
 y+=20
 const statuses:Record<string,number>={later:0,active:1,waiting:2,done:3}
 for(const [index,entry] of sortTasks(entries).entries()) {
  const p=entry.project
  if(y+150>BOTTOM)newPage()
  write(`${index+1}. ${p.name}`,26,true)
  write(`${entry.scope} · ${t.status[statuses[p.status]]}${p.dueDate ? ` · ${t.due}: ${p.dueDate}` : ''}`,18,false,'#64715f')
  if(p.totalUnits)write(`${p.progressUnits || 0} / ${p.totalUnits}`,20)
  if(p.followUpDate)write(`${t.due}: ${p.followUpDate}`,18)
  if(p.checkpoint)write(`${t.checkpoint}: ${p.checkpoint}`)
  write(`${t.next}: ${p.nextStep || '—'}`)
  for(const [number,item] of checklistItems(p.checklist).entries())write(`${item.done?'✓':'□'} ${number+1}. ${item.text}`,21,false,item.done?'#6c7468':'#25332e')
  if(p.projectUrl)write(p.projectUrl,17,false,'#286b8e')
  if(p.attachmentUrl)write(p.attachmentUrl,17,false,'#286b8e')
  for(const url of p.links || [])write(url,17,false,'#286b8e')
  y+=22
  if(y<BOTTOM){ctx.strokeStyle='#e1e5da';ctx.beginPath();ctx.moveTo(MARGIN,y);ctx.lineTo(WIDTH-MARGIN,y);ctx.stroke();y+=24}
 }
 for(const [index,page] of pages.entries()){
  const context=page.getContext('2d')!;context.direction='ltr';context.textAlign='center';context.font=font(18);context.fillStyle='#7b8374';context.fillText(`${index+1} / ${pages.length}`,WIDTH/2,HEIGHT-52)
  if(index)pdf.addPage()
  pdf.addImage(page.toDataURL('image/png'),'PNG',0,0,210,297,undefined,'FAST')
 }
 pdf.setProperties({title:t.report,author:'Where I Left Off'})
 return pdf.output('arraybuffer')
}
export async function downloadTasksPdf(entries:TaskEntry[],options:ReportOptions) {
 const bytes=await buildTasksPdf(entries,options),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob)
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`tasks-${new Date().toISOString().slice(0,10)}.pdf`;document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000)
}
