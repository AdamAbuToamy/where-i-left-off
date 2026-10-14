export type CatalogResult={id:string;source:'openlibrary'|'tvmaze';name:string;url:string;coverUrl:string;description:string;totalUnits:number;resourceType:'book'|'series'}
const cache=new Map<string,CatalogResult[]>()
const plain=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1000):''
const secure=(value:unknown)=>typeof value==='string'&&/^https?:\/\//.test(value)?value.replace(/^http:/,'https:'):''
export async function searchCatalog(query:string,type:'book'|'series',signal:AbortSignal):Promise<CatalogResult[]>{
 const key=`${type}:${query.trim().toLowerCase()}`;if(cache.has(key))return cache.get(key)!
 const url=type==='book'?`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=4&fields=key,title,author_name,cover_i,number_of_pages_median`:`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
 const response=await fetch(url,{signal});if(!response.ok)throw new Error('catalog-unavailable');const body=await response.json()
 const results:CatalogResult[]=type==='book'?(Array.isArray(body.docs)?body.docs:[]).slice(0,4).map((item:Record<string,unknown>)=>{
  const id=String(item.key || '').replace(/^\/works\//,'');return{id,source:'openlibrary' as const,name:String(item.title || '').slice(0,100),url:`https://openlibrary.org/works/${id}`,coverUrl:Number.isInteger(item.cover_i)?`https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`:'',description:Array.isArray(item.author_name)?item.author_name.join(', ').slice(0,1000):'',totalUnits:Math.min(1000000,Math.max(0,Math.round(Number(item.number_of_pages_median) || 0))),resourceType:'book' as const}
 }):(Array.isArray(body)?body:[]).slice(0,4).map(item=>{const show=item.show || {};return{id:String(show.id),source:'tvmaze' as const,name:String(show.name || '').slice(0,100),url:secure(show.url),coverUrl:secure(show.image?.medium),description:plain(show.summary),totalUnits:0,resourceType:'series' as const}})
 const valid=results.filter(result=>result.name&&/^(OL\d+W|\d+)$/.test(result.id));if(cache.size>50)cache.clear();cache.set(key,valid);return valid
}
export async function enrichCatalog(result:CatalogResult,signal:AbortSignal):Promise<CatalogResult>{
 try{
  const url=result.source==='openlibrary'?`https://openlibrary.org/works/${result.id}.json`:`https://api.tvmaze.com/shows/${result.id}/episodes`
  const response=await fetch(url,{signal});if(!response.ok)return result;const body=await response.json()
  if(result.source==='tvmaze')return{...result,totalUnits:Array.isArray(body)?Math.min(body.length,1000000):0}
  return{...result,description:plain(typeof body.description==='string'?body.description:body.description?.value)||result.description}
 }catch(error){if(signal.aborted)throw error;return result}
}
