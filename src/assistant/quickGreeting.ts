import type {Language} from '../translations';

/** A standalone greeting is not a request to inspect account data or infer actions. */
export function quickGreeting(message:string,language:Language):string|null {
 const normalized=message.normalize('NFKC').trim().toLowerCase().replace(/[؟?!.,،.\s]+$/g,'').replace(/[أإآ]/g,'ا');
 if(!/^(?:مرحبا|اهلا|اهلين|هلا|السلام عليكم|hi|hello|hey|שלום|היי|אהלן)$/.test(normalized))return null;
 return {
  ar:'أهلًا! كيف أستطيع مساعدتك في تنظيم بطاقاتك أو جدولك؟',
  en:'Hi! How can I help you organize your cards or timetable?',
  he:'שלום! איך אוכל לעזור לך לארגן את הכרטיסים או את מערכת השעות?',
 }[language];
}
