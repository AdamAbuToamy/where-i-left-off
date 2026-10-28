import { collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import type { Firestore, Timestamp } from 'firebase/firestore'
import type { Language } from '../translations'
export const feedbackKinds = ['suggestion','bug','privacy','deletion'] as const
export type FeedbackKind = typeof feedbackKinds[number]
export type FeedbackStatus = 'open'|'reviewing'|'closed'
export type Feedback = { id:string;uid:string;kind:FeedbackKind;subject:string;message:string;language:Language;status:FeedbackStatus;reply:string;createdAt:Timestamp|null;updatedAt:Timestamp|null }
export function validFeedback(subject:string,message:string) { return subject.trim().length>=3 && subject.trim().length<=120 && message.trim().length>=10 && message.trim().length<=3000 }
export async function sendFeedback(db:Firestore,uid:string,kind:FeedbackKind,subject:string,message:string,language:Language) {
 if(!navigator.onLine)throw new Error('support-offline')
 if(!feedbackKinds.includes(kind)||!validFeedback(subject,message))throw new Error('invalid-feedback')
 const ref=doc(collection(db,'feedback')),rate=doc(db,'users',uid,'supportRate','state')
 await runTransaction(db,async tx=>{
  const previous=await tx.get(rate)
  if(previous.exists()&&Date.now()-(previous.data().submittedAt?.toMillis()||0)<60000)throw new Error('support-rate')
  tx.set(ref,{uid,kind,subject:subject.trim(),message:message.trim(),language,status:'open',reply:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
  tx.set(rate,{submittedAt:serverTimestamp(),lastId:ref.id})
 })
 return ref.id
}
export function watchFeedback(db:Firestore,uid:string,admin:boolean,receive:(items:Feedback[])=>void,fail:()=>void) {
 const ref=collection(db,'feedback')
 const q=admin?query(ref,orderBy('createdAt','desc'),limit(100)):query(ref,where('uid','==',uid),orderBy('createdAt','desc'),limit(30))
 return onSnapshot(q,s=>receive(s.docs.map(d=>({...d.data(),id:d.id} as Feedback))),fail)
}
export async function respondToFeedback(db:Firestore,id:string,status:FeedbackStatus,reply:string) {
 if(!navigator.onLine)throw new Error('support-offline')
 if(!['open','reviewing','closed'].includes(status)||reply.length>2000)throw new Error('invalid-feedback')
 await updateDoc(doc(db,'feedback',id),{status,reply:reply.trim(),updatedAt:serverTimestamp()})
}
export async function exportPersonalData(db:Firestore,uid:string) {
 if(!navigator.onLine)throw new Error('support-offline')
 const names=['projects','sections','sessions','sessionWorkspaces'] as const
 const entries=await Promise.all(names.map(async name=>[name,(await getDocsFromServer(collection(db,'users',uid,name))).docs.map(d=>({id:d.id,...d.data()}))]))
 const preference=await getDocFromServer(doc(db,'users',uid,'preferences','workflow'))
 return {preferences:preference.exists()?{workflow:preference.data()}:{},exportedAt:new Date().toISOString(),uid,scope:'Personal data only; excludes group content and server diagnostics.',...Object.fromEntries(entries)}
}
