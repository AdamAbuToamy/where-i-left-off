import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
function worker(owner:string) {
 const listeners:Record<string,(e:unknown)=>void>={},showNotification:unknown[]=[],opened:unknown[]=[]
 const context={URL,Response,Promise,console,caches:{open:async()=>({match:async()=>new Response(owner)})},self:{location:{origin:'https://example.test'},addEventListener:(type:string,fn:(e:unknown)=>void)=>{listeners[type]=fn},registration:{showNotification:async(...args:unknown[])=>showNotification.push(args)},clients:{matchAll:async()=>[],openWindow:async(url:string)=>opened.push(url)}}}
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),context)
 async function dispatch(type:string,event:Record<string,unknown>) { let pending:Promise<unknown>=Promise.resolve();listeners[type]({...event,waitUntil:(p:Promise<unknown>)=>{pending=p}});await pending }
 return {dispatch,showNotification,opened}
}
it('shows a background push only for the device’s current account',async()=>{
 const w=worker('user-a')
 await w.dispatch('push',{data:{json:()=>({uid:'user-b',title:'Private',body:'Secret'})}})
 expect(w.showNotification).toHaveLength(0)
 await w.dispatch('push',{data:{json:()=>({uid:'user-a',title:'Task',body:'Open app',url:'#/settings'})}})
 expect(w.showNotification).toHaveLength(1)
})
it('drops malformed pushes and pushes after sign-out',async()=>{
 const w=worker('')
 await w.dispatch('push',{data:{json:()=>{throw new Error('bad')}}})
 await w.dispatch('push',{data:{json:()=>({uid:'user-a',title:'Secret'})}})
 expect(w.showNotification).toHaveLength(0)
})
it('opens the exact card, rejecting foreign links and stale account notifications',async()=>{
 const w=worker('user-a'),id='a'.repeat(20)
 const notification=(uid:string,url:string)=>({data:{uid,url},close:()=>{}})
 await w.dispatch('notificationclick',{notification:notification('user-b',`#/personal/${id}`)})
 expect(w.opened).toHaveLength(0)
 await w.dispatch('notificationclick',{notification:notification('user-a',`#/personal/${id}`)})
 expect(w.opened).toEqual([`https://example.test/#/personal/${id}`])
 await w.dispatch('notificationclick',{notification:notification('user-a','https://evil.test/')})
 expect(w.opened[1]).toBe('https://example.test/#/resume')
})
