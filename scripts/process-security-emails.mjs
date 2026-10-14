import { initializeApp,cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore,FieldValue,Timestamp } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { passwordConfirmation } from './securityEmailTemplate.mjs'
const projectId=process.env.FIREBASE_PROJECT_ID,raw=process.env.SMTP_CONFIG
if(!raw){console.log('Security email is not configured.');process.exit(0)}
if(!projectId || !process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('Server credentials are required.')
let account,cfg
try{account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);cfg=JSON.parse(raw)}catch{throw new Error('Server configuration must be valid JSON.')}
if(!account || !cfg)throw new Error('Server configuration is missing.')
if(account.project_id!==projectId)throw new Error('Credential project mismatch.')
if(!cfg.host || !cfg.user || !cfg.pass || !cfg.from || ![465,587].includes(Number(cfg.port)))throw new Error('Invalid SMTP configuration.')
initializeApp({projectId,credential:cert(account)})
const db=getFirestore(),auth=getAuth(),transport=nodemailer.createTransport({host:cfg.host,port:Number(cfg.port),secure:Number(cfg.port)===465,requireTLS:Number(cfg.port)===587,auth:{user:cfg.user,pass:cfg.pass}})
try{await transport.verify()}catch(error){const code=typeof error.code==='string' && /^[a-zA-Z0-9/_-]{1,80}$/.test(error.code)?error.code:'smtp-failed';console.error('SMTP connection failed.',code);transport.close();process.exit(1)}
const outbox=db.collection('securityNotifications')
const [pending,retries]=await Promise.all([outbox.where('status','==','pending').orderBy('requestedAt').limit(25).get(),outbox.where('status','==','processing').limit(25).get()])
let failed=0
for(const notice of [...pending.docs,...retries.docs]){
 const data=await db.runTransaction(async tx=>{
  const current=await tx.get(notice.ref)
  if(!current.exists)return null
  const value=current.data()
  if(value.status!=='pending' && !(value.status==='processing' && (value.leaseUntil?.toMillis() || 0)<=Date.now()))return null
  tx.update(notice.ref,{status:'processing',leaseUntil:Timestamp.fromMillis(Date.now()+20*60000)})
  return value
 })
 if(!data)continue
 try{
  const user=await auth.getUser(notice.id)
  if(!user.email || !user.emailVerified || (await db.doc(`accountDeletions/${notice.id}`).get()).exists){await notice.ref.update({status:'skipped',leaseUntil:FieldValue.delete()});continue}
  const template=passwordConfirmation(data.language,data.requestedAt.toMillis())
  await transport.sendMail({from:cfg.from,to:user.email,subject:template.subject,text:template.body,messageId:`<password-change-${notice.id}-${data.requestedAt.toMillis()}@where-i-left-off.web.app>`})
  await notice.ref.update({status:'sent',sentAt:FieldValue.serverTimestamp(),leaseUntil:FieldValue.delete()})
  console.log('Password confirmation delivered.')
 }catch(error){
  failed++;const code=typeof error.code==='string' && /^[a-zA-Z0-9/_-]{1,80}$/.test(error.code)?error.code:'mail-failed'
  console.error('Security notification failed; retry scheduled.',code)
  const log=db.collection('appLogs').doc();await log.set({id:log.id,uid:notice.id,timestamp:new Date().toISOString(),level:'error',event:'auth.password.email',code,page:'#/settings',environment:'production',version:'worker-v2',durationMs:0,source:'',receivedAt:FieldValue.serverTimestamp()}).catch(()=>{})
 }
}
if(failed)process.exitCode=1
else await db.doc('system/securityEmailWorker').set({availableUntil:Timestamp.fromMillis(Date.now()+3*3600000),lastRun:FieldValue.serverTimestamp()})
transport.close()
