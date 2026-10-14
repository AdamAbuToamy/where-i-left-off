// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import IdleSleep from '../src/components/IdleSleep'
import { IDLE_SLEEP_MS,saveSleepEnabled } from '../src/lib/idleSleep'
let root:Root,container:HTMLDivElement
const clicked=vi.fn()
function mount(uid:string|undefined){
 act(()=>root.render(<IdleSleep uid={uid} language="en"><input defaultValue="Unfinished draft"/><button onClick={clicked}>Delete card</button></IdleSleep>))
}
const advance=(ms:number)=>act(()=>vi.advanceTimersByTime(ms))
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>window.setTimeout(()=>fn(0),16));vi.spyOn(window,'scrollTo').mockImplementation(()=>{})
 localStorage.clear();clicked.mockClear();container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
it('hides all private content after one minute, keeps the draft, and consumes the wake click',()=>{
 mount('alice');const input=container.querySelector('input')!;input.value='Draft kept'
 advance(IDLE_SLEEP_MS-1);expect(container.querySelector('[role=dialog]')).toBeNull()
 advance(1);expect(container.querySelector<HTMLElement>('.private-content')!.hidden).toBe(true)
 expect(container.querySelector('[role=dialog]')!.textContent).not.toContain('Draft kept')
 const privateButton=container.querySelector<HTMLButtonElement>('.private-content button')!
 act(()=>privateButton.click());expect(clicked).not.toHaveBeenCalled();expect(container.querySelector('[role=dialog]')).toBeNull()
 expect(container.querySelector<HTMLElement>('.private-content')!.hidden).toBe(false)
 expect(container.querySelector('input')).toBe(input);expect(input.value).toBe('Draft kept')
 act(()=>privateButton.click());expect(clicked).not.toHaveBeenCalled()
 advance(351);act(()=>privateButton.click());expect(clicked).toHaveBeenCalledOnce()
})
it('counts one minute from the last interaction',()=>{
 mount('alice');advance(IDLE_SLEEP_MS-10000);act(()=>window.dispatchEvent(new Event('pointermove')))
 advance(IDLE_SLEEP_MS-1);expect(container.querySelector('[role=dialog]')).toBeNull()
 advance(1);expect(container.querySelector('[role=dialog]')).not.toBeNull()
})
it('never sleeps for anonymous visitors or disabled users and reacts to the preference',()=>{
 mount(undefined);advance(IDLE_SLEEP_MS*2);expect(container.querySelector('[role=dialog]')).toBeNull()
 act(()=>saveSleepEnabled('alice',false));mount('alice');advance(IDLE_SLEEP_MS*2);expect(container.querySelector('[role=dialog]')).toBeNull()
 act(()=>saveSleepEnabled('alice',true));advance(IDLE_SLEEP_MS);expect(container.querySelector('[role=dialog]')).not.toBeNull()
 act(()=>saveSleepEnabled('alice',false));expect(container.querySelector('[role=dialog]')).toBeNull()
})
