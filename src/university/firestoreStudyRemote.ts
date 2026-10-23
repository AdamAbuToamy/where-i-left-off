import {collection, doc, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore'
import type {Firestore} from 'firebase/firestore'
import type {StudyRecord, StudyRemote} from './studyRepository'
/** Firebase adapter. Account identity is checked before reads, callbacks and transactional writes. */
export class FirestoreStudyRemote implements StudyRemote {
 private db: Firestore
 private uid: string
 private currentUid: () => string | undefined
 constructor(db: Firestore, uid: string, currentUid: () => string | undefined) {this.db=db;this.uid=uid;this.currentUid=currentUid}
 private check() {if (this.currentUid() !== this.uid) throw new Error('account-changed')}
 watch(receive: (records: StudyRecord[]) => void, fail: (error: unknown) => void) {
  this.check()
  return onSnapshot(collection(this.db, 'users', this.uid, 'studyRecords'), {includeMetadataChanges: true}, snapshot => {
   if (snapshot.metadata.fromCache) return
   try {
    this.check()
    const records = snapshot.docs.map(document => {
     const r = document.data()
     if (!['courses','tasks','lessons'].includes(r.kind) || typeof r.payload !== 'string' || typeof r.id !== 'string' || !Number.isInteger(r.revision) || r.revision < 0 || typeof r.deleted !== 'boolean' || typeof r.mutationId !== 'string' || document.id !== r.kind+'_'+r.id) throw new Error('invalid-record')
     return r as StudyRecord
    })
    receive(records)
   } catch (error) {fail(error)}
  }, fail)
 }
 async write(key: string, update: (current: StudyRecord | null) => StudyRecord): Promise<StudyRecord> {
  this.check()
  return runTransaction(this.db, async transaction => {
   this.check()
   const target = doc(this.db, 'users', this.uid, 'studyRecords', key), snapshot = await transaction.get(target)
   this.check()
   const current = snapshot.exists() ? snapshot.data() as StudyRecord : null
   const next = update(current)
   if (next !== current) transaction.set(target, {...next, updatedAt: serverTimestamp()})
   return next
  })
 }
}
