import { createContext,useContext } from 'react';
import type { Language } from '../translations';
import { studyTranslations } from './studyTranslations';
const Context=createContext<Language>('ar');
export const StudyLocaleContext=Context;
export const useStudyLanguage=()=>useContext(Context);
export function translateStudyText(text:string,language:Language):string{
 if(language==='ar')return text;
 const key=text.replace(/\s+/g,' ').trim(),index=language==='en'?0:1;
 const translated=studyTranslations[key]?.[index];
 if(translated!==undefined)return (text.match(/^\s*/)?.[0]||'')+translated+(text.match(/\s*$/)?.[0]||'');
 const line=key.match(/^السطر (\d+): (.*)$/);if(line)return (language==='en'?'Line ':'שורה ')+line[1]+': '+translateStudyText(line[2],language);
 const pending=key.match(/^محفوظة على الجهاز · (\d+) تغييرات تنتظر المزامنة$/);if(pending)return language==='en'?`Saved on device · ${pending[1]} changes awaiting sync`:`נשמר במכשיר · ${pending[1]} שינויים ממתינים לסנכרון`;
 return text;
}
