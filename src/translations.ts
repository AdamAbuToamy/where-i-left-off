export type Language = 'ar' | 'he' | 'en'

type Translation = {
  appName: string
  workspace: string
  language: string
  active: string
  later: string
  nextStep: string
  nextStepPlaceholder: string
  projectUrl: string
  projectUrlPlaceholder: string
  attachmentUrl: string
  attachmentUrlPlaceholder: string
  dueDate: string
  schedule: string
  boardView: string
  weekView: string
  previousWeek: string
  nextWeek: string
  unscheduled: string
  admin: string
  adminTitle: string
  accountsSeen: string
  activeThisWeek: string
  adminLimit: string
  firebaseUsers: string
  accountSuspended: string
  suspendApp: string
  restoreApp: string
  confirmSuspend: string
  cancelAction: string
  accountStatus: string
  firstSeen: string
  lastSeen: string
  noAccounts: string
  accountActive: string
  suspendedAccounts: string
  startProject: string
  postponeProject: string
  addProject: string
  projectName: string
  projectNamePlaceholder: string
  nextStepInputPlaceholder: string
  saveProject: string
  cancel: string
  editProject: string
  deleteProject: string
  saveChanges: string
  deleteConfirmation: string
}

export const translations: Record<Language, Translation> = {
  "ar": {
    "appName": "Where I Left Off",
    "workspace": "مساحة مشاريعك",
    "language": "اللغة",
    "active": "شغّال عليه",
    "later": "لاحقًا",
    "nextStep": "الخطوة القادمة",
    "nextStepPlaceholder": "تحديد المهمة التي سأبدأ بها في الجلسة القادمة.",
    "projectUrl": "رابط المشروع",
    "projectUrlPlaceholder": "https://github.com/…",
    "attachmentUrl": "رابط ملف أو صورة",
    "attachmentUrlPlaceholder": "رابط مشاركة من Drive أو موقع ملفات",
    "dueDate": "موعد المتابعة",
    "schedule": "الجدول الأسبوعي",
    "boardView": "البطاقات",
    "weekView": "الأسبوع",
    "previousWeek": "الأسبوع السابق",
    "nextWeek": "الأسبوع التالي",
    "unscheduled": "بلا موعد",
    "admin": "الإدارة",
    "adminTitle": "لوحة الإدارة المحدودة",
    "accountsSeen": "حسابات فتحت التطبيق",
    "activeThisWeek": "نشطة خلال آخر 7 أيام",
    "adminLimit": "تعرض اللوحة إحصاءات مجمعة وبريد الحساب، وتسمح بإيقاف وصوله إلى التطبيق أو إعادته. حذف حساب Firebase نفسه يتم من Console؛ سجلات المشاريع والإحصاءات تحتاج حذفًا منفصلًا.",
    "firebaseUsers": "إدارة حسابات Firebase",
    "accountSuspended": "تم إيقاف وصول هذا الحساب إلى التطبيق. تواصل مع المسؤول إذا كنت ترى أن هذا خطأ.",
    "suspendApp": "إيقاف الوصول",
    "restoreApp": "إعادة الوصول",
    "confirmSuspend": "تأكيد إيقاف هذا الحساب عن استخدام التطبيق؟",
    "cancelAction": "تراجع",
    "accountStatus": "حالة الوصول",
    "firstSeen": "أول ظهور",
    "lastSeen": "آخر نشاط",
    "noAccounts": "لا توجد حسابات مسجلة في الإحصاءات بعد.",
    "accountActive": "مفعّل",
    "suspendedAccounts": "حسابات موقوفة",
    "startProject": "ابدأ المشروع",
    "postponeProject": "أجّل المشروع",
    "addProject": "مشروع جديد",
    "projectName": "اسم المشروع",
    "projectNamePlaceholder": "مثلاً: ذراع الروبوت",
    "nextStepInputPlaceholder": "ما أول خطوة ستعمل عليها؟",
    "saveProject": "إضافة المشروع",
    "cancel": "إلغاء",
    "editProject": "تعديل",
    "deleteProject": "حذف",
    "saveChanges": "حفظ التعديلات",
    "deleteConfirmation": "هل تريد حذف هذا المشروع؟"
  },
  "he": {
    "appName": "Where I Left Off",
    "workspace": "מרחב הפרויקטים שלך",
    "language": "שפה",
    "active": "בעבודה",
    "later": "בהמשך",
    "nextStep": "הצעד הבא",
    "nextStepPlaceholder": "בחירת המשימה שאתחיל בה בפעם הבאה.",
    "projectUrl": "קישור לפרויקט",
    "projectUrlPlaceholder": "https://github.com/…",
    "attachmentUrl": "קישור לקובץ או לתמונה",
    "attachmentUrlPlaceholder": "קישור שיתוף מ-Drive או מאתר קבצים",
    "dueDate": "תאריך מעקב",
    "schedule": "לוח שבועי",
    "boardView": "כרטיסים",
    "weekView": "שבוע",
    "previousWeek": "השבוע הקודם",
    "nextWeek": "השבוע הבא",
    "unscheduled": "ללא תאריך",
    "admin": "ניהול",
    "adminTitle": "לוח ניהול מוגבל",
    "accountsSeen": "חשבונות שפתחו את האפליקציה",
    "activeThisWeek": "פעילים ב-7 הימים האחרונים",
    "adminLimit": "הלוח מציג נתונים מצרפיים וכתובות דוא״ל, ומאפשר להשהות או להחזיר גישה לאפליקציה. מחיקת חשבון Firebase נעשית דרך Console; נתוני הפרויקטים והמדדים נמחקים בנפרד.",
    "firebaseUsers": "ניהול חשבונות Firebase",
    "accountSuspended": "הגישה של החשבון לאפליקציה הושהתה. פנו למנהל אם לדעתכם זו טעות.",
    "suspendApp": "השהיית גישה",
    "restoreApp": "החזרת גישה",
    "confirmSuspend": "להשהות את הגישה של החשבון לאפליקציה?",
    "cancelAction": "ביטול",
    "accountStatus": "מצב גישה",
    "firstSeen": "נראה לראשונה",
    "lastSeen": "פעילות אחרונה",
    "noAccounts": "עדיין אין חשבונות בנתוני השימוש.",
    "accountActive": "פעיל",
    "suspendedAccounts": "חשבונות מושעים",
    "startProject": "התחלת הפרויקט",
    "postponeProject": "דחיית הפרויקט",
    "addProject": "פרויקט חדש",
    "projectName": "שם הפרויקט",
    "projectNamePlaceholder": "לדוגמה: זרוע רובוטית",
    "nextStepInputPlaceholder": "מה הצעד הראשון שתעבוד עליו?",
    "saveProject": "הוספת הפרויקט",
    "cancel": "ביטול",
    "editProject": "עריכה",
    "deleteProject": "מחיקה",
    "saveChanges": "שמירת השינויים",
    "deleteConfirmation": "למחוק את הפרויקט הזה?"
  },
  "en": {
    "appName": "Where I Left Off",
    "workspace": "Your project space",
    "language": "Language",
    "active": "In progress",
    "later": "Later",
    "nextStep": "Next step",
    "nextStepPlaceholder": "Choose the task I will start with next time.",
    "projectUrl": "Project link",
    "projectUrlPlaceholder": "https://github.com/…",
    "attachmentUrl": "File or image link",
    "attachmentUrlPlaceholder": "A share link from Drive or a file host",
    "dueDate": "Follow-up date",
    "schedule": "Weekly schedule",
    "boardView": "Cards",
    "weekView": "Week",
    "previousWeek": "Previous week",
    "nextWeek": "Next week",
    "unscheduled": "No date",
    "admin": "Admin",
    "adminTitle": "Limited admin dashboard",
    "accountsSeen": "Accounts that opened the app",
    "activeThisWeek": "Active in the last 7 days",
    "adminLimit": "This dashboard shows aggregate usage and account emails, and can pause or restore app access. Delete Firebase Auth accounts in Console; project and metric records require separate deletion.",
    "firebaseUsers": "Manage Firebase accounts",
    "accountSuspended": "This account's access to the app is paused. Contact the administrator if you think this is a mistake.",
    "suspendApp": "Suspend access",
    "restoreApp": "Restore access",
    "confirmSuspend": "Suspend this account's access to the app?",
    "cancelAction": "Cancel",
    "accountStatus": "Access status",
    "firstSeen": "First seen",
    "lastSeen": "Last activity",
    "noAccounts": "No accounts have appeared in usage stats yet.",
    "accountActive": "Active",
    "suspendedAccounts": "Suspended accounts",
    "startProject": "Start project",
    "postponeProject": "Postpone project",
    "addProject": "New project",
    "projectName": "Project name",
    "projectNamePlaceholder": "For example: Robot arm",
    "nextStepInputPlaceholder": "What will you work on first?",
    "saveProject": "Add project",
    "cancel": "Cancel",
    "editProject": "Edit",
    "deleteProject": "Delete",
    "saveChanges": "Save changes",
    "deleteConfirmation": "Delete this project?"
  }
}
