import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
test('legacy account can load each page and repeated navigation removes the previous screen',async({page,request})=>{
 const {email,password,uid}=await prepareUniversityPilot(request);
 const seed=await request.patch(`http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/appMetrics/${uid}`,{headers:{Authorization:'Bearer owner'},data:{fields:{email:{stringValue:email},firstSeen:{timestampValue:'2026-01-01T00:00:00Z'},lastSeen:{timestampValue:'2026-01-01T00:00:00Z'}}}});expect(seed.ok()).toBe(true);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('language','en'));
 await page.route('**/push-config.json',r=>r.fulfill({status:503,body:'{}'}));
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('.side-navigation-toggle')).toBeVisible();
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 for(const path of ['university','resume','settings','analytics','groups','personal','admin','admin/logs','settings','resume','personal']){
  await page.evaluate(hash=>{location.hash='/'+hash;},path);
  const current=path.split('/')[0];await expect(page.locator('.account-page-outlet')).toHaveCount(1);await expect(page.locator('.account-page-outlet')).toHaveAttribute('data-page',current);
  if(current==='university')await expect(page.locator('.study-page')).toBeVisible();
  if(current==='personal')await expect(page.getByRole('button',{name:'New card',exact:true})).toBeVisible();
  if(current==='groups')await expect(page.locator('.group-spaces')).toBeVisible();
  if(current==='admin')await expect(page.locator('.admin-dashboard')).toHaveCount(1);
  for(const [owner,selector] of Object.entries({university:'.study-page',resume:'.resume-page',settings:'.settings-page',analytics:'.analytics-page',admin:'.admin-dashboard'}))if(owner!==current)await expect(page.locator(selector)).toHaveCount(0);
  await expect(page.getByText(/permission-denied|Check sign-in and deployed Firestore rules/)).toHaveCount(0);
 }
 await page.evaluate(()=>{location.hash='/university';});await expect(page.locator('.study-page')).toBeVisible();
 await page.evaluate(()=>{location.hash='/resume';});await expect(page.locator('.resume-page')).toBeVisible();
 await page.goBack();await expect(page.locator('.study-page')).toBeVisible();
 await page.evaluate(()=>{location.hash='/personal';});
 expect(errors).toEqual([]);
 await page.getByRole('button',{name:'New card',exact:true}).click();await expect(page.locator('form.new-project-form')).toBeVisible();
});
