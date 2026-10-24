import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from './lib/firebase';
import {isAdmin} from './lib/admin';
import AuthPanel from './components/AuthPanel';
import CloudApp from './CloudApp';
import type {Language} from './translations';

/** Pilot is an access gate, not a second copy of application data or credentials. */
export default function App(){
 const [account,setAccount]=useState<{email:string|null;verified:boolean}|null|undefined>(undefined);
 useEffect(()=>{if(import.meta.env.VITE_WILO_PILOT!=='true')return;
  if(!auth)return;
  return onAuthStateChanged(auth,user=>setAccount(user?{email:user.email,verified:user.emailVerified}:null),()=>setAccount(null));
 },[]);
 if(import.meta.env.VITE_WILO_PILOT!=='true')return <CloudApp/>;
 if(!auth)return <main className="workspace" role="alert">Preview Firebase configuration unavailable.</main>;
 if(account===undefined)return <main className="workspace"><p role="status">Loading private WILO pilot…</p></main>;
 if(!account)return <main className="workspace"><h1>WILO Private Pilot</h1><AuthPanel language={'ar' as Language}/></main>;
 if(!isAdmin(account.email,account.verified))return <main className="workspace" role="alert"><h1>WILO Private Pilot</h1><p>هذه النسخة التجريبية مخصصة للحساب التجريبي المصرح له فقط.</p></main>;
 return <CloudApp/>;
}
