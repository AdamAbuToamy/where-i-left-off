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

export function validateProject(name: string, nextStep: string) {
  if (!name.trim() || name.length > 100 || nextStep.length > 1000) throw new Error('invalid-project')
}
