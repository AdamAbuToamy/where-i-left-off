export function passwordConfirmation(language,changedAt) {
 const date=new Date(changedAt).toISOString()
 const text={
  ar:{subject:'تم تغيير كلمة المرور - Where I Left Off',body:`تم تغيير كلمة مرور حسابك في Where I Left Off.\nالتاريخ: ${date}\nإذا لم تقم بهذا التغيير، استخدم «نسيت كلمة المرور» في الموقع لاستعادتها.\nلا تحتوي هذه الرسالة على كلمة مرورك.`},
  en:{subject:'Password changed - Where I Left Off',body:`Your Where I Left Off account password was changed.\nTime: ${date}\nIf you did not make this change, use Forgot password on the site to reset it.\nThis message never includes your password.`},
  he:{subject:'הסיסמה שונתה - Where I Left Off',body:`סיסמת החשבון שלכם ב-Where I Left Off שונתה.\nמועד: ${date}\nאם לא ביצעתם את השינוי, השתמשו באפשרות שכחתי סיסמה באתר.\nההודעה אינה מכילה את הסיסמה שלכם.`},
 }
 return text[language] || text.en
}
