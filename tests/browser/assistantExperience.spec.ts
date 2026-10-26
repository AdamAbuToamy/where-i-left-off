import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {mkdir} from 'node:fs/promises';
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
for(const mobile of [false,true])test.describe('assistant studio '+(mobile?'phone':'desktop'),()=>{
 test.use({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 test('real organizer layout, rich replies, suggestion chips, stop and reduced motion',async({page})=>{
  const app=getApps().find(a=>a.name==='experience-tests')||initializeApp({projectId:'demo-where-i-left-off'},'experience-tests'),email='studio-'+Date.now()+'@example.test',password='Test-Password-2026';
  const user=await getAuth(app).createUser({email,password,emailVerified:true,displayName:'آدم'});
  await page.addInitScript(({uid})=>{if(!localStorage.getItem('language'))localStorage.setItem('language','en');sessionStorage.setItem('wilo-pollinations:'+uid,'sk_synthetic_visual_test');},{uid:user.uid});
  let pending=false;
  await page.route('https://gen.pollinations.ai/**',async route=>{
   if(pending){await new Promise(resolve=>setTimeout(resolve,1800));try{await route.fulfill({json:{choices:[{message:{content:'LATE_REPLY_MUST_NOT_RENDER'}}]}});}catch{/* The user deliberately cancelled this request. */}return;}
   await route.fulfill({json:{choices:[{message:{content:'## خطوتك القادمة\n\n**كل شيء في مكانه.**\n\n- مشروع البرمجة: 28 أكتوبر\n- المراجعة: 26 أكتوبر\n\n| المهمة | الموعد |\n| --- | --- |\n| البرمجة | 28 أكتوبر |\n| المراجعة | 26 أكتوبر |'}}]}});
  });
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('.side-navigation-toggle')).toBeVisible();
  const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
  await page.goto('/#/personal');await page.getByRole('button',{name:'New card',exact:true}).click();await page.getByLabel('Card title',{exact:true}).fill('مشروع البرمجة');await page.getByLabel('Next step',{exact:true}).fill('تجربة الربط وحفظ البيانات');await page.getByRole('button',{name:'Save card',exact:true}).click();
  await expect(page.getByRole('heading',{name:'مشروع البرمجة',exact:true})).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('language','ar'));await page.reload();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'مشروع البرمجة',exact:true})).toBeVisible();await expect(page.locator('.account-page-outlet')).toHaveCSS('opacity','1');
  await mkdir('test-results/experience',{recursive:true});
  await page.screenshot({path:'test-results/experience/board-'+(mobile?'phone':'desktop')+'.png',fullPage:true});
  await page.locator('.assistant-launcher').click();await expect(page.locator('.assistant-suggestions button')).toHaveCount(3);await expect(page.locator('.assistant-panel')).toHaveCSS('opacity','1');await expect(page.locator('.assistant-suggestions button').last()).toHaveCSS('opacity','1');
  await page.screenshot({path:'test-results/experience/welcome-'+(mobile?'phone':'desktop')+'.png'});
  await page.locator('.assistant-suggestions button').first().click();await expect(page.locator('.assistant-panel textarea')).toHaveValue('لخّص كورساتي');
  await page.locator('.assistant-send').click();await expect(page.locator('.assistant-rich-text h2')).toHaveText('خطوتك القادمة');await expect(page.locator('.assistant-rich-text table')).toBeVisible();await expect(page.locator('.assistant-message.is-assistant').last()).toHaveCSS('opacity','1');
  await page.screenshot({path:'test-results/experience/reply-'+(mobile?'phone':'desktop')+'.png'});
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  const size=await page.locator('.assistant-panel').boundingBox();expect(size!.x).toBeGreaterThanOrEqual(0);expect(size!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  pending=true;await page.locator('.assistant-panel textarea').fill('طلب جديد');await page.locator('.assistant-send').click();await expect(page.locator('.assistant-stop')).toBeVisible();
  await page.locator('.assistant-stop').click();await expect(page.locator('.assistant-waiting')).toHaveCount(0);await page.waitForTimeout(2000);await expect(page.locator('.assistant-panel')).not.toContainText('LATE_REPLY');
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.project-card').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 });
});
