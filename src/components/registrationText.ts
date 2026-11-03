import type { Language } from "../translations";
export const registrationText: Record<
  Language,
  {
    age: string;
    choose: string;
    younger: string;
    eligible: string;
    hint: string;
    blocked: string;
    googleHint: string;
  }
> = {
  ar: {
    age: "الفئة العمرية",
    choose: "اختر الفئة العمرية",
    younger: "أقل من 16 سنة",
    eligible: "16 سنة أو أكثر",
    hint: "لا نحفظ عمرك أو تاريخ ميلادك.",
    blocked:
      "إنشاء حساب جديد متاح لعمر 16 سنة فأكثر. يمكنك العودة لتسجيل الدخول إلى حساب قائم.",
    googleHint: "قد ينشئ Google حسابًا جديدًا؛ اختر فئتك العمرية قبل المتابعة.",
  },
  en: {
    age: "Age group",
    choose: "Choose your age group",
    younger: "Under 16",
    eligible: "16 or older",
    hint: "We do not save your age or date of birth.",
    blocked:
      "New accounts are available to people aged 16 or older. You can return to sign in to an existing account.",
    googleHint:
      "Google can create a new account. Choose your age group before continuing.",
  },
  he: {
    age: "קבוצת גיל",
    choose: "בחרו קבוצת גיל",
    younger: "מתחת ל־16",
    eligible: "16 ומעלה",
    hint: "איננו שומרים גיל או תאריך לידה.",
    blocked:
      "חשבונות חדשים מיועדים לבני 16 ומעלה. אפשר לחזור להתחברות לחשבון קיים.",
    googleHint: "Google עשוי ליצור חשבון חדש. בחרו קבוצת גיל לפני ההמשך.",
  },
};
