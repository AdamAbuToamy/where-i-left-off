import { splitTextLinks } from '../lib/textLinks'
export default function LinkedText({text}:{text:string}){
 return <>{splitTextLinks(text).map((part,i)=>part.href?<a className="inline-link" key={i} href={part.href} target="_blank" rel="noopener noreferrer" dir="ltr" onClick={e=>e.stopPropagation()}>{part.text}</a>:part.text)}</>
}
