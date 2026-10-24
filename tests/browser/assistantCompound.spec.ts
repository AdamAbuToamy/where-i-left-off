import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
// Injected provider replies exercise routing, validation/repair, actual Firestore writes and reload.
// They are not a measurement of live model inference quality.
test('compound Arabic requests use the cloud, repair malformed proposals, save related records and open the dated card week',async({page,request})=>{
 test.setTimeout(90000);
 const account=await prepareUniversityPilot(request,`compound-${Date.now()}@example.test`);
 await page.addInitScript(()=>localStorage.setItem('language','ar'));
 await page.route('**/assistant-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-compound-test.workers.dev/assistant'})}));
 await page.route('**/push-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-compound-test.workers.dev/'})}));
 const courseMessage='اضف كورس اسمه محمد. وضعه في البرنامج ايام الاحد الساعة 00:00 حتى 1:00';
 const cardMessage='أضف بطاقة باسم عمار وضعها في الاسبوع يوم 25 الشهر\nأضف للملاحظات: مرحبا';
 let calls=0,date='';
 await page.route('https://wilo-compound-test.workers.dev/assistant',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-firebase-appcheck','access-control-allow-methods':'POST,OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  calls++;const payload=route.request().postDataJSON();expect(payload.mode).toBe('workspace');expect([courseMessage,cardMessage]).toContain(payload.message);
  const context=JSON.parse(payload.context);expect(context.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);date=context.localDate.slice(0,7)+'-25';
  const course=payload.message===courseMessage;
  const actions=course?[
   {target:'courses',action:'create',id:'new-course',values:{name:'محمد',...(!payload.repair?{day:0}:{})}},
   {target:'lessons',action:'create',id:'new-class',values:{courseId:'new-course',day:0,start:'00:00',end:'01:00',sessionType:'lecture',room:''}},
  ]:[{target:'projects',action:'create',id:'new-card',scope:'personal',values:{name:'عمار',dueDate:payload.repair?date:'25',description:'مرحبا'}}];
  const controls=course?[]:[{kind:'navigate',values:{page:'personal',view:'week',weekOf:date}}];
  const tasks=course?[
   {title:'إنشاء الكورس',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},
   {title:'إضافة حصة الأحد',outcome:'proposed',actionIndexes:[1],controlIndexes:[],detail:''},
  ]:[
   {title:'إنشاء البطاقة',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},
   {title:'تحديد التاريخ وفتح الأسبوع',outcome:'proposed',actionIndexes:[0],controlIndexes:[0],detail:''},
   {title:'إضافة ملاحظة مرحبا',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''},
  ];
  if(payload.repair)expect(payload.repair.reason).toBe(course?'assistant-fields':'invalid-due-date');
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({result:{text:JSON.stringify({text:'راجع التغييرات',actions,controls,tasks,files:[]})}})});
 });
 await page.goto('/');await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(account.email);await page.getByLabel('كلمة المرور',{exact:true}).fill(account.password);
 await page.locator('form').getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page.locator('.side-navigation-toggle')).toBeVisible();
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 await page.goto('/#/university');await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();const chat=page.locator('#wilo-assistant');
 async function ask(message:string){await chat.getByLabel('رسالتك',{exact:true}).fill(message);await chat.getByRole('button',{name:'إرسال',exact:true}).click();await expect(chat.getByRole('button',{name:'تطبيق التغييرات',exact:true})).toBeVisible({timeout:15000});await expect(chat.getByRole('alert')).toHaveCount(0);}
 await ask(courseMessage);await expect(chat.locator('.assistant-proposal details')).toHaveCount(2);await expect(page.locator('.study-course-name')).toHaveCount(0);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();await expect(chat.locator('.assistant-saved summary')).toHaveText('عرض التغييرات (2)');await expect(page.locator('[data-study-course].assistant-change-highlight')).toHaveCount(1);
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await page.reload();
 await expect(page.locator('.study-course-name')).toHaveText('محمد');await page.getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();
 await expect(page.locator('.study-lesson')).toHaveCount(1);await expect(page.locator('.study-lesson')).toContainText('00:00');await expect(page.locator('.study-lesson')).toContainText('01:00');
 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();await ask(cardMessage);await expect(chat.locator('.assistant-proposal details')).toHaveCount(2);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();await expect(chat).toContainText('تم تطبيق التغييرات في الموقع.');await expect(chat.locator('.assistant-message-author')).toHaveCount(0);await expect(page.locator('.week-item.assistant-change-highlight')).toHaveCount(1);await expect(page).toHaveURL(new RegExp('weekOf='+date));
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await expect(page.locator('.week-item').filter({hasText:'عمار'})).toHaveCount(1);
 await page.reload();await expect(page.locator('.week-item').filter({hasText:'عمار'})).toHaveCount(1);
 await expect(page.locator('.week-day').filter({has:page.locator(`time[datetime="${date}"]`)})).toContainText('عمار');expect(calls).toBe(4);
 await page.goto('/#/personal');await expect(page.getByRole('heading',{name:'عمار',exact:true})).toHaveCount(1);const card=page.locator('.project-card').filter({has:page.getByRole('heading',{name:'عمار',exact:true})});await card.getByText('الملاحظات والوصف',{exact:true}).click();await expect(card).toContainText('مرحبا');
 await page.screenshot({path:'test-results/layout-review/assistant-compound-card-week.png',fullPage:true});
});
