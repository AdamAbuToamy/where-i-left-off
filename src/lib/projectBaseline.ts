import type { Project } from '../types'
import { normalizedProject } from './offlineStore'
export function sameProjectBaseline(before:Project,remote:Project,raw:Record<string,unknown>){
 const left=normalizedProject(before.id,before),right=normalizedProject(remote.id,remote)
 // Legacy cards had only updatedAt. Inferred timestamps must not conflict with an old offline outbox.
 if(!('activityAt' in raw))left.activityAt=right.activityAt
 if(!('completedAt' in raw))left.completedAt=right.completedAt
 return JSON.stringify(left)===JSON.stringify(right)
}
