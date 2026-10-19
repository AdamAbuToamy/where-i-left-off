import { expect, it } from 'vitest'
import type { ProjectChanges } from '../src/lib/projectEntity'
import { ProjectEntity } from '../src/lib/projectEntity'

it('encapsulates creation and does not expose mutable arrays through snapshots', () => {
  const links = ['https://example.test']
  const entity = ProjectEntity.create('one', ' Robot ', ' Connect ', 0, { links, status: 'done' }, 100)
  links.push('https://other.test')
  const snapshot = entity.snapshot()
  snapshot.links!.push('https://changed.test')
  snapshot.name = 'Tampered'
  expect(entity.snapshot()).toMatchObject({ name: 'Robot', nextStep: 'Connect', revision: 0, activityAt: 100, completedAt: 100, links: ['https://example.test'] })
})
it('applies edits without changing identity and preserves omitted fields', () => {
  const entity = ProjectEntity.create('one', 'Robot', 'Connect', 0, { checkpoint: 'Printed base', links: ['https://example.test'] }, 100)
  const edited = entity.apply('edit', { nextStep: ' Test ' }, 0, 200)!
  expect(edited.snapshot()).toMatchObject({ id: 'one', name: 'Robot', nextStep: 'Test', checkpoint: 'Printed base', revision: 1, activityAt: 200 })
  expect(entity.snapshot().nextStep).toBe('Connect')
})
it('rejects stale destructive changes and invalid ranks before queueing', () => {
  const entity = ProjectEntity.create('one', 'Robot', '', 0, {}, 100)
  expect(() => entity.apply('edit', { name: 'Stale' }, 1, 200)).toThrow('conflict')
  expect(() => entity.apply('delete', {}, 1, 200)).toThrow('conflict')
  for (const rank of [NaN, Infinity, 1e15, -1e15]) expect(() => entity.apply('move', { rank }, 0, 200)).toThrow('order-limit')
  expect(() => ProjectEntity.create('one', 'Robot', '', Infinity, {}, 100)).toThrow('order-limit')
})
it('preserves metadata through moves, and consistently tracks completion and reopening', () => {
  const entity = ProjectEntity.create('one', 'Robot', '', 0, { checklist: '[x] Printed', resourceType: 'project' }, 100)
  const moved = entity.apply('move', { rank: 1024 }, 0, 200)!
  expect(moved.snapshot()).toMatchObject({ rank: 1024, revision: 1, activityAt: 100, checklist: '[x] Printed' })
  const done = moved.apply('edit', { status: 'done' }, 1, 300)!
  expect(done.snapshot().completedAt).toBe(300)
  const reopened = done.apply('edit', { status: 'active' }, 2, 400)!
  expect(reopened.snapshot()).toMatchObject({ completedAt: 0, activityAt: 400 })
})
it('validates restored state rather than letting a forged revision enter the domain', () => {
  const value = ProjectEntity.create('one', 'Robot', '', 0, {}, 100).snapshot()
  expect(() => ProjectEntity.restore({ ...value, revision: -1 })).toThrow('invalid-project')
  expect(() => ProjectEntity.restore({ ...value, projectUrl: 'javascript:alert(1)' })).toThrow('invalid-project-url')
})

it('does not allow an edit payload to replace identity or retain undeclared fields', () => {
  const entity = ProjectEntity.create('one', 'Robot', '', 0, {}, 100)
  const forged = { id: 'other', revision: 99, name: 'Updated', unexpected: 'discard' } as ProjectChanges
  const after = entity.apply('edit', forged, 0, 200)!.snapshot()
  expect(after).toMatchObject({ id: 'one', revision: 1, name: 'Updated' })
  expect(after).not.toHaveProperty('unexpected')
})
