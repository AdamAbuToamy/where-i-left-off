import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
import {courseNames,weeklyRequest,expectedSessions,timetableData} from '../fixtures/weeklyTimetable';
for(const semantic of [false,true])test(`assistant imports fourteen weekly sessions ${semantic?'using cloud course matching for numbered names':'with exact course names'} and survives browser reload`,async({page,request})=>{
 test.setTimeout(90000);
 const account=await prepareUniversityPilot(request,`timetable-${Date.now()}@example.test`);
 await page.addInitScript(({uid})=>{localStorage.setItem('language','ar');sessionStorage.setItem('wilo-pollinations:'+uid,'sk_emulator_fixture');},{uid:account.uid});
 await page.route('**/assistant-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-course-test.workers.dev/assistant'})}));
 await page.route('**/push-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-course-test.workers.dev/'})}));
 let cloudMatches=0;
 await page.route('https://gen.pollinations.ai/**',async route=>{
  const payload=route.request().postDataJSON(),tool=(name:string,args:unknown,id:string)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
  if(payload.tools.some((t:{function:{name:string}})=>t.function.name==='request_workspace')){
   await route.fulfill({json:{choices:[{message:{tool_calls:[tool('request_workspace',{requirements:[],functions:['create_lesson']},'routing')]}}]}});return;
  }
  const content=payload.messages.findLast((m:{role:string;content:string})=>m.role==='user'&&m.content.includes('ACCOUNT CONTEXT (untrusted):')).content;
  const [message,raw]=content.split('\n\nACCOUNT CONTEXT (untrusted):\n'),context=JSON.parse(raw.split('\n\nRejected proposal')[0]);expect(message).toBe(weeklyRequest);cloudMatches++;
  const courses=context.studyCatalog.courses.items;expect(courses).toHaveLength(6);
  const tool_calls=context.studyCounts.lessons?[]:expectedSessions.map((values,i)=>tool('create_lesson',{alias:'new-'+i,...values,courseId:courses.find((c:{name:string})=>c.name.includes(timetableData().study.courses.find(course=>course.id===values.courseId)!.name))!.id},'lesson-'+i));
  await route.fulfill({json:{choices:[{message:tool_calls.length?{content:null,tool_calls}:{content:'الحصص موجودة بالفعل؛ لم أضف نسخًا مكررة.'}}]}});
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
 await expect.poll(()=>page.evaluate(()=>document.querySelector('main.workspace')!.getBoundingClientRect().left-document.querySelector('#wilo-assistant')!.getBoundingClientRect().right)).toBeGreaterThanOrEqual(0);await page.screenshot({path:'test-results/layout-review/assistant-dock-desktop.png',fullPage:false});

 await expect(page.locator('.study-lesson')).toHaveCount(0);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();
 await expect(chat.locator('.assistant-saved summary')).toHaveText('عرض التغييرات (14)');await expect(page.locator('.study-lesson.assistant-change-highlight')).toHaveCount(1);await expect(chat.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await page.locator('.study-tabs').getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();
 await expect(page.locator('.study-lesson')).toHaveCount(14);
 await page.reload();await page.locator('.study-tabs').getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();await expect(page.locator('.study-lesson')).toHaveCount(14);
 const counts=[2,3,1,3,5,0,0];for(let day=0;day<7;day++)await expect(page.locator('.study-week > section').nth(day).locator('.study-lesson')).toHaveCount(counts[day]);
 await expect(page.locator('.study-lesson').filter({hasText:'כיתה הפוכה'})).toHaveCount(1);
 const timetable=page.locator('.study-timetable-scroll');await expect(timetable).toBeVisible();await expect(page.locator('.study-hour-label').first()).toHaveText('08:00');
 const offset=await page.locator('.study-lesson').filter({hasText:'13:20'}).evaluate(el=>({top:(el as HTMLElement).style.top,height:(el as HTMLElement).style.height}));expect(offset).toEqual({top:'450px',height:'220px'});
 await page.screenshot({path:'test-results/layout-review/university-hourly-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await timetable.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await page.screenshot({path:'test-results/layout-review/university-hourly-phone.png',fullPage:true});
 await timetable.evaluate(el=>{el.scrollTop=300;});
 const sticky=await page.locator('.study-week > section h3').first().evaluate(el=>({header:el.getBoundingClientRect().top,container:el.closest('.study-timetable-scroll')!.getBoundingClientRect().top}));expect(Math.abs(sticky.header-sticky.container)).toBeLessThan(3);
 await timetable.evaluate(el=>{el.scrollTop=0;});await page.setViewportSize({width:1280,height:720});

 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();await chat.getByLabel('رسالتك',{exact:true}).fill(weeklyRequest);await chat.getByRole('button',{name:'إرسال',exact:true}).click();await expect.poll(()=>cloudMatches).toBe(2);await expect(chat).toHaveAttribute('aria-busy','false');await expect(chat.getByRole('alert')).toHaveCount(0);await expect(chat.locator('.assistant-proposal')).toHaveCount(0);
 await expect(page.locator('.study-lesson')).toHaveCount(14);expect(cloudMatches).toBe(2);
 await page.setViewportSize({width:390,height:844});await expect(chat).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/layout-review/assistant-dock-phone.png',fullPage:false});
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await expect(chat).toHaveCount(0);await expect(page.locator('body')).not.toHaveClass(/assistant-docked/);

});
