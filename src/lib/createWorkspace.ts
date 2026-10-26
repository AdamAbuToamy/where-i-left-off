import {browserWorkspaceConnectivity} from './browserWorkspaceConnectivity'
import {withWorkspaceLock} from './workspaceLock'
import type { Firestore } from 'firebase/firestore'
import { OfflineWorkspace } from './offlineWorkspace'
import type { OfflineSnapshot } from './offlineWorkspace'
import { FirestoreWorkspaceRemote } from './firestoreWorkspaceRemote'
import { IndexedDbWorkspaceStore } from './indexedDbWorkspaceStore'

/** Composition root: domain/coordinator code does not construct infrastructure. */
export function createWorkspace(db: Firestore, uid: string, isCurrentUser: () => boolean, receive: (snapshot: OfflineSnapshot) => void, groupId?: string) {
  const key = `${db.app.options.projectId}/${uid}${groupId ? `/group/${groupId}` : ''}`
  return new OfflineWorkspace({connectivity:browserWorkspaceConnectivity,lock:{run:withWorkspaceLock},
    key, personal: !groupId, isCurrentUser, receive,
    local: new IndexedDbWorkspaceStore(key),
    remote: new FirestoreWorkspaceRemote(db, uid, isCurrentUser, groupId),
  })
}
