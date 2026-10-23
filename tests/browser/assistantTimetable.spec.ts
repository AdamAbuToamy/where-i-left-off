import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
import {courseNames,weeklyRequest} from '../fixtures/weeklyTimetable';
for(const semantic of [false,true])test(`assistant imports fourteen weekly sessions ${semantic?'using cloud course matching for numbered names':'with exact course names'} and survives browser reload`,async({page,request})=>{
 test.setTimeout(90000);
 const account=await prepareUniversityPilot(request,`timetable-${Date.now()}@example.test`);
 await page.addInitScript(()=>localStorage.setItem('language','ar'));
 await page.route('**/push-config.json',route=>route.fulfill(semantic?{status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-course-test.workers.dev/'})}:{status:503,body:'{}'}));
 let cloudMatches=0;
 await page.route('https://wilo-course-test.workers.dev/assistant',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-firebase-appcheck','access-control-allow-methods':'POST,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  const payload=route.request().postDataJSON();expect(payload.mode).toBe('course-match');const context=JSON.parse(payload.context);cloudMatches++;
  expect(context.requested).toHaveLength(6);expect(context.courses).toHaveLength(6);
  const matches=context.requested.map((requested:string)=>({requested,courseId:context.courses.find((c:{name:string})=>c.name.includes(requested)).id,candidates:[]}));
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({result:{text:JSON.stringify({matches})}})});
 });
 await page.goto('/');await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(account.email);
 await page.getByLabel('كلمة المرور',{exact:true}).fill(account.password);
 await page.locator('form').getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
 await expect(page.locator('.side-navigation-toggle')).toBeVisible();const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 await page.goto('/#/university');
 for(const courseName of courseNames){const name=semantic?'2026-2027 / 202-1-1234 '+courseName+' — סמסטר א':courseName;
  await page.locator('.study-toolbar').getByRole('button',{name:'إضافة كورس',exact:true}).click();
  await page.getByLabel('اسم الكورس',{exact:true}).fill(name);await page.getByRole('button',{name:'حفظ',exact:true}).click();
  await expect(page.locator('.study-storage')).toContainText('تمت المزامنة مع حسابك');
 }
 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();
 const chat=page.locator('#wilo-assistant');await chat.getByLabel('رسالتك',{exact:true}).fill(weeklyRequest);await chat.getByRole('button',{name:'إرسال',exact:true}).click();
 await expect(chat.locator('.assistant-proposal details')).toHaveCount(14);
 await expect(page.locator('.study-lesson')).toHaveCount(0);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();
 await expect(chat).toContainText('الحصص التي أُضيفت وحُفظت: 14');await expect(chat.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await page.getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();
 await expect(page.locator('.study-lesson')).toHaveCount(14);
 await page.reload();await page.getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();await expect(page.locator('.study-lesson')).toHaveCount(14);
 const counts=[2,3,1,3,5,0,0];for(let day=0;day<7;day++)await expect(page.locator('.study-week > section').nth(day).locator('.study-lesson')).toHaveCount(counts[day]);
 await expect(page.locator('.study-lesson').filter({hasText:'כיתה הפוכה'})).toHaveCount(1);
 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();await chat.getByLabel('رسالتك',{exact:true}).fill(weeklyRequest);await chat.getByRole('button',{name:'إرسال',exact:true}).click();await expect(chat).toContainText('حصص مطابقة موجودة بالفعل: 14');await expect(chat.locator('.assistant-proposal')).toHaveCount(0);
 await expect(page.locator('.study-lesson')).toHaveCount(14);expect(cloudMatches).toBe(semantic?2:0);
});
