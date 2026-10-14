import { existsSync,writeFileSync } from 'node:fs'
import { createCanvas,GlobalFonts } from '@napi-rs/canvas'
import { expect,it } from 'vitest'
import { buildTasksPdf } from '../src/lib/tasksPdf'
import type { TaskEntry } from '../src/lib/taskOverview'
it('exports an actual multipage Arabic report with long checklists and valid page footers',async()=>{
 if(existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial')
 const entries:TaskEntry[]=Array.from({length:4},(_,i)=>({scope:i%2?'مجموعة الجامعة':'مشاريعي',project:{id:`card${i}`,name:`${i+1} مشروع تطوير الموقع`,status:i%3===0?'done':'active',rank:i,revision:0,dueDate:'2026-10-20',checkpoint:'انتهيت من تصميم الصفحة الرئيسية ومراجعة تفاصيل العرض على الهاتف.',nextStep:'إضافة صفحة تجمع المهام ثم تجربة حفظ القائمة ومراجعة النتائج.',checklist:'[x] إعداد التصميم\n[ ] مراجعة المهام\n[ ] نشر التحديث',projectUrl:'https://example.test/'+'a'.repeat(180)}}))
 const pages:ReturnType<typeof createCanvas>[]=[],painted:string[]=[]
 const bytes=await buildTasksPdf(entries,{language:'ar',title:'مهامي الشخصية والمهام المسندة إليّ',userName:'آدم',date:new Date('2026-10-13T12:00:00Z')},(w,h)=>{
  const canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),draw=ctx.fillText.bind(ctx)
  ctx.fillText=(text:string,x:number,y:number,maxWidth?:number)=>{painted.push(text);draw(text,x,y,maxWidth)}
  pages.push(canvas);return canvas as unknown as HTMLCanvasElement
 })
 expect(pages.length).toBeGreaterThan(1)
 expect(Buffer.from(bytes).subarray(0,5).toString()).toBe('%PDF-')
 for(const e of entries)expect(painted.some(line=>line.endsWith(e.project.name))).toBe(true)
 expect(painted).toContain(`1 / ${pages.length}`);expect(painted).toContain(`${pages.length} / ${pages.length}`)
 if(process.env.PDF_QA_PATH)writeFileSync(process.env.PDF_QA_PATH,Buffer.from(bytes))
},20000)
