import { test,expect } from '@playwright/test'
import type { Page } from '@playwright/test'
async function register(page:Page){
 await page.addInitScript(()=>localStorage.setItem('language','en'))
 await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click()
 await page.getByLabel('Personal name',{exact:true}).fill('Demo visitor')
 await page.getByLabel('Email',{exact:true}).fill(`support-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`)
 await page.getByLabel('Password',{exact:true}).fill('Test-Password-2026')
 await page.locator('form').getByRole('button',{name:'Create account',exact:true}).click()
 await expect(page.locator('.side-navigation-toggle')).toBeVisible()
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click()
}
test('extension offer snoozes, Settings keeps the store link, and feedback survives reload',async({page})=>{
 await page.route('**/extension-config.json',r=>r.fulfill({json:{extensionId:'a'.repeat(32),published:true}}))
 await register(page)
 await expect(page.locator('.extension-prompt')).toBeVisible()
 await page.getByRole('button',{name:'Remind me in 7 days',exact:true}).click()
 await expect(page.locator('.extension-prompt')).toHaveCount(0)
 await page.goto('/#/settings');await page.locator('.settings-group > summary').filter({hasText:'Chrome extension'}).click()
 await expect(page.getByRole('link',{name:'Open Chrome Web Store',exact:true})).toHaveAttribute('href',`https://chromewebstore.google.com/detail/${'a'.repeat(32)}`)
 await expect(page.getByRole('button',{name:'Enable and preview suggestion (admin)',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Turn off installation suggestions',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'Installation suggestions are turned off in this browser.'})).toBeVisible()
 await page.reload();await page.locator('.settings-group > summary').filter({hasText:'Chrome extension'}).click()
 await expect(page.getByRole('button',{name:'Turn off installation suggestions',exact:true})).toBeDisabled()
 await expect(page.getByRole('link',{name:'Open Chrome Web Store',exact:true})).toBeVisible()
 await page.goto('/#/support');await page.getByLabel('Subject',{exact:true}).fill('A test support request')
 await page.getByLabel('Message',{exact:true}).fill('A useful report without private data.\nAnother line.')
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send request',exact:true}).click()
 await expect(page.getByText('Request received. Reference:',{exact:false})).toBeVisible()
 await page.reload();await expect(page.getByRole('heading',{name:'A test support request',exact:true})).toBeVisible()
 await expect(page.locator('.support-message')).toContainText('Another line.')
})
test('unpublished extension has no install offer or broken store link',async({page})=>{
 await register(page);await expect(page.locator('.extension-prompt')).toHaveCount(0)
 await page.goto('/#/settings');await page.locator('.settings-group > summary').filter({hasText:'Chrome extension'}).click();await expect(page.getByText('The extension is awaiting store availability.',{exact:false})).toBeVisible()
 await expect(page.getByRole('link',{name:'Open Chrome Web Store',exact:true})).toHaveCount(0)
})
test('public legal pages render Arabic and English without requiring login',async({page})=>{
 for(const name of ['privacy','terms','support']){
  await page.goto(`/${name}.html?lang=ar`);await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('h1')).not.toBeEmpty()
  await expect(page.locator('a#contact')).toHaveAttribute('href','/#/support')
  await page.goto(`/${name}.html?lang=en`);await expect(page.locator('html')).toHaveAttribute('lang','en')
 }
})
