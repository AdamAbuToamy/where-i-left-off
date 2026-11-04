import {useEffect,useState,useCallback} from 'react';
import type {ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {createWorkspace} from '../lib/createWorkspace';
import {auth,db} from '../lib/firebase';
import type {OfflineSnapshot} from '../lib/offlineWorkspace';
import {isAdmin} from '../lib/admin';
import {createExperienceRepository} from './browserRepository';
import {ExperienceContext} from './context';
import type {ExperienceState} from './state';
export default function ExperienceProvider({user,children}:{user:User|null;children:ReactNode}){return user&&isAdmin(user.email,user.emailVerified)?<Active key={user.uid} uid={user.uid}>{children}</Active>:children;}
function Active({uid,children}:{uid:string;children:ReactNode}){
 const [cards,setCards]=useState<OfflineSnapshot|null>(null),[workspace,setWorkspace]=useState<ReturnType<typeof createWorkspace>|null>(null);
 useEffect(()=>{const instance=createWorkspace(db!,uid,()=>auth?.currentUser?.uid===uid,snapshot=>{setWorkspace(instance);setCards(snapshot);});return instance.start();},[uid]);
 const [repository]=useState(()=>createExperienceRepository(uid)),[view,setView]=useState(()=>repository.view);
 useEffect(()=>{const stop=repository.start(setView),online=()=>repository.retry();window.addEventListener('online',online);return()=>{window.removeEventListener('online',online);stop();};},[repository]);
 const change=useCallback((update:(state:ExperienceState)=>ExperienceState)=>repository.apply(update(repository.state)),[repository]);
 return <ExperienceContext value={{uid,workspace,cards,repository,view,change}}>{children}</ExperienceContext>;
}
