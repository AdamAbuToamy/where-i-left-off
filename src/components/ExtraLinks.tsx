import type { Language } from '../translations'
const labels={ar:{add:'+ رابط',label:'رابط إضافي',remove:'إزالة الرابط'},en:{add:'+ Link',label:'Additional link',remove:'Remove link'},he:{add:'+ קישור',label:'קישור נוסף',remove:'הסרת קישור'}}
export default function ExtraLinks({value,onChange,language,prefix,disabled=false}:{value:string[];onChange:(value:string[])=>void;language:Language;prefix:string;disabled?:boolean}){
 const t=labels[language]
 return <div className="extra-links">{value.map((url,i)=><div className="extra-link-field" key={i}><label htmlFor={`${prefix}-link-${i}`}>{t.label} {i+1}</label><div><input id={`${prefix}-link-${i}`} type="url" inputMode="url" dir="ltr" maxLength={500} placeholder="https://" value={url} disabled={disabled} onChange={e=>onChange(value.map((v,n)=>n===i?e.target.value:v))}/><button type="button" className="text-button" disabled={disabled} aria-label={`${t.remove} ${i+1}`} onClick={()=>onChange(value.filter((_,n)=>n!==i))}>×</button></div></div>)}{!disabled&&value.length<10&&<button type="button" className="secondary-button" onClick={()=>onChange([...value,''])}>{t.add}</button>}</div>
}
