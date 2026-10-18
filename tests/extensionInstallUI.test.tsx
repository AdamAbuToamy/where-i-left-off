// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import ExtensionInstall from '../src/components/ExtensionInstall'
let root:Root,container:HTMLDivElement
async function render(settings=false){await act(async()=>{root.render(<ExtensionInstall language="en" settings={settings}/>);await Promise.resolve();await Promise.resolve()})}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear()
 vi.stubGlobal('navigator',{userAgent:'Mozilla Chrome/130 Safari/537',onLine:true})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({extensionId:'a'.repeat(32),published:true})}))
 vi.stubGlobal('chrome',undefined)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()})
it('hides after snooze but keeps a permanent store link in Settings',async()=>{
 await render();expect(container.querySelector('.extension-prompt')).not.toBeNull()
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Remind me in 7 days')!.click())
 expect(container.querySelector('.extension-prompt')).toBeNull()
 await render(true);expect(container.querySelector('a')?.href).toContain('chromewebstore.google.com/detail/')
 expect(container.textContent).toContain('Installation could not be confirmed')
})
it('positive presence detection prevents installation suggestions',async()=>{
 vi.stubGlobal('chrome',{runtime:{sendMessage:(_id:unknown,_message:unknown,cb:(v:unknown)=>void)=>cb({app:'where-i-left-off',installed:true})}})
 await render();expect(container.querySelector('.extension-prompt')).toBeNull()
 await render(true);expect(container.textContent).toContain('Extension detected');expect(container.querySelector('a')).toBeNull()
})
it('unpublished item and mobile devices never receive an installation link',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({extensionId:'a'.repeat(32),published:false})}))
 await render();expect(container.querySelector('.extension-prompt')).toBeNull()
 await render(true);expect(container.textContent).toContain('awaiting store availability');expect(container.querySelector('a')).toBeNull()
 vi.stubGlobal('navigator',{userAgent:'Android Chrome/130',onLine:true});await render(true)
 expect(container.textContent).toContain('On your phone');expect(container.querySelector('a')).toBeNull()
})
