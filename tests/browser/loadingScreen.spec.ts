import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { prepareUniversityPilot } from './universityFixture'

test('account loading stays branded, responsive and accessible until real verification completes', async ({page,request}) => {
  const account = await prepareUniversityPilot(request, 'loading-screen@example.test')
  await page.addInitScript(() => localStorage.setItem('language', 'ar'))
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route(/google\.firestore\.v1\.Firestore\/Listen\/channel/, async route => {
    await pending
    await route.continue()
  })
  try {
    await page.goto('/')
    await page.getByLabel('البريد الإلكتروني', {exact:true}).fill(account.email)
    await page.getByLabel('كلمة المرور', {exact:true}).fill(account.password)
    await page.locator('form').getByRole('button', {name:'تسجيل الدخول',exact:true}).click()
    const screen = page.locator('.wilo-loading')
    await expect(screen).toBeVisible()
    await expect(screen.getByRole('status')).toHaveText('جارٍ التحقق من حالة الحساب…')
    await expect(page.locator('.side-navigation-toggle')).toHaveCount(0)
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:844})
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(screen.getByRole('heading', {name:'نجهّز مساحتك'})).toBeVisible()
      await page.screenshot({path:`test-results/loading-screen/arabic-${width}.png`,fullPage:true})
    }
    await page.emulateMedia({reducedMotion:'reduce'})
    expect(await screen.locator('.wilo-loading-card-front').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
    for (const theme of ['original','ocean','violet','sunset','rose']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      const result = await new AxeBuilder({page}).include('.wilo-loading').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()
      expect(result.violations, theme).toEqual([])
    }
    await page.locator('.language-trigger').click()
    await page.getByRole('button', {name:'English',exact:true}).click()
    await expect(screen).toHaveAttribute('dir','ltr')
    await expect(screen.getByRole('status')).toHaveText('Checking account status…')
    await page.locator('.language-trigger').click()
    await page.getByRole('button', {name:'עברית',exact:true}).click()
    await expect(screen).toHaveAttribute('dir','rtl')
    await expect(screen.getByRole('heading')).toHaveText('מכינים את המרחב שלך')
  } finally { release() }
  await expect(page.locator('.wilo-loading')).toHaveCount(0)
  await expect(page.locator('.side-navigation-toggle')).toBeVisible()
})
