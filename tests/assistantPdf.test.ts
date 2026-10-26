import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {expect,it} from 'vitest';
import {buildAssistantPdf} from '../src/assistant/pdfExport';
import {parseAssistantReply} from '../src/assistant/actions';
it('preserves supported file formats and sanitizes untrusted filenames',()=>{
 const reply=parseAssistantReply(JSON.stringify({text:'Ready',files:[{name:'../courses.pdf',content:'أسماء الكورسات'},{name:'courses.csv',content:'name\nMath'},{name:'unsafe.html',content:'<script>bad</script>'}]}));
 expect(reply.files.map(f=>f.name)).toEqual(['.._courses.pdf','courses.csv','unsafe.txt']);
});
it('creates a real multipage Arabic PDF with mixed English, long URLs, and all final content',async()=>{
 if(existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
 const content='# ملخص الكورسات\n'+Array.from({length:18},(_,i)=>'## '+(i+1)+'. البرمجة وقواعد البيانات\nمراجعة المحاضرات وحل التمارين أسبوعياً. موعد الامتحان 28/10/2026.\nComputer Science - https://example.test/'+('long-path-'.repeat(16))).join('\n')+'\nنهاية جميع الكورسات',
 painted:string[]=[],footers:string[]=[];let count=0;
 const bytes=await buildAssistantPdf(content,{name:'كورساتي.pdf',language:'ar'},(w,h)=>{
  count++;const canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),draw=ctx.fillText.bind(ctx);
  ctx.fillText=(text:string,x:number,y:number,max?:number)=>{painted.push(text);if(/^\d+ \/ \d+$/.test(text))footers.push(text);expect(y).toBeLessThan(h);draw(text,x,y,max);};
  return canvas as unknown as HTMLCanvasElement;
 });
 expect(count).toBe(1);expect(Buffer.from(bytes).subarray(0,5).toString()).toBe('%PDF-');expect(footers.length).toBeGreaterThan(1);expect(footers.at(-1)).toBe(footers.length+' / '+footers.length);
 expect(painted).toContain('نهاية جميع الكورسات');
 if(process.env.PDF_QA_PATH){mkdirSync('tmp/pdfs',{recursive:true});writeFileSync(process.env.PDF_QA_PATH,Buffer.from(bytes));}
},20000);
it('renders Markdown table contents rather than dropping rows or rendering HTML',async()=>{
 const painted:string[]=[];await buildAssistantPdf('| Course | Notes |\n| --- | --- |\n| Math | Revision |\n<script>visible text</script>',{name:'courses.pdf',language:'en'},(w,h)=>{
 const c=createCanvas(w,h),ctx=c.getContext('2d'),draw=ctx.fillText.bind(ctx);ctx.fillText=(s:string,x:number,y:number)=>{painted.push(s);draw(s,x,y);};return c as unknown as HTMLCanvasElement;
 });expect(painted).toContain('Course: Math · Notes: Revision');expect(painted).toContain('<script>visible text</script>');
});
