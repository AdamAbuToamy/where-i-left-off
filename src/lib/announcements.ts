import { collection,deleteDoc,doc,limit,onSnapshot,orderBy,query,serverTimestamp,setDoc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import { displayName } from './profile'
export type Announcement={id:string;title:string;body:string;authorUid:string;authorName:string;createdAt:Timestamp|null}
export function watchAnnouncements(groupId:string,receive:(items:Announcement[])=>void,fail:(error:Error)=>void,max=20) {
 return onSnapshot(query(collection(db!,'groups',groupId,'announcements'),orderBy('createdAt','desc'),limit(max)),snapshot=>receive(snapshot.docs.map(item=>({...item.data(),id:item.id} as Announcement))),fail)
}
export async function publishAnnouncement(groupId:string,user:User,title:string,body:string) {
 if(!navigator.onLine)throw new Error('offline')
 if(!title.trim() || title.trim().length>100 || !body.trim() || body.trim().length>2000)throw new Error('invalid-announcement')
 const ref=doc(collection(db!,'groups',groupId,'announcements'))
 await setDoc(ref,{title:title.trim(),body:body.trim(),authorUid:user.uid,authorName:displayName(user).slice(0,100),createdAt:serverTimestamp()})
}
export function removeAnnouncement(groupId:string,id:string){return deleteDoc(doc(db!,'groups',groupId,'announcements',id))}
const readKey=(uid:string,gid:string)=>`announcement-read:${db!.app.options.projectId}/${uid}/${gid}`
export function lastRead(uid:string,gid:string) {try{return Number(localStorage.getItem(readKey(uid,gid))) || 0}catch{return 0}}
export function acknowledgeAnnouncements(uid:string,gid:string,time:number) {
 try{localStorage.setItem(readKey(uid,gid),String(Math.max(time,lastRead(uid,gid))))}catch{/* Session acknowledgement still refreshes the UI. */}
 window.dispatchEvent(new Event('announcements-read'))
}
