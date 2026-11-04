import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepareUniversityPilot} from './universityFixture';
for(const phone of [false,true])test.describe(phone?'Arabic phone semantics':'English desktop semantics',()=>{
 test.use({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone});
 test('one main landmark, top-level banner/footer, named navigation and keyboard skip preserve routes',async({page,request})=>{
  test.setTimeout(120000);const c=await prepareUniversityPilot(request,'semantics-'+phone+'@example.test');
  await page.addInitScript(uid=>{localStorage.setItem('language','en');localStorage.setItem('welcome-tour:v2:'+uid,'done');},c.uid);
  await page.goto('/');await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('banner')).toHaveCount(1);await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await page.getByLabel('Email',{exact:true}).fill(c.email);await page.getByLabel('Password',{exact:true}).fill(c.password);await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.workspace-toolbar')).toBeVisible({timeout:15000});
  if(phone){await page.locator('.mobile-bottom-navigation').getByRole('button',{name:'More',exact:true}).click();await page.locator('.mobile-menu-account').getByRole('button',{name:'العربية',exact:true}).click();}
  for(const [route,selector]of [['personal','.workspace-toolbar'],['university','.study-page'],['settings','.settings-page'],['analytics','.analytics-page'],['library','.library-page'],['groups','.group-spaces'],['support','.support-page']]){
   await page.evaluate(route=>{location.hash='/'+route;},route);await expect(page.locator(selector)).toBeVisible();
   await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('banner')).toHaveCount(1);await expect(page.getByRole('contentinfo')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
   expect(await page.locator('.page-header').evaluate(el=>el.closest('main')===null)).toBe(true);expect(await page.locator('.site-footer').evaluate(el=>el.closest('main')===null)).toBe(true);
   const before=page.url();await page.locator('.skip-to-content').focus();await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();expect(page.url()).toBe(before);
   const audit=await new AxeBuilder({page}).withRules(['landmark-one-main','landmark-main-is-top-level','landmark-banner-is-top-level','landmark-contentinfo-is-top-level','page-has-heading-one','heading-order']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
   for(const nav of await page.getByRole('navigation').all()){expect(await nav.evaluate(el=>!!(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')))).toBe(true);}
  }
 });
});
