import { expect,it } from 'vitest'
import { checklistItems,sortTasks,taskLink } from '../src/lib/taskOverview'
import { toggleChecklist } from '../src/lib/projects'
import { wrapReportText } from '../src/lib/tasksPdf'
import type { TaskEntry } from '../src/lib/taskOverview'
const entry=(id:string,status:TaskEntry['project']['status'],dueDate?:string):TaskEntry=>({scope:'Personal',project:{id,name:id,status,dueDate,nextStep:'Next',rank:0,revision:0}})
it('orders overdue work, active tasks, future starts, waiting and completed tasks without mutating the input',()=>{
 const rows=[entry('done','done','2020-01-01'),entry('waiting','waiting'),entry('future','later','2026-12-01'),entry('active','active'),entry('overdue','later','2026-10-12')]
 expect(sortTasks(rows,'2026-10-13').map(e=>e.project.id)).toEqual(['overdue','active','future','waiting','done'])
 expect(rows[0].project.id).toBe('done')
})
it('keeps original checklist indexes across empty lines and toggles spaced markers without losing text',()=>{
 const text='1. إعداد المسودة\n\n  [X] 2. مراجعة المسودة\n[ ] 3. إرسال'
 expect(checklistItems(text)).toEqual([{index:0,done:false,text:'إعداد المسودة'},{index:2,done:true,text:'مراجعة المسودة'},{index:3,done:false,text:'إرسال'}])
 const changed=toggleChecklist(text,2)
 expect(checklistItems(changed)[1]).toEqual({index:2,done:false,text:'مراجعة المسودة'})
 expect(checklistItems(toggleChecklist(changed,2))[1].done).toBe(true)
 expect(changed.split('\n')[3]).toBe('[ ] 3. إرسال')
})
it('opens the correct personal or group card',()=>{
 expect(taskLink(entry('abc','active'))).toBe('#/personal/abc')
 expect(taskLink({...entry('abc','active'),groupId:'team'})).toBe('#/groups/team/abc')
})
it('wraps long links and multilingual paragraphs without dropping characters',()=>{
 const link='https://example.test/'+'a'.repeat(140)
 const wrapped=wrapReportText(`العربية واضحة\n${link}\nעברית`,20,s=>Array.from(s).length)
 expect(wrapped.every(line=>Array.from(line).length<=20)).toBe(true)
 expect(wrapped.slice(1,-1).join('')).toBe(link)
 expect(wrapped[0]).toBe('العربية واضحة')
 expect(wrapped.at(-1)).toBe('עברית')
})
