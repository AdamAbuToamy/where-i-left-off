import type {Language} from '../translations';
import {LOCAL_RELEASE} from '../../shared/localRelease.mjs';
const words={"ar": {"title": "مساعدك، على جهازك.", "body": "فعّل WILO بضغطة. الموقع يتولى تنزيل النموذج وتخزينه محليًا.", "activate": "تفعيل المساعد المحلي", "privacy": "دون إرسال الطلب لمزود AI", "quota": "بلا حصة رسائل يومية", "note": "التنزيل الأول كبير ويحتاج جهازًا يدعم WebGPU. قد يحذف المتصفح التخزين عند نقص المساحة.", "loading": "السحر قادم…", "prepare": "نهيئ مساعدك على الجهاز", "last": "اللمسات الأخيرة…", "cancel": "إيقاف التهيئة", "progress": "تقدم تهيئة النموذج"}, "en": {"title": "Your assistant. On your device.", "body": "Activate WILO once. The site downloads and caches the model for you.", "activate": "Activate local assistant", "privacy": "No AI provider receives your prompt", "quota": "No daily message quota", "note": "The first download is large and requires a WebGPU-capable device. Your browser may evict cached files when storage is low.", "loading": "A little magic is on its way...", "prepare": "Preparing your on-device assistant", "last": "Adding the finishing touches...", "cancel": "Cancel setup", "progress": "Model initialization progress"}, "he": {"title": "העוזר שלך. במכשיר שלך.", "body": "הפעלה בלחיצה. האתר מוריד ושומר את המודל בדפדפן.", "activate": "הפעלת העוזר המקומי", "privacy": "ללא שליחה לספק AI", "quota": "ללא מכסת הודעות יומית", "note": "ההורדה הראשונה גדולה ודורשת WebGPU. הדפדפן עשוי לפנות את המטמון במחסור באחסון.", "loading": "הקסם בדרך...", "prepare": "מכינים את העוזר במכשיר", "last": "נגיעות אחרונות...", "cancel": "ביטול ההכנה", "progress": "התקדמות הכנת המודל"}};
export default function LocalActivation({language,loading,progress,disabled,onActivate,onCancel}:{language:Language;loading:boolean;progress:number;disabled:boolean;onActivate:()=>void;onCancel:()=>void}){
 const t=words[language],percent=Math.round(Math.max(0,Math.min(1,progress))*100);
 return <section className="wilo-activation" aria-label={t.title} data-local-activation="true">
  <div className="wilo-orbit" aria-hidden="true"><span/><span/><span/><b>W</b></div>
  <span className="wilo-model-label">{LOCAL_RELEASE.model.replace('-q4f16_1-MLC','')} · ON DEVICE</span>
  <h2>{loading?(percent<30?t.loading:percent<90?t.prepare:t.last):t.title}</h2>
  <p>{t.body}</p>
  <div className="wilo-benefits"><span>{t.privacy}</span><span>{t.quota}</span></div>
  {loading?<div className="wilo-setup-progress"><progress max={100} value={percent} aria-label={t.progress}/><strong>{percent}%</strong><button type="button" onClick={onCancel}>{t.cancel}</button></div>:<button type="button" className="wilo-activate-button" disabled={disabled} onClick={onActivate}>{t.activate}<span aria-hidden="true"> → </span></button>}
  <small>{t.note}</small>
 </section>;
}
