import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect,it,vi } from 'vitest'
it('allows only the companion origin and presence message without reading a page',()=>{
 let handler:(message:unknown,sender:unknown,response:unknown)=>void=()=>{}
 const executeScript=vi.fn(),create=vi.fn()
 const chrome={action:{onClicked:{addListener:vi.fn()}},scripting:{executeScript},tabs:{create},runtime:{onMessageExternal:{addListener:(fn:typeof handler)=>{handler=fn}},getManifest:()=>({version:'0.2.2'})}}
 runInNewContext(readFileSync('browser-extension/service-worker.js','utf8'),{chrome,URL})
 const reply=vi.fn()
 for(const sender of [{url:'https://evil.test/'},{url:'https://where-i-left-off.web.app.evil.test/'},{url:'http://where-i-left-off.web.app/'},{}])handler({type:'WILO_PING'},sender,reply)
 handler({type:'CAPTURE'},{url:'https://where-i-left-off.web.app/'},reply)
 expect(reply).not.toHaveBeenCalled()
 handler({type:'WILO_PING'},{url:'https://where-i-left-off.web.app/#/settings'},reply)
 expect(reply).toHaveBeenCalledWith({app:'where-i-left-off',installed:true,version:'0.2.2'})
 expect(executeScript).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled()
 const manifest=JSON.parse(readFileSync('browser-extension/manifest.json','utf8'))
 expect(manifest.permissions).toEqual(['activeTab','scripting'])
 expect(manifest.externally_connectable.matches).toEqual(['https://where-i-left-off.web.app/*'])
})
