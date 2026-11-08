import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
import type {BrowserContext} from '@playwright/test';
test('account connection works in separate desktop and phone contexts and after reload without a device key',async({browser,request})=>{
 const user=await prepareUniversityPilot(request,'account-connection-devices@example.test');
 let completions=0;
 const contexts:BrowserContext[]=[];
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({baseURL:`http://127.0.0.1:${process.env.TEST_PREVIEW_PORT||5173}`,viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});contexts.push(context);
   await context.addInitScript(()=>localStorage.setItem('language','en'));
   await context.route('**/push-config.json',route=>route.fulfill({json:{endpoint:'https://account-fixture.workers.dev/'}}));
   await context.route('https://account-fixture.workers.dev/assistant-account',async route=>{
    expect(route.request().headers().authorization).toMatch(/^Bearer /);expect(route.request().headers()['x-firebase-appcheck']).toBe('local-browser-test-only');
    const body=route.request().postDataJSON();expect(body.key).toBeUndefined();
    if(body.action==='connection-status')await route.fulfill({json:{result:{connected:true}}});
    else if(body.action==='completion'){completions++;await route.fulfill({json:{choices:[{message:{content:'Account connection is working'}}]}});}
    else throw new Error('Unexpected fixture request');
   });
   const page=await context.newPage();await page.goto('/');
   await page.getByLabel('Email',{exact:true}).fill(user.email);await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel('Password',{exact:true}).fill(user.password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
   await expect(page.locator('.side-navigation-toggle')).toBeVisible({timeout:15000});
   if(await page.locator('.guide-skip').isVisible())await page.locator('.guide-skip').click();
   for(const reload of [false,true]){
    if(reload)await page.reload();
    await page.locator('.assistant-launcher').click();
    const panel=page.locator('.assistant-panel');await expect(panel).toBeVisible();
    await expect(panel.locator('textarea')).toBeEnabled({timeout:15000});
    await expect(panel.getByRole('button',{name:'Connect assistant',exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('wilo-pollinations:')))).toEqual([]);
    await panel.locator('textarea').fill('Hello');await panel.locator('.assistant-send').click();await expect(panel).toContainText('Account connection is working');
   }
  }
  expect(completions).toBe(4);
 }finally{for(const context of contexts)await context.close();}
});
