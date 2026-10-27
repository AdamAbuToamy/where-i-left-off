import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
test("semester planner: edit, checklist, graph, timetable and reload", async ({
  page,
  request,
}) => {
  const { email: admin, password } = await prepareUniversityPilot(request);
  await page.addInitScript(() => { if (!localStorage.getItem("language")) localStorage.setItem("language", "en"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/push-config.json',route=>route.fulfill({status:503,body:'{}'}));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(admin);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  await page.goto("/#/university");
  await expect(page.getByText("My study space", { exact: true })).toBeVisible();
  await page.locator(".language-trigger").click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByText("مساحتي الدراسية", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByText("مساحتي الدراسية", { exact: true })).toBeVisible();
  await page.locator(".study-toolbar").getByRole("button", { name: "إضافة كورس", exact: true }).click();
  await page.getByLabel("اسم الكورس", { exact: true }).fill("Algorithms");
  await page
    .getByLabel("ملاحظات الكورس", { exact: true })
    .fill("Review proofs");
  await page.getByLabel("خطة الدراسة — موضوع في كل سطر", { exact: true }).fill("Proofs\nGraphs");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await page.locator(".study-trial-tabs").getByRole("button", {name:"خطة الدراسة",exact:true}).click();
  await page.getByRole("checkbox", { name: "Proofs", exact: true }).check();
  await page.locator(".study-trial-tabs").getByRole("button", {name:"ملخص الكورس",exact:true}).click();
  await page.getByRole("button", { name: "إضافة مهمة", exact: true }).click();
  await page.getByLabel("العنوان", { exact: true }).fill("Exercise 1");
  await page
    .getByLabel("التاريخ والوقت", { exact: true })
    .fill("2026-11-10T14:30");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await page
    .locator(".study-tabs").getByRole("button", { name: "الجدول الأسبوعي", exact: true })
    .click();
  await page.getByRole("button", { name: "إضافة محاضرة", exact: true }).click();
  await page.getByLabel("المكان / القاعة", { exact: true }).fill("Building 90");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await page.locator(".study-trial-schedule").getByRole("button", {name:"الجدول الأسبوعي",exact:true}).click();
  await expect(page.locator(".study-lesson")).toContainText("Building 90");
  await page
    .getByRole("button", { name: /خريطة الكورسات/ })
    .click();
  await expect(page.locator(".study-node")).toContainText("Algorithms");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "الكورسات والمهام", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/layout-review/university-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Review proofs", { exact: true })).toBeVisible();
  await page.locator(".study-trial-tabs").getByRole("button", {name:"خطة الدراسة",exact:true}).click();
  await expect(page.getByRole("checkbox",{name:"Proofs",exact:true})).toBeChecked();
  await expect(page.getByText("Moodle",{exact:true})).toHaveCount(0);
});

test("course picker: pagination, selection, linked notes and next-course context on desktop and phone", async ({page,request}) => {
  const {email,password}=await prepareUniversityPilot(request,'course-navigation@example.test');
  await page.addInitScript(()=>localStorage.setItem('language','ar'));
  await page.goto('/');
  await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(email);
  await page.getByLabel('كلمة المرور',{exact:true}).fill(password);
  await page.locator('form').getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
  await expect(page.locator('.side-navigation-toggle')).toBeVisible();
  const skip=page.locator('.welcome-guide .guide-skip');if(await skip.isVisible())await skip.click();
  await page.goto('/#/university');
  const courses=Array.from({length:14},(_,i)=>({id:`picker-${i}`,name:`كورس ${i+1}`,notes:'مراجعة المحاضرة https://example.test/notes وأيضًا www.example.test',url:'',requires:[],x:0,y:0}));
  const tasks=[{id:'picker-task',courseId:'picker-13',title:'تسليم المشروع',due:'2099-11-10T14:30:00Z',kind:'assignment',notes:'',url:'',done:false}];
  await page.locator('.study-trial-tools summary').click();
  await page.locator('.study-upload input').setInputFiles({name:'courses.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,courses,tasks,lessons:[]}))});
  await page.getByRole('button',{name:'تأكيد الإضافة',exact:true}).click();
  await expect(page.locator('.study-course-choice')).toHaveCount(6);
  await expect(page.locator('.study-next-course')).toHaveText('كورس 14');
  await page.getByRole('button',{name:'التالي',exact:true}).click();
  await page.getByRole('button',{name:'التالي',exact:true}).click();
  await expect(page.locator('.study-course-choice')).toHaveCount(2);
  await page.locator('.study-course-choice').filter({hasText:'كورس 14'}).click();
  await expect(page.locator('.study-course-choice[aria-pressed=true]')).toContainText('كورس 14');
  await expect(page.locator('.study-current-course')).toHaveText('الكورس المفتوح');
  await expect(page.locator('.study-trial-notes a')).toHaveCount(2);
  await expect(page.locator('.study-trial-notes a').first()).toHaveAttribute('href','https://example.test/notes');
  await expect(page.locator('.study-trial-notes a').last()).toHaveAttribute('href','https://www.example.test');
  await expect(page.locator('.study-storage')).toContainText('تمت المزامنة مع حسابك');
  await expect(page.locator('.study-stats article').first().locator('strong')).toHaveText('14');
  await expect(page.locator('.study-current-course')).toBeVisible();
  await page.getByRole('button',{name:'إغلاق الرسالة',exact:true}).click();
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/layout-review/university-picker-${width}.png`,fullPage:true});
  }
  await page.getByLabel('بحث عن كورس',{exact:true}).fill('كورس 1');
  await expect(page.locator('.study-course-choice')).toHaveCount(6);
  await page.getByLabel('بحث عن كورس',{exact:true}).fill('كورس 14');
  await expect(page.locator('.study-course-choice')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'تسليم المشروع',exact:true})).toBeVisible();
});
