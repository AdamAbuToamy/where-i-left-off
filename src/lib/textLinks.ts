export function splitTextLinks(text:string){
 const parts:{text:string;href?:string}[]=[],pattern=/(?:https?:\/\/|www\.)[^\s<>"']+/gi
 let cursor=0
 for(const match of text.matchAll(pattern)){
  const start=match.index!,raw=match[0],initial=raw.replace(/[.,،؛;!?؟]+$/,'')
  let url=initial
  const pairs:Record<string,string>={')':'(',']':'[','}':'{'}
  while(pairs[url.at(-1) || '']){const close=url.at(-1)!,open=pairs[close];if(url.split(close).length<=url.split(open).length)break;url=url.slice(0,-1)}
  if(start>cursor)parts.push({text:text.slice(cursor,start)})
  const href=url.toLowerCase().startsWith('www.')?`https://${url}`:url
  try{const parsed=new URL(href);if(!['https:','http:'].includes(parsed.protocol)||!parsed.hostname)throw new Error('invalid');parts.push({text:url,href})}catch{parts.push({text:url})}
  if(url.length<raw.length)parts.push({text:raw.slice(url.length)})
  cursor=start+raw.length
 }
 if(cursor<text.length)parts.push({text:text.slice(cursor)})
 return parts
}
