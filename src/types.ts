export type Project = {
  id: string
  name: string
  nextStep: string
  projectUrl?: string
  attachmentUrl?: string
  links?: string[]
  dueDate?: string
  archivedAt?: number
  trashedAt?: number
  activityAt?: number
  completedAt?: number
  resourceType?: 'project' | 'book' | 'course' | 'video' | 'series' | 'film' | 'shopping' | 'idea'
  progressUnits?: number
  totalUnits?: number
  followUpDate?: string
  coverUrl?: string
  description?: string
  catalogSource?: string
  catalogId?: string
  status: 'later' | 'active' | 'waiting' | 'done'
  assignedTo?: string
  sectionId?: string
  kind?: 'resume' | 'waiting' | 'deadline' | 'list'
  checkpoint?: string
  checklist?: string
  rank: number
  revision: number
}

export type Section = { id: string; name: string; revision?: number }

export type GroupInfo = { id: string; name: string; role: 'manager' | 'member' }
export type GroupMember = { uid: string; name: string; email: string; role: 'manager' | 'member'; canCreate?: boolean }
