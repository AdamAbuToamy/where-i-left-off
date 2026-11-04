import {doc,onSnapshot,runTransaction,serverTimestamp} from 'firebase/firestore';
import {auth,db} from '../lib/firebase';
import {isAdmin} from '../lib/admin';
import {createClientId} from '../lib/clientId';
import {RevisionedRepository,RevisionConflict} from '../lib/revisionedRepository';
import type {JournalRecord} from '../lib/revisionedRepository';
import {emptyExperience,parseExperience} from './state';
import type {ExperienceState} from './state';
function decode(data:Record<string,unknown>):JournalRecord<ExperienceState>{if(data.version!==1||typeof data.payload!=='string'||data.payload.length>450000||!Number.isSafeInteger(data.revision)||Number(data.revision)<1||typeof data.mutationId!=='string'||!/^[-\w]{1,100}$/.test(data.mutationId))throw new Error('experience-invalid');return {state:parseExperience(JSON.parse(data.payload)),revision:Number(data.revision),mutationId:data.mutationId};}
export function createExperienceRepository(uid:string){
 const current=()=>auth?.currentUser?.uid===uid&&isAdmin(auth.currentUser.email,auth.currentUser.emailVerified),ref=doc(db!,'users',uid,'experience','workspace'),key=`experience:v1/${db!.app.options.projectId}/${uid}`;
 const check=()=>{if(!current())throw new Error('experience-account');};
 return new RevisionedRepository<ExperienceState>({codec:{parse:parseExperience,empty:emptyExperience,errorPrefix:'experience'},isCurrent:current,newId:createClientId,schedule(work){const timer=setTimeout(work,450);return()=>clearTimeout(timer);},local:{read(){const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;},write(value){check();localStorage.setItem(key,JSON.stringify(value));}},remote:{watch(receive,fail){check();return onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{try{check();receive(snapshot.exists()?decode(snapshot.data()):null,snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites);}catch{fail();}},()=>fail());},async write(state,expectedRevision,mutationId){check();const payload=JSON.stringify(parseExperience(state));return runTransaction(db!,async tx=>{check();const snapshot=await tx.get(ref),before=snapshot.exists()?decode(snapshot.data()):null;if(before?.mutationId===mutationId)return before;if((before?.revision??null)!==expectedRevision)throw new RevisionConflict(before);const revision=(before?.revision||0)+1;tx.set(ref,{version:1,payload,revision,mutationId,updatedAt:serverTimestamp()});return {state,revision,mutationId};});}}});
}
