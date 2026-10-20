import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
async function register(page:Page){
 await page.addInitScript(()=>localStorage.setItem('language','en'))
 await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click()
 await page.getByLabel('Personal name',{exact:true}).fill('Notifications tester')
 await page.getByLabel('Email',{exact:true}).fill(`push-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`)
 await page.getByLabel('Password',{exact:true}).fill('Test-Password-2026')
 await page.locator('form').getByRole('button',{name:'Create account',exact:true}).click()
 await expect(page.locator('.side-navigation-toggle')).toBeVisible()
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click()
}
test('ordinary browser tabs cannot see notification settings',async({page})=>{
 await register(page);await page.goto('/#/settings')
 await expect(page.getByRole('link',{name:'Open notification settings',exact:true})).toHaveCount(0)
 await page.goto('/#/notifications')
 await expect(page.getByText('Open the installed app from its icon to manage notifications.',{exact:true})).toBeVisible()
})
test('installed phone exposes explicit opt-in, category preferences and persistent opt-out',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.addInitScript(()=>{
  const match=window.matchMedia.bind(window)
  window.matchMedia=(q:string)=>{const media=match(q);if(q==='(display-mode: standalone)')Object.defineProperty(media,'matches',{value:true});return media}
  let permission='default',subscription:PushSubscription|null=null
  Object.defineProperty(Notification,'permission',{configurable:true,get:()=>permission})
  Notification.requestPermission=async()=>{permission='granted';return 'granted'}
  const manager={getSubscription:async()=>subscription,subscribe:async()=>{
   subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/demo',keys:{auth:'a'.repeat(22),p256dh:'b'.repeat(87)}}),unsubscribe:async()=>{subscription=null;return true}} as PushSubscription
   return subscription
  }}
  const registration={pushManager:manager,getNotifications:async()=>[]}
  Object.defineProperty(navigator.serviceWorker,'ready',{configurable:true,value:Promise.resolve(registration)})
  navigator.serviceWorker.getRegistration=async()=>registration as unknown as ServiceWorkerRegistration
 })
 const prefs={enabled:false,due:true,stale:false,staleDays:14,defaultTime:'09:00',leadMinutes:0,quiet:true,quietStart:'22:00',quietEnd:'08:00',hideContent:true,timezone:'UTC',language:'en'}
 const actions:string[]=[]
 await page.route('**/push-config.json',r=>r.fulfill({json:{endpoint:'https://wilo-test.test.workers.dev/'}}))
 await page.route('https://wilo-test.test.workers.dev/**',async route=>{
  const request=route.request(),data=request.postDataJSON() || {};actions.push(data.action)
  if(data.action==='save')Object.assign(prefs,data.preferences)
  await route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization,x-firebase-appcheck','access-control-allow-methods':'POST,OPTIONS'},json:{result:data.action==='get'?{preferences:prefs,publicKey:'a'.repeat(87),cards:{}}:{ok:true}}})
 })
 await register(page);await page.goto('/#/settings')
 await page.locator('.settings-group > summary').filter({hasText:'Notifications'}).click()
 await page.getByRole('link',{name:'Open notification settings',exact:true}).click()
 await expect(page.getByRole('button',{name:'Enable notifications on this phone',exact:true})).toBeVisible()
 expect(actions).not.toContain('subscribe')
 await page.getByRole('button',{name:'Enable notifications on this phone',exact:true}).click()
 await expect(page.getByRole('button',{name:'Disable notifications on this phone',exact:true})).toBeVisible()
 expect(prefs.enabled).toBe(true)
 await page.getByRole('checkbox',{name:'Remind me about cards I have not returned to',exact:true}).check()
 await page.getByRole('button',{name:'Save preferences',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('saved')
 expect(prefs.stale).toBe(true)
 await page.screenshot({path:'test-results/notifications-review/mobile-en.png',fullPage:true})
 await page.getByRole('button',{name:'Disable notifications on this phone',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('disabled')
 expect(actions).toContain('unsubscribe')
 // A reload must not silently subscribe again.
 const before=actions.filter(a=>a==='subscribe').length
 await page.reload()
 await expect(page.getByRole('button',{name:'Enable notifications on this phone',exact:true})).toBeVisible()
 expect(actions.filter(a=>a==='subscribe')).toHaveLength(before)
 await page.evaluate(()=>localStorage.setItem('language','ar'));await page.reload()
 await expect(page.getByRole('heading',{name:'الإشعارات',exact:true})).toBeVisible()
 await page.screenshot({path:'test-results/notifications-review/mobile-ar.png',fullPage:true})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
