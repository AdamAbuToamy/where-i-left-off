import type { Project } from '../types'

export function sortedProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
}

export function rankForMove(projects: Project[], activeId: string, overId: string): number | null {
  const items = sortedProjects(projects)
  const from = items.findIndex(p => p.id === activeId)
  const to = items.findIndex(p => p.id === overId)
  if (from < 0 || to < 0 || from === to) return null
  const [moved] = items.splice(from, 1)
  items.splice(to, 0, moved)
  const before = items[to - 1]?.rank
  const after = items[to + 1]?.rank
  const rank = before === undefined ? after! - 1024 : after === undefined ? before + 1024 : (before + after) / 2
  if (!Number.isFinite(rank) || rank === before || rank === after) throw new Error('order-limit')
  return rank
}

export type ProjectDetails = Pick<Project, 'projectUrl' | 'attachmentUrl' | 'dueDate' | 'assignedTo' | 'sectionId' | 'kind' | 'checkpoint' | 'checklist'> & { status?: Project['status'] }

function validHttpUrl(value: string) {
  if (!value) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch { return false }
}

function validDate(value: string) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateProject(name: string, nextStep: string, details: ProjectDetails = {}) {
  if (!name.trim() || name.length > 100 || nextStep.length > 1000) throw new Error('invalid-project')
  const { projectUrl = '', attachmentUrl = '', dueDate = '' } = details
  if (projectUrl.length > 500 || !validHttpUrl(projectUrl)) throw new Error('invalid-project-url')
  if (attachmentUrl.length > 500 || !validHttpUrl(attachmentUrl)) throw new Error('invalid-attachment-url')
  if ((details.assignedTo ?? '').length > 128) throw new Error('invalid-project')
  if ((details.sectionId ?? '').length > 100 || (details.checkpoint ?? '').length > 1000 || (details.checklist ?? '').length > 3000) throw new Error('invalid-project')
  if (details.kind && !['resume', 'waiting', 'deadline', 'list'].includes(details.kind)) throw new Error('invalid-project')
  if (details.status && !['later', 'active', 'waiting', 'done'].includes(details.status)) throw new Error('invalid-project')
  if (!validDate(dueDate)) throw new Error('invalid-due-date')
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function matchesView(project: Project, view: string, today = localDateKey()) {
  if (view === 'today') return project.status !== 'done' && project.dueDate === today
  if (view === 'overdue') return project.status !== 'done' && !!project.dueDate && project.dueDate < today
  if (view === 'upcoming') return project.status !== 'done' && !!project.dueDate && project.dueDate > today
  return view === 'all' || project.status === view
}
export function toggleChecklist(text: string, index: number) {
  return text.split('\n').map((line, i) => i === index ? (/^\[x\] /i.test(line) ? line.replace(/^\[x\] /i, '[ ] ') : `[x] ${line.replace(/^\[ \] /, '')}`) : line).join('\n')
}
