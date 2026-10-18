import { useEffect, useState } from 'react'
import type { Language } from '../translations'
import { desktopChromium, detectExtension, readInstallPreference, saveInstallPreference, shouldOffer, SNOOZE_MS, storeUrl, validExtensionId } from '../lib/extensionInstall'
import type { ExtensionConfig,InstallPreference } from '../lib/extensionInstall'
const text={
 en:{title:'Save pages with the Chrome extension',body:'Save the active page and its available video checkpoint to your workspace with one click.',install:'Open Chrome Web Store',later:'Remind me in 7 days',never:'Do not show again',installed:'Extension detected in this browser.',unknown:'Installation could not be confirmed. Earlier versions may not support detection.',manual:'I have already installed it',waiting:'The extension is awaiting store availability. The install link will appear here when it is ready.',desktop:'Available for desktop Chrome. On your phone, use the site or install the web app.',check:'Check again',reset:'Show installation suggestions again',settings:'Chrome extension'},
 ar:{title:'احفظ الصفحات باستخدام إضافة Chrome',body:'احفظ الصفحة الحالية ونقطة توقف الفيديو المتاحة في مساحة مشاريعك بنقرة واحدة.',install:'فتح متجر Chrome',later:'ذكّرني بعد 7 أيام',never:'لا تعرض مجددًا',installed:'تم اكتشاف الإضافة في هذا المتصفح.',unknown:'لم نتمكن من تأكيد التثبيت. قد لا تدعم النسخ السابقة اكتشاف الإضافة.',manual:'ثبّت الإضافة بالفعل',waiting:'الإضافة بانتظار إتاحتها في المتجر. سيظهر رابط التثبيت هنا عند جاهزيته.',desktop:'متاحة لمتصفح Chrome على الكمبيوتر. على الهاتف استخدم الموقع أو ثبّت تطبيق الويب.',check:'التحقق مجددًا',reset:'إظهار اقتراحات التثبيت مجددًا',settings:'إضافة Chrome'},
 he:{title:'שמירת דפים עם תוסף Chrome',body:'שמרו את הדף הפעיל ואת נקודת העצירה הזמינה בווידאו בסביבת העבודה בלחיצה אחת.',install:'פתיחת חנות Chrome',later:'להזכיר בעוד 7 ימים',never:'לא להציג שוב',installed:'התוסף זוהה בדפדפן זה.',unknown:'לא ניתן לאשר התקנה. ייתכן שגרסאות קודמות אינן תומכות בזיהוי.',manual:'כבר התקנתי את התוסף',waiting:'התוסף ממתין לזמינות בחנות. קישור ההתקנה יופיע כאן כשיהיה מוכן.',desktop:'זמין עבור Chrome במחשב. בטלפון השתמשו באתר או התקינו את יישום האינטרנט.',check:'בדיקה חוזרת',reset:'הצגת הצעות התקנה שוב',settings:'תוסף Chrome'},
}
export default function ExtensionInstall({language,settings=false}:{language:Language;settings?:boolean}) {
 const t=text[language],[config,setConfig]=useState<ExtensionConfig>({extensionId:'',published:false}),[pref,setPref]=useState(readInstallPreference),[confirmed,setConfirmed]=useState(false),[checked,setChecked]=useState(false),[attempt,setAttempt]=useState(0)
 useEffect(()=>{const abort=new AbortController();void fetch('/extension-config.json',{cache:'no-store',signal:abort.signal}).then(r=>r.ok?r.json():null).then(v=>{if(v&&validExtensionId(v.extensionId)){setChecked(false);setConfig({extensionId:v.extensionId,published:v.published===true})}}).catch(()=>{});return()=>abort.abort()},[])
 useEffect(()=>{let alive=true;void detectExtension(config.extensionId).then(found=>{if(alive){setConfirmed(found);setChecked(true)}});return()=>{alive=false}},[config.extensionId,attempt])
 useEffect(()=>{const check=()=>{if(document.visibilityState==='visible')setAttempt(n=>n+1)};window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}},[])
 function change(p:InstallPreference){setPref(p);saveInstallPreference(p)}
 const eligible=desktopChromium(),url=storeUrl(config)
 if(!settings&&(!checked||!shouldOffer(config,pref,confirmed)))return null
 return <section className={settings?'settings-section':'extension-prompt'} aria-label={t.settings}><h3>{settings?t.settings:t.title}</h3><p>{t.body}</p>{!eligible?<p>{t.desktop}</p>:!url?<p role="status">{t.waiting}</p>:<>
 {confirmed?<p role="status">{t.installed}</p>:settings&&<p>{t.unknown}</p>}
 <div className="extension-actions">{!confirmed&&<a className="primary-button" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>change({...pref,snoozedUntil:Date.now()+SNOOZE_MS})}>{t.install}</a>}
 {!settings&&<><button className="secondary-button" onClick={()=>change({...pref,snoozedUntil:Date.now()+SNOOZE_MS})}>{t.later}</button><button className="text-button" onClick={()=>change({...pref,dismissed:true})}>{t.never}</button></>}
 {!confirmed&&<button className="text-button" onClick={()=>change({...pref,manualInstalled:true})}>{t.manual}</button>}
 {settings&&<><button className="secondary-button" onClick={()=>setAttempt(n=>n+1)}>{t.check}</button><button className="text-button" onClick={()=>change({dismissed:false,snoozedUntil:0,manualInstalled:false})}>{t.reset}</button></>}
 </div></>}</section>
}
