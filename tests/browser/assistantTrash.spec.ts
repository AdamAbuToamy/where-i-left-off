import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
// Real emulator persistence; injected provider calls do not certify live model inference.
test('assistant reviews personal Trash, cancels final confirmation, then deletes only reviewed trashed cards',async({page,request})=>{
 const account=await prepareUniversityPilot(request,'trash-assistant@example.test');
 const other=await prepareUniversityPilot(request,'trash-other@example.test');
 const base='http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/';
 const path=(uid:string,id:string)=>base+uid+'/projects/'+id;
 const get=(uid:string,id:string)=>request.get(path(uid,id),{headers:{Authorization:'Bearer owner'}});
 for(const [uid,id,name,trashed,archived] of [[account.uid,'trash-a','Trashed one',20,0],[account.uid,'trash-b','Trashed two',30,10],[account.uid,'live','Active sentinel',0,0],[account.uid,'archive','Archived sentinel',0,10],[other.uid,'other-trash','Other account sentinel',20,0]] as const){
  const response=await request.patch(path(uid,id),{headers:{Authorization:'Bearer owner'},data:{fields:{name:{stringValue:name},nextStep:{stringValue:''},status:{stringValue:'active'},rank:{doubleValue:0},revision:{integerValue:'0'},trashedAt:{doubleValue:trashed},archivedAt:{doubleValue:archived},updatedAt:{timestampValue:new Date().toISOString()}}}});expect(response.ok()).toBe(true);
 }
 await page.addInitScript(({uid})=>{localStorage.setItem('language','ar');sessionStorage.setItem('wilo-pollinations:'+uid,'sk_emulator_fixture');},{uid:account.uid});
 await page.route('**/assistant-config.json',route=>route.fulfill({json:{endpoint:'https://wilo-trash-test.workers.dev/assistant'}}));
 await page.route('https://gen.pollinations.ai/**',async route=>{
  const payload=route.request().postDataJSON();
  const call=(name:string,args:unknown)=>({id:name,type:'function',function:{name,arguments:JSON.stringify(args)}});
  if(payload.tools.some((t:{function:{name:string}})=>t.function.name==='request_workspace')){
   expect(payload.tools[0].function.parameters.properties.functions.items.enum).toContain('empty_trash');
   await route.fulfill({json:{choices:[{message:{tool_calls:[call('request_workspace',{requirements:[],functions:['empty_trash']})]}}]}});return;
  }
  expect(payload.tools.some((t:{function:{name:string}})=>t.function.name==='empty_trash')).toBe(true);
  const reads=payload.messages.filter((m:{role:string})=>m.role==='tool');
  await route.fulfill({json:{choices:[{message:{tool_calls:[reads.length?call('empty_trash',{}):call('read_workspace',{requests:[{target:'projects',view:'catalog',cardState:'trash'}]})]}}]}});
 });
 await page.goto('/');await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(account.email);await page.getByLabel('كلمة المرور',{exact:true}).fill(account.password);
 await page.locator('form').getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page.locator('.side-navigation-toggle')).toBeVisible();
 const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
 await page.getByRole('button',{name:'فتح المساعد',exact:true}).click();const chat=page.locator('#wilo-assistant');
 await chat.getByLabel('رسالتك',{exact:true}).fill('remove everything in the trash');await chat.getByRole('button',{name:'إرسال',exact:true}).click();
 await expect(chat.locator('.assistant-proposal details')).toHaveCount(2);await expect(chat.locator('.assistant-proposal')).toContainText('Trashed one');await expect(chat.locator('.assistant-proposal')).toContainText('Trashed two');
 await expect(chat.locator('.assistant-proposal')).not.toContainText('sentinel');
 expect((await get(account.uid,'trash-a')).ok()).toBe(true);
 page.once('dialog',dialog=>dialog.dismiss());await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();
 expect((await get(account.uid,'trash-a')).ok()).toBe(true);expect((await get(account.uid,'trash-b')).ok()).toBe(true);
 page.once('dialog',dialog=>dialog.accept());await chat.getByRole('button',{name:'تطبيق التغييرات',exact:true}).click();
 await expect(chat.locator('.assistant-saved summary')).toHaveText('عرض التغييرات (2)');
 expect((await get(account.uid,'trash-a')).status()).toBe(404);expect((await get(account.uid,'trash-b')).status()).toBe(404);
 for(const [uid,id] of [[account.uid,'live'],[account.uid,'archive'],[other.uid,'other-trash']])expect((await get(uid,id)).ok()).toBe(true);
 await chat.getByLabel('رسالتك',{exact:true}).fill('احذف كل شيء في سلة المهملات حذف نهاءي');await chat.getByRole('button',{name:'إرسال',exact:true}).click();
 await expect(chat).toContainText('سلة المهملات الشخصية فارغة');await expect(chat.getByRole('alert')).toHaveCount(0);await expect(chat.getByRole('button',{name:'تطبيق التغييرات',exact:true})).toHaveCount(0);
});
