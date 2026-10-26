import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
// Injected provider replies exercise routing, validation/repair, actual Firestore writes and reload.
// They are not a measurement of live model inference quality.
test('compound Arabic requests use the cloud, repair malformed proposals, save related records and open the dated card week',async({page,request})=>{
 test.setTimeout(90000);
 const account=await prepareUniversityPilot(request,`compound-${Date.now()}@example.test`);
 await page.addInitScript(({uid})=>{localStorage.setItem('language','ar');sessionStorage.setItem('wilo-pollinations:'+uid,'sk_emulator_fixture');},{uid:account.uid});
 await page.route('**/assistant-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-compound-test.workers.dev/assistant'})}));
 await page.route('**/push-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({endpoint:'https://wilo-compound-test.workers.dev/'})}));
 const courseMessage='اضف كورس اسمه محمد. وضعه في البرنامج ايام الاحد الساعة 00:00 حتى 1:00';
 const cardMessage='أضف بطاقة باسم عمار وضعها في الاسبوع يوم 25 الشهر\nأضف للملاحظات: مرحبا';
 let calls=0,date='';
 await page.route('https://gen.pollinations.ai/**',async route=>{
  const payload=route.request().postDataJSON(),tool=(name:string,args:unknown,id:string)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
  if(payload.tools.some((t:{function:{name:string}})=>t.function.name==='request_workspace')){
   await route.fulfill({json:{choices:[{message:{tool_calls:[tool('request_workspace',{requirements:[]},'routing')]}}]}});return;
  }
  calls++;const content=payload.messages.findLast((m:{role:string;content:string})=>m.role==='user'&&m.content.includes('ACCOUNT CONTEXT (untrusted):')).content;
  const [message,raw]=content.split('\n\nACCOUNT CONTEXT (untrusted):\n'),context=JSON.parse(raw.split('\n\nRejected proposal')[0]);
  expect([courseMessage,cardMessage]).toContain(message);expect(context.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);date=context.localDate.slice(0,7)+'-25';
  const repair=content.includes('Rejected proposal')||payload.messages.some((m:{role:string;content:string})=>m.role==='user'&&m.content.startsWith('Your tool arguments were invalid')),course=message===courseMessage;
  const tool_calls=course?[
   tool('create_course',{alias:'new-course',name:'محمد',...(!repair?{day:0}:{})},'course'),
   tool('create_lesson',{alias:'new-class',courseId:'new-course',day:0,start:'00:00',end:'01:00',sessionType:'lecture',room:''},'lesson')
  ]:[
   tool('create_card',{alias:'new-card',name:'عمار',dueDate:repair?date:'25',description:'مرحبا'},'card'),
   tool('navigate',{page:'personal',view:'week',weekOf:date},'navigate')
  ];
  await route.fulfill({json:{choices:[{message:{content:null,tool_calls}}]}});
 });
 await page.goto('/');await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(account.email);await page.getByLabel('كلمة المرور',{exact:true}).fill(account.password);
 await page.locator('form').getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page.locator('.side-navigation-toggle')).toBeVisible();
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 await page.goto('/#/university');await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();const chat=page.locator('#wilo-assistant');
 async function ask(message:string){await chat.getByLabel('رسالتك',{exact:true}).fill(message);await chat.getByRole('button',{name:'إرسال',exact:true}).click();await expect(chat.getByRole('button',{name:'تطبيق التغييرات',exact:true})).toBeVisible({timeout:15000});await expect(chat.getByRole('alert')).toHaveCount(0);}
 await ask(courseMessage);await expect(chat.locator('.assistant-proposal details')).toHaveCount(2);await expect(page.locator('.study-course-choice strong')).toHaveCount(0);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();await expect(chat.locator('.assistant-saved summary')).toHaveText('عرض التغييرات (2)');await expect(page.locator('[data-study-course].assistant-change-highlight')).toHaveCount(1);
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await page.reload();
 await expect(page.locator('.study-course-choice strong')).toHaveText('محمد');await page.getByRole('button',{name:'الجدول الأسبوعي',exact:true}).click();
 await expect(page.locator('.study-lesson')).toHaveCount(1);await expect(page.locator('.study-lesson')).toContainText('00:00');await expect(page.locator('.study-lesson')).toContainText('01:00');
 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();await ask(cardMessage);await expect(chat.locator('.assistant-proposal details')).toHaveCount(2);
 await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();await expect(chat).toContainText('تم تطبيق التغييرات في الموقع.');await expect(chat.locator('.assistant-message-author')).toHaveCount(0);await expect(page.locator('.week-item.assistant-change-highlight')).toHaveCount(1);await expect(page).toHaveURL(new RegExp('weekOf='+date));
 await page.getByRole('button',{name:'إغلاق المساعد',exact:true}).click();await expect(page.locator('.week-item').filter({hasText:'عمار'})).toHaveCount(1);
 await page.reload();await expect(page.locator('.week-item').filter({hasText:'عمار'})).toHaveCount(1);
 await expect(page.locator('.week-day').filter({has:page.locator(`time[datetime="${date}"]`)})).toContainText('عمار');expect(calls).toBe(4);
 await page.goto('/#/personal');await expect(page.getByRole('heading',{name:'عمار',exact:true})).toHaveCount(1);const card=page.locator('.project-card').filter({has:page.getByRole('heading',{name:'عمار',exact:true})});await card.getByText('الملاحظات والوصف',{exact:true}).click();await expect(card).toContainText('مرحبا');
 await page.screenshot({path:'test-results/layout-review/assistant-compound-card-week.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('language-changed',{detail:'en'})));await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#wilo-assistant')!.getBoundingClientRect().left-document.querySelector('main.workspace')!.getBoundingClientRect().right)).toBeGreaterThanOrEqual(0);
 await page.screenshot({path:'test-results/layout-review/assistant-dock-english-right.png',fullPage:false});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('language-changed',{detail:'he'})));await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect.poll(()=>page.evaluate(()=>document.querySelector('main.workspace')!.getBoundingClientRect().left-document.querySelector('#wilo-assistant')!.getBoundingClientRect().right)).toBeGreaterThanOrEqual(0);
 await page.screenshot({path:'test-results/layout-review/assistant-dock-hebrew-left.png',fullPage:false});

});
