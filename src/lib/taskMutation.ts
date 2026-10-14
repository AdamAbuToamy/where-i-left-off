import type { User } from 'firebase/auth'
import type { TaskEntry } from './taskOverview'
import type { ProjectDetails } from './projects'
import { OfflineWorkspace } from './offlineWorkspace'
import { auth,db } from './firebase'
export async function mutateTask(user:User,entry:TaskEntry,values:ProjectDetails,permanent=false){
 if(entry.canManage===false)throw new Error('permission-denied')
 const workspace=new OfflineWorkspace(db!,user.uid,()=>auth?.currentUser?.uid===user.uid,()=>{},entry.groupId)
 if(permanent)await workspace.change(entry.project,'delete')
 else await workspace.change(entry.project,'edit',{...entry.project,...values,name:entry.project.name,nextStep:entry.project.nextStep})
 await workspace.flush()
}
