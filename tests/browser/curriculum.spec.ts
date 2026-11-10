import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
import {resolve} from 'node:path';
import {jsPDF} from 'jspdf';
for(const mobile of [false,true])test(`curriculum: import, focus, edit and persist ${mobile?'phone':'desktop'}`,async({page,request})=>{
 const {email,password}=await prepareUniversityPilot(request,`curriculum-${mobile?'phone':'desktop'}@example.test`);
 await page.addInitScript(()=>{localStorage.setItem('language','ar');localStorage.setItem('wilo-interface-sound-enabled','false');});
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.route('**/push-config.json',r=>r.fulfill({status:503,body:'{}'}));await page.goto('/');
 await page.locator('input[type=email]').fill(email);await page.locator('.auth-continue').click();await page.locator('input[type=password]').fill(password);await page.locator('form button[type=submit]').click();
 await expect(page.locator('.auth-journey')).toBeHidden();const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 await page.goto('/#/university');await page.getByRole('button',{name:/خريطة الكورسات/}).click();
 const area=page.locator('.curriculum');await expect(area).toBeVisible();
 await area.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/curriculum/synthetic.xlsx'));
 await expect(area.locator('.curriculum-course')).toHaveCount(3);await area.getByRole('button',{name:'حفظ الخطة في الخريطة فقط'}).click();
 await expect(area.locator('.curriculum-review')).toHaveCount(0);
 await area.getByLabel('التركيز على سمستر').selectOption('1:1');await expect(area.locator('.curriculum-muted')).toHaveCount(2);
 await area.getByLabel('التركيز على سمستر').selectOption('');await area.locator('.curriculum-course').filter({hasText:'Programming'}).getByRole('button',{name:'تعديل / نقل'}).click();
 await area.getByLabel('السنة',{exact:true}).fill('2');await area.getByRole('combobox',{name:'السمستر',exact:true}).selectOption('2');await area.getByRole('button',{name:'تطبيق تعديل الكورس'}).click();await area.getByRole('button',{name:'حفظ الخطة في الخريطة فقط'}).click();
 await page.reload();await expect(area.locator('.curriculum-course')).toHaveCount(3);await expect(area.locator('.curriculum-term').filter({hasText:'السنة 2 · السمستر 2'})).toContainText('Programming');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 // Office and PDF adapters are exercised in the actual browser, no network analysis.
 await area.locator('input[type=file]').setInputFiles(resolve('tests/fixtures/curriculum/synthetic.docx'));await expect(area.locator('.curriculum-course')).toHaveCount(3);await area.getByRole('button',{name:'إلغاء التعديلات'}).click();
 const pdf=new jsPDF();pdf.text('Year 1 Semester 1',20,20);pdf.text('301 Example Course',20,35);
 await area.locator('input[type=file]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))});await expect(area.locator('.curriculum-course')).toHaveCount(1);await expect(area).toContainText('Example Course');await area.getByRole('button',{name:'إلغاء التعديلات'}).click();
 const active=await page.evaluate(()=>{const entries=Object.keys(localStorage).filter(k=>k.startsWith('wilo-university-v1/')&&!k.endsWith('/sync'));return entries.map(k=>JSON.parse(localStorage.getItem(k)!).courses.length);});expect(active.every(n=>n===0)).toBe(true);
});
