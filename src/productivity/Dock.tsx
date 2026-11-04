import {lazy,Suspense,useState,useEffect} from 'react';
import {Inbox,Sparkles} from 'lucide-react';
import type {Language} from '../translations';
import type {User} from 'firebase/auth';
import {useExperience} from './context';
import {label} from './helpers';
import './pilot.css';
const Hub=lazy(()=>import('./Hub'));
export default function ExperienceDock({user,language}:{user:User;language:Language}){const context=useExperience(),[open,setOpen]=useState(false),[target,setTarget]=useState({tab:'inbox',card:''});useEffect(()=>{if(!context)return;const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.uid!==context.uid)return;setTarget({tab:detail.tab,card:detail.card||''});setOpen(true);};window.addEventListener('experience-open',receive);return()=>window.removeEventListener('experience-open',receive);},[context?.uid]);if(!context)return null;const count=context.view.state.inbox.filter(i=>!i.cardId).length;return <div className="pilot-dock"><button aria-label={label(language,"مركز العمل","Work hub","מרכז עבודה")} onClick={()=>{setTarget({tab:"inbox",card:""});setOpen(true);}} className="pilot-launch"><Sparkles size={17}/>{label(language,'مركز العمل','Work hub','מרכז עבודה')}{count>0&&<span><Inbox size={14}/>{count}</span>}</button>{open&&<Suspense fallback={<span role="status">…</span>}><Hub initialTab={target.tab} selected={target.card} user={user} language={language} close={()=>setOpen(false)}/></Suspense>}</div>;}
