// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import SideNavigation from '../src/components/SideNavigation'
let root:Root,container:HTMLDivElement
function pointer(target:Element,type:string,pointerType:string){const event=new Event(type,{bubbles:true});Object.defineProperty(event,'pointerType',{value:pointerType});act(()=>target.dispatchEvent(event))}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<SideNavigation language="en" page="settings" admin={false}/>))})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('starts collapsed, opens by mouse entry, closes on exit and outside press',()=>{
 const nav=container.querySelector('nav')!,button=container.querySelector('button')!,rail=container.querySelector('.side-navigation')!
 expect(nav.getAttribute('aria-hidden')).toBe('true');expect(nav.hasAttribute('inert')).toBe(true)
 pointer(rail,'pointerover','mouse');expect(button.getAttribute('aria-expanded')).toBe('true')
 pointer(rail,'pointerout','mouse');expect(button.getAttribute('aria-expanded')).toBe('false')
 act(()=>button.click());pointer(document.body,'pointerdown','mouse');expect(button.getAttribute('aria-expanded')).toBe('false')
})
it('touch entry does not open it, but tapping the trigger does; Escape returns focus',()=>{
 const button=container.querySelector('button')!,rail=container.querySelector('.side-navigation')!
 pointer(rail,'pointerover','touch');expect(button.getAttribute('aria-expanded')).toBe('false')
 act(()=>button.click());expect(button.getAttribute('aria-expanded')).toBe('true')
 act(()=>{container.querySelector('a')!.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))})
 expect(button.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(button)
})
it('keeps the selected page, translated labels, and hides admin navigation from regular users',()=>{
 expect(container.querySelector('[aria-current=page]')?.getAttribute('href')).toBe('#/settings')
 expect(container.querySelector('a[href="#/admin"]')).toBeNull()
 act(()=>root.render(<SideNavigation language="ar" page="personal" admin/>))
 expect(container.querySelector('button')?.textContent).toBe('القائمة');expect(container.querySelector('[aria-current=page]')?.textContent).toBe('مشاريعي')
 expect(container.querySelector('a[href="#/admin"]')).not.toBeNull()
 act(()=>root.render(<SideNavigation language="he" page="personal" admin={false}/>))
 expect(container.querySelector('button')?.textContent).toBe('תפריט')
})
