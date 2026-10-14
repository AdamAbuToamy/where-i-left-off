import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ProjectCard from '../src/components/ProjectCard'
import type { Project } from '../src/types'
const project: Project = { id: 'one', name: 'Robot', nextStep: 'Test bearing', status: 'later', rank: 0, revision: 0 }
function render(canEdit: boolean, canManage: boolean) {
  return renderToStaticMarkup(createElement(ProjectCard, { project, sections: [], language: 'en', canEdit, canManage, onToggle: () => {}, onUpdate: async () => true, onDelete: async () => true }))
}
it('hides actions that a read-only group member cannot perform', () => {
  const markup = render(false, false)
  expect(markup).not.toContain('Start work')
  expect(markup).not.toContain('Card options')
  expect(markup).not.toContain('Delete')
})
it('keeps edits available to assignees and restricts deletion to managers', () => {
  const assignee = render(true, false)
  expect(assignee).toContain('Start work')
  expect(assignee).toContain('<details class="card-options">')
  expect(assignee).toContain('Edit')
  expect(assignee).not.toContain('Delete')
  expect(render(true, true)).toContain('Delete')
})
