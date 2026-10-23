// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import WeeklySchedule from '../src/components/WeeklySchedule'
import {localDateKey} from '../src/lib/projects'
import type {Project} from '../src/types'
it.each([18,19,20,21,22,23,24])('locates a follow-up two days after October %i in the correct week',async(day)=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,day,12));vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node)
 try {
  const today=new Date(),date=new Date(today);date.setDate(date.getDate()+2);const due=localDateKey(date)
  const project:Project={id:'robot',name:'Robot arm',nextStep:'Fit bearing',rank:0,status:'later',revision:0,dueDate:due}
  await act(async()=>root.render(<WeeklySchedule projects={[project]} language="en"/>))
  const inCurrentWeek=today.getDay()+2<7
  expect(node.querySelector('.week-item')!==null).toBe(inCurrentWeek)
  if(!inCurrentWeek){const next=[...node.querySelectorAll('button')].find(button=>button.textContent==='Next week');expect(next).toBeTruthy();await act(async()=>next!.click())}
  expect(node.querySelector(`.week-day time[datetime="${due}"]`)).not.toBeNull()
  expect(node.querySelector('.week-item')?.textContent).toContain('Robot arm')
 } finally {act(()=>root.unmount());node.remove();vi.useRealTimers();vi.unstubAllGlobals()}
})
