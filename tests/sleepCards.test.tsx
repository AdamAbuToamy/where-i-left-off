// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import { SleepCardDeck } from '../src/components/SleepCards'
import type { TaskEntry } from '../src/lib/taskOverview'
let root:Root,container:HTMLDivElement
const entries:TaskEntry[]=Array.from({length:4},(_,i)=>({scope:'My projects',project:{id:`card${i}`,name:`My actual project ${i}`,nextStep:`Real next step ${i}`,checkpoint:'Saved checkpoint',status:'active',rank:i,revision:0,checklist:'[x] Done\n[ ] Next'}}))
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('matchMedia',()=>({matches:false}));container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals()})
it('shows actual project names, next steps and progress then cycles through the user cards',()=>{
 act(()=>root.render(<SleepCardDeck entries={entries} language="en"/>))
 expect(container.querySelectorAll('article')).toHaveLength(3);expect(container.textContent).toContain('My actual project 0');expect(container.textContent).toContain('Real next step 0');expect(container.textContent).toContain('1 / 2')
 act(()=>vi.advanceTimersByTime(8000))
 expect(container.textContent).not.toContain('My actual project 0');expect(container.textContent).toContain('My actual project 3')
 expect(container.querySelector('button,input,a')).toBeNull()
})
it('does not cycle or animate when reduced motion is requested and prefers unfinished work',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}))
 act(()=>root.render(<SleepCardDeck entries={[{...entries[0],project:{...entries[0].project,status:'done'}},...entries.slice(1)]} language="en"/>))
 expect(container.textContent).not.toContain('My actual project 0')
 const before=container.textContent;act(()=>vi.advanceTimersByTime(32000));expect(container.textContent).toBe(before)
})
