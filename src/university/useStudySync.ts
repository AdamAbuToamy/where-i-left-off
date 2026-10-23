import { useEffect, useRef, useState } from 'react';
import { FirestoreStudyRemote } from './firestoreStudyRemote';
import { auth, db } from '../lib/firebase';
import { UniversityRepository } from './studyRepository';
import type { StudySyncStatus } from './studyRepository';
import type { UniversityState, UniversityStore } from './model';
export function useStudySync(store:UniversityStore,uid:string,onState:(state:UniversityState)=>void){
  const callback=useRef(onState);useEffect(()=>{callback.current=onState;},[onState]);
  const [repository]=useState(()=>new UniversityRepository(store,new FirestoreStudyRemote(db!,uid,()=>auth?.currentUser?.uid)));
  const [status,setStatus]=useState<StudySyncStatus>({ready:false,pending:0,conflicts:[],error:''});
  useEffect(()=>{
    repository.start((state,status)=>{callback.current(state);setStatus(status);});
    const online=()=>repository.retry();window.addEventListener('online',online);
    return()=>{window.removeEventListener('online',online);repository.stop();};
  },[repository]);
  return {status,commit:(next:UniversityState)=>repository.commit(next),resolve:(key:string,choice:'local'|'cloud')=>repository.resolve(key,choice),retry:()=>repository.retry()};
}
