import { test, expect } from '@playwright/test'
import { prepareUniversityPilot } from './universityFixture'

for(const touch of [false,true])test.describe(touch ? 'touch sections' : 'mouse sections',()=>{
 test.use({viewport:touch?{width:390,height:844}:{width:1280,height:900},hasTouch:touch,isMobile:touch})
 test('compact picker opens intentionally and keeps section editing available',async({page,request},testInfo)=>{
  const account=await prepareUniversityPilot(request,`sections-disclosure-${touch}-${testInfo.repeatEachIndex}@example.test`)
  await page.addInitScript(()=>localStorage.setItem('language','en'))
  await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password)
  await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.locator('.side-navigation-toggle')).toBeVisible()
  const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click()
  await page.goto('/#/personal')
  const panel=page.locator('.sections-disclosure'),trigger=page.locator('.sections-disclosure-trigger')
  await expect(trigger).toBeVisible();await expect(panel).not.toHaveAttribute('open','')
  if(touch)await trigger.tap();else await trigger.hover()
  await expect(panel).toHaveAttribute('open','')
  if(!touch){await trigger.click();await expect(panel).toHaveAttribute('open','')}
  await page.getByRole('button',{name:'Manage sections',exact:true}).click()
  await page.getByLabel('Section name',{exact:true}).fill('My section')
  if(!touch){await page.locator('h1').hover();await expect(page.getByLabel('Section name',{exact:true})).toBeVisible()}
  await page.getByRole('button',{name:'Add section',exact:true}).click()
  await expect(panel.locator('.section-navigation [data-section]')).toContainText('My section')
  await page.getByRole('button',{name:'Manage sections',exact:true}).click()
  await panel.locator('.section-navigation [data-section]').click()
  await expect(trigger).toContainText('My section')
  if(touch){await trigger.tap()}else{await page.locator('h1').hover()}
  await expect(panel).not.toHaveAttribute('open','')
  await trigger.focus();await trigger.press('Enter');await expect(panel).toHaveAttribute('open','')
  await trigger.press('Tab');await expect(page.locator('.section-navigation button').first()).toBeFocused()
  await page.keyboard.press('Escape');await expect(panel).not.toHaveAttribute('open','');await expect(trigger).toBeFocused()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/sections-disclosure/${touch?'phone':'desktop'}-closed.png`,fullPage:true})
 })
})
