import { useEffect,useRef,useState } from 'react'
import type { Language } from '../translations'
import type { ProjectDetails } from '../lib/projects'
import { workflowText } from '../workflowText'
import { searchCatalog,enrichCatalog } from '../lib/catalog'
import type { CatalogResult } from '../lib/catalog'
export default function CatalogLookup({name,type,language,onChoose}:{name:string;type?:string;language:Language;onChoose:(name:string,values:ProjectDetails)=>void}){
 const t=workflowText[language],[results,setResults]=useState<CatalogResult[]>([]),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false),[selected,setSelected]=useState(''),selection=useRef<AbortController|null>(null)
 useEffect(()=>{
  if((type!=='book'&&type!=='series')||name.trim().length<3||selected===name)return
  const controller=new AbortController(),timer=window.setTimeout(()=>{setLoading(true);setFailed(false);void searchCatalog(name,type,controller.signal).then(items=>{if(!controller.signal.aborted)setResults(items)}).catch(()=>{if(!controller.signal.aborted)setFailed(true)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},1000)
  return()=>{controller.abort();selection.current?.abort();window.clearTimeout(timer)}
 },[name,type,selected])
 if(type!=='book'&&type!=='series')return null
 async function choose(result:CatalogResult){selection.current?.abort();const controller=new AbortController();selection.current=controller;setLoading(true);try{const item=await enrichCatalog(result,controller.signal);if(controller.signal.aborted)return;setSelected(item.name);setResults([]);onChoose(item.name,{resourceType:item.resourceType,coverUrl:item.coverUrl,description:item.description,totalUnits:item.totalUnits,catalogId:item.id,catalogSource:item.source,projectUrl:item.url})}catch{if(!controller.signal.aborted)setFailed(true)}finally{if(!controller.signal.aborted)setLoading(false)}}
 return <section className="catalog-lookup"><small>{t.lookupHint}</small>{loading&&<p role="status">{t.loading}</p>}{failed&&<p role="status">{t.lookupFail}</p>}{name.trim().length>=3&&!loading&&!failed&&!results.length&&selected!==name&&<p>{t.noResults}</p>}{selected!==name&&results.map(result=><button type="button" className="catalog-result" key={result.id} disabled={loading} onClick={()=>void choose(result)}>{result.coverUrl&&<img src={result.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<span><strong dir="auto">{result.name}</strong><small>{result.description.slice(0,140)}</small><small>{t.source}: {result.source==='tvmaze'?'TVmaze':'Open Library'}</small></span></button>)}</section>
}
