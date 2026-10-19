import type { Project, Section } from '../types'

export type LocalEntity = Project | Section
export type Mutation = {
  id: string
  entity: 'project' | 'section'
  entityId: string
  before: LocalEntity | null
  after: LocalEntity | null
  conflict?: { remote: LocalEntity | null }
}
export type OfflineState = { projects: Project[]; sections: Section[]; operations: Mutation[] }
export const emptyState = (): OfflineState => ({ projects: [], sections: [], operations: [] })

export function projectedState(state: OfflineState) {
  const projects = new Map(state.projects.map(p => [p.id, p]))
  const sections = new Map(state.sections.map(s => [s.id, s]))
  for (const op of state.operations) {
    if (op.entity === 'project') {
      if (op.after) projects.set(op.entityId, op.after as Project)
      else projects.delete(op.entityId)
    } else {
      if (op.after) sections.set(op.entityId, op.after as Section)
      else sections.delete(op.entityId)
    }
  }
  return { projects: [...projects.values()].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)), sections: [...sections.values()].sort((a, b) => a.name.localeCompare(b.name)) }
}
export function nextMutation(state: OfflineState) {
  return state.operations.find((op, i) => !op.conflict && !state.operations.slice(0, i).some(previous => previous.entity === op.entity && previous.entityId === op.entityId))
}
export function normalizedProject(id: string, value: Partial<Project>): Project {
  return { archivedAt:value.archivedAt || 0,trashedAt:value.trashedAt || 0,activityAt:value.activityAt || (value as Partial<Project>&{updatedAt?:{toMillis:()=>number}}).updatedAt?.toMillis?.() || 0,completedAt:value.completedAt || 0,resourceType:value.resourceType || 'project',progressUnits:value.progressUnits || 0,totalUnits:value.totalUnits || 0,followUpDate:value.followUpDate || '',coverUrl:value.coverUrl || '',description:value.description || '',catalogSource:value.catalogSource || '',catalogId:value.catalogId || '',id, name: value.name || '', nextStep: value.nextStep || '', projectUrl: value.projectUrl || '', attachmentUrl: value.attachmentUrl || '', links: Array.isArray(value.links)?value.links.filter(link=>typeof link==='string'):[], dueDate: value.dueDate || '', assignedTo: value.assignedTo || '', sectionId: value.sectionId || '', kind: value.kind || 'resume', checkpoint: value.checkpoint || '', checklist: value.checklist || '', status: value.status || 'later', rank: value.rank ?? 0, revision: value.revision ?? 0 }
}
export function normalizedSection(id: string, value: Partial<Section>): Section { return { id, name: value.name || '', revision: value.revision ?? 0 } }
