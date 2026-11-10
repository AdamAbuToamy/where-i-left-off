import {test,expect} from '@playwright/test';
import {prepareUniversityPilot} from './universityFixture';
for(const phone of [false,true])test(`section groups ${phone?'phone':'desktop'}`,async({page,request})=>{
 await page.setViewportSize(phone?{width:390,height:844}:{width:1440,height:1000});
 const c=await prepareUniversityPilot(request,`section-group-${phone}@example.test`);const root=`http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}`;
 const section='s'.repeat(20);
 await request.patch(root+'/sections/'+section,{headers:{Authorization:'Bearer owner'},data:{fields:{name:{stringValue:'Study'},revision:{integerValue:'0'},mutationId:{stringValue:'fixture'}}}});
 for(const [i,name]of ['Study card','Other card'].entries())await request.patch(root+'/projects/'+String(i).repeat(20),{headers:{Authorization:'Bearer owner'},data:{fields:{name:{stringValue:name},nextStep:{stringValue:'Next'},status:{stringValue:'later'},rank:{integerValue:String(i)},revision:{integerValue:'0'},mutationId:{stringValue:'fixture'},...(i===0?{sectionId:{stringValue:section}}:{})}}});
 await page.addInitScript(uid=>{localStorage.setItem('language','en');localStorage.setItem('welcome-tour:v2:'+uid,'done');},c.uid);
 await page.route('**/push-config.json',r=>r.fulfill({status:503,body:'{}'}));await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(c.email);await page.locator('.auth-continue').click();await page.getByLabel('Password',{exact:true}).fill(c.password);await page.locator('form button[type=submit]').click();await expect(page.locator('.project-card')).toHaveCount(2);
 if(phone)await page.getByRole('button',{name:'View tools',exact:true}).click();
 await page.getByRole('button',{name:'By sections',exact:true}).click();await expect(page.locator('.section-cluster')).toHaveCount(2);await expect(page.locator('.workspace-section-picker')).toBeHidden();
 if(phone)await page.keyboard.press('Escape');
 await expect(page.getByRole('region',{name:'Study',exact:true})).toContainText('Study card');await expect(page.getByRole('region',{name:'No section',exact:true})).toContainText('Other card');
 if(!phone){await page.getByRole('region',{name:'Study',exact:true}).hover();await expect.poll(()=>page.getByRole('region',{name:'No section',exact:true}).evaluate(el=>getComputedStyle(el).filter)).toBe('blur(1.5px)');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`/tmp/wilo-sections-${phone?'phone':'desktop'}.png`,fullPage:true});
 if(phone)await page.getByRole('button',{name:'View tools',exact:true}).click();
 await page.getByRole('button',{name:'Cards',exact:true}).click();await expect(page.locator('.section-cluster')).toHaveCount(0);await expect(page.locator('.project-card')).toHaveCount(2);
});
