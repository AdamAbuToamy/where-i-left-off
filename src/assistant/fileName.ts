export function assistantFileName(name:string):string{
 const safe=Array.from(name).map(c=>c==='/'||c==='\\'||c.charCodeAt(0)<32?'_':c).join('').trim();
 return /\.(?:txt|md|csv|json|pdf)$/i.test(safe)?safe:safe.replace(/\.[^.]+$/,'')+'.txt';
}
