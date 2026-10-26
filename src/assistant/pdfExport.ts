import type {Language} from '../translations';
import {wrapReportText} from '../lib/tasksPdf';
type Line={text:string;size:number;bold:boolean};
const WIDTH=1190,HEIGHT=1684,MARGIN=82,BOTTOM=HEIGHT-105;
const clean=(text:string)=>text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
/** Model content is plain text. Canvas renders Arabic/Hebrew shaping without executing HTML. */
export async function buildAssistantPdf(content:string,options:{name:string;language:Language},createCanvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}){
 if(!content.trim()||content.length>30000)throw new Error('assistant-pdf-content');
 if(typeof document!=='undefined'&&document.fonts)await document.fonts.ready;
 const {jsPDF}=await import('jspdf'),pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
 const canvas=createCanvas(WIDTH,HEIGHT),ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas-unavailable');
 const rtl=options.language!=='en',font=(size:number,bold=false)=>`${bold?'700':'400'} ${size}px Arial, Tahoma, sans-serif`;
 const pages:Line[][]=[[]];let y=190;
 let tableHeaders:string[]=[];
 for(const paragraph of content.replace(/\r\n?/g,'\n').split('\n')){
  let text=paragraph.trim();const heading=/^(#{1,6})\s+/.exec(text),size=heading?28:23,bold=!!heading;
  text=clean(text.replace(/^#{1,6}\s+/, ''));
  if(/^\|?\s*:?-{3,}/.test(text))continue;
  if(text.startsWith('|')&&text.endsWith('|')){
   const cells=text.slice(1,-1).split('|').map(s=>s.trim());
   if(!tableHeaders.length){tableHeaders=cells;continue;}
   text=cells.map((cell,i)=>`${tableHeaders[i]||''}: ${cell}`).join(' · ');
  }else tableHeaders=[];
  if(!text){y+=14;continue;}
  ctx.font=font(size,bold);
  for(const line of wrapReportText(text,WIDTH-2*MARGIN,s=>ctx.measureText(s).width)){
   if(y+size*1.65>BOTTOM){pages.push([]);y=190;}
   pages.at(-1)!.push({text:line,size,bold});y+=size*1.65;
  }
 }
 const title=options.name.replace(/\.pdf$/i,'');
 for(const [index,lines] of pages.entries()){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.textBaseline='top';
  const x=rtl?WIDTH-MARGIN:MARGIN;
  ctx.fillStyle='#304533';ctx.font=font(30,true);ctx.fillText('WILO',x,62);
  ctx.font=font(21);ctx.fillStyle='#64715f';ctx.fillText(title,x,110,WIDTH-2*MARGIN);
  ctx.strokeStyle='#dce1d6';ctx.beginPath();ctx.moveTo(MARGIN,155);ctx.lineTo(WIDTH-MARGIN,155);ctx.stroke();
  y=190;for(const line of lines){ctx.font=font(line.size,line.bold);ctx.fillStyle='#25332e';ctx.fillText(line.text,x,y);y+=line.size*1.65;}
  ctx.direction='ltr';ctx.textAlign='center';ctx.font=font(18);ctx.fillStyle='#64715f';ctx.fillText(`${index+1} / ${pages.length}`,WIDTH/2,HEIGHT-60);
  if(index)pdf.addPage();pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,210,297,undefined,'FAST');
 }
 pdf.setProperties({title,author:'WILO'});return pdf.output('arraybuffer');
}
export async function assistantFileBlob(file:{name:string;content:string},language:Language):Promise<Blob>{
 if(/\.pdf$/i.test(file.name))return new Blob([await buildAssistantPdf(file.content,{name:file.name,language})],{type:'application/pdf'});
 const ext=file.name.split('.').at(-1)?.toLowerCase(),mime=ext==='json'?'application/json':ext==='csv'?'text/csv':ext==='md'?'text/markdown':'text/plain';
 return new Blob([...(ext==='json'?[]:['\uFEFF']),file.content],{type:mime+';charset=utf-8'});
}
export async function downloadAssistantFile(file:{name:string;content:string},language:Language){
 const blob=await assistantFileBlob(file,language),url=URL.createObjectURL(blob),a=document.createElement('a');
 try{a.href=url;a.download=file.name;document.body.append(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
}
