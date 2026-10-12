export type Language = 'ar' | 'he' | 'en'

type Translation = {
  appName: string
  workspace: string
  language: string
  active: string
  later: string
  nextStep: string
  nextStepPlaceholder: string
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
    "appName": "وين وصلت؟",
    "workspace": "مساحة مشاريعك",
    "language": "اللغة",
    "active": "شغّال عليه",
    "later": "لاحقًا",
    "nextStep": "الخطوة القادمة",
    "nextStepPlaceholder": "تحديد المهمة التي سأبدأ بها في الجلسة القادمة.",
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
    "appName": "איפה עצרתי?",
    "workspace": "מרחב הפרויקטים שלך",
    "language": "שפה",
    "active": "בעבודה",
    "later": "בהמשך",
    "nextStep": "הצעד הבא",
    "nextStepPlaceholder": "בחירת המשימה שאתחיל בה בפעם הבאה.",
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
