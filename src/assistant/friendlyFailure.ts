import type { Language } from '../translations';
import type { AssistantFailure } from './failure';

/** Safe conversational feedback. Protocol codes remain only in Connection details. */
export function friendlyFailure(failure:AssistantFailure,language:Language):string {
 const index=language==='ar'?0:language==='en'?1:2;
 const tr=(ar:string,en:string,he:string)=>[ar,en,he][index];
 if(failure.stage==='save'||['assistant-confirmation','assistant-save-failed'].includes(failure.code))
  return tr('تعذّر عليّ التأكد من نتيجة الحفظ. ربما وصلت بعض التغييرات إلى الموقع؛ افحصها قبل إعادة المحاولة كي لا تتكرر.','I couldn’t confirm the save result. Some changes may have reached the site; please check before trying again to avoid duplicates.','לא הצלחתי לאמת את השמירה. ייתכן שחלק מהשינויים נשמרו; בדקו באתר לפני ניסיון חוזר כדי למנוע כפילויות.');
 const reason:Record<string,[string,string,string]>={
  'ai-incomplete-proposal':['لم أتمكن من تجهيز جميع خطوات طلبك بشكل صحيح، ولذلك لن أنفّذ جزءًا منه وأتجاهل الباقي. يمكن أن نعيد المحاولة مع تحديد العنصر المقصود.','I couldn’t prepare all the requested steps correctly, so I won’t apply only part of your request. We can try again with the intended item identified.','לא הצלחתי להכין כראוי את כל שלבי הבקשה, ולכן לא אבצע רק חלק ממנה. אפשר לנסות שוב עם שם הפריט המדויק.'],
  'ai-intent-format':['لم أتمكن من ترتيب خطوات طلبك بصورة موثوقة. سأحتاج إلى إعادة المحاولة دون تنفيذ تغييرات جزئية.','I couldn’t reliably identify every step in your request. Please try again; I won’t apply a partial change.','לא הצלחתי לזהות את כל שלבי הבקשה בצורה אמינה. נסו שוב; לא אבצע שינוי חלקי.'],
  'assistant-invalid':['فهمت أن طلبك يحتاج تعديلًا في الموقع، لكن المقترح لم يجتز التحقق من البيانات والعمليات المسموحة. لا أريد تنفيذ تغيير خاطئ.','Your request involves a site change, but the proposed operations failed validation. I won’t risk applying an incorrect change.','הבקשה כוללת שינוי באתר, אבל הפעולות המוצעות לא עברו אימות. לא אבצע שינוי שגוי.'],
  'assistant-reference':['لم أتمكن من تجهيز التغيير لأن القسم المطلوب لا يطابق القسم الذي اقترحه النموذج، أو لأن المرجع غير موجود. لم أنفّذ التعديل؛ لن أختار قسمًا آخر من تلقاء نفسي.','I couldn’t safely match the requested record. Please specify the card or section name.','לא הצלחתי לזהות את הפריט המבוקש בוודאות. ציינו את שם הכרטיס או המדור.'],
  'assistant-conversation-full':['سياق المحادثة أصبح طويلًا جدًا. افتح محادثة جديدة أو امسح السجل داخل WILO، دون أن يؤثر ذلك على بيانات الموقع.','This conversation has become too long. Start a fresh WILO conversation or clear chat history; this does not delete your site data.','השיחה ארוכה מדי. התחילו שיחת WILO חדשה או נקו את ההיסטוריה; נתוני האתר לא יימחקו.'],
  'ai-rate-limit':['وصلت طلبات كثيرة خلال وقت قصير إلى الخادم. جرّب مجددًا بعد لحظات، أو استخدم النموذج المحلي إن كان جاهزًا.','Too many requests reached the server close together. Try again shortly, or use your local model if available.','הגיעו בקשות רבות לשרת בפרק זמן קצר. נסו שוב בקרוב, או השתמשו במודל המקומי אם הוא מוכן.'],
  'ai-provider-limit':['مزود الذكاء الاصطناعي وصل إلى حد استخدامه. يمكن تجربة النموذج المحلي أو المحاولة لاحقًا.','The AI provider reached its usage limit. You can use a local model or try again later.','ספק הבינה המלאכותית הגיע למגבלת השימוש. אפשר להשתמש במודל המקומי או לנסות מאוחר יותר.'],
  'ai-provider-access':['تعذر الاتصال بنموذج الذكاء الاصطناعي المهيأ للخادم. هذه مشكلة خدمة وليست خطأ في طلبك.','The configured AI model could not be accessed. This is a service issue, not a problem with your request.','לא ניתן לגשת למודל שהוגדר בשרת. זו בעיית שירות, לא בעיה בבקשה שלכם.'],
  'assistant-network':['لم أتمكن من الوصول إلى خادم WILO. تحقّق من الاتصال وأعد المحاولة.','I couldn’t reach the WILO server. Check your connection and try again.','לא הצלחתי להתחבר לשרת WILO. בדקו את החיבור ונסו שוב.'],
  'assistant-timeout':['تأخر رد الخادم أكثر من المسموح. يمكنك إعادة المحاولة.','The server took too long to respond. You can try again.','תגובת השרת התעכבה יותר מדי. אפשר לנסות שוב.'],
  'assistant-read-failed':['لم أتمكن من قراءة بيانات حسابك حاليًا، لذلك لن أخمّن أي بطاقة أو قسم.','I couldn’t read your account data right now, so I won’t guess which card or section you mean.','לא הצלחתי לקרוא את נתוני החשבון, ולכן לא אנחש לאיזה כרטיס או מדור התכוונתם.'],
  'permission-denied':['لم أتمكن من قراءة البيانات أو تنفيذ الإجراء بسبب الصلاحيات.','I couldn’t read the data or perform that action because of account permissions.','לא ניתן לקרוא את הנתונים או לבצע את הפעולה בגלל הרשאות החשבון.'],
  'assistant-local-not-ready':['النموذج المحلي غير جاهز بعد. شغّله من الإعدادات أو اختر المساعد السحابي بنفسك.','The local model is not ready. Start it from Settings or explicitly choose the cloud assistant.','המודל המקומי עדיין לא מוכן. הפעילו אותו בהגדרות או בחרו במפורש בעוזר הענן.'],
  'assistant-local-unsupported':['جهازك أو متصفحك لا يدعم تشغيل النموذج المحلي حاليًا.','Your device or browser does not currently support the local model.','המכשיר או הדפדפן אינם תומכים כרגע במודל המקומי.'],
 };
 const details=reason[failure.code]?.[index]||tr('واجهت مشكلة تقنية أثناء تجهيز الرد. يمكنك المحاولة مجددًا أو فتح تفاصيل الاتصال لتشخيص السبب.','I ran into a technical issue while preparing the reply. You can retry or open Connection details for diagnosis.','אירעה בעיה טכנית בזמן הכנת התשובה. אפשר לנסות שוב או לפתוח את פרטי החיבור.');
 return details+' '+tr('لم أحفظ أي تغييرات من هذه المحاولة.','No changes were saved from this attempt.','לא נשמרו שינויים מניסיון זה.');
}
