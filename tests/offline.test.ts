import { describe, expect, it } from 'vitest'
import { emptyState, nextMutation, normalizedProject, projectedState } from '../src/lib/offlineStore'
import type { Mutation } from '../src/lib/offlineStore'
const card = normalizedProject('card', { name: 'Card', nextStep: 'Initial', revision: 0 })
const mutation = (id: string, after: typeof card | null, before: typeof card | null = card): Mutation => ({ id, entity: 'project', entityId: 'card', before, after })
describe('durable outbox projection and ordering', () => {
  it('shows the latest queued edit without changing the confirmed server data', () => {
    const base = emptyState()
    base.projects = [card]
    base.operations = [mutation('first', { ...card, nextStep: 'First edit', revision: 1 }), mutation('second', { ...card, nextStep: 'Last edit', revision: 2 })]
    expect(projectedState(base).projects[0]).toMatchObject({ nextStep: 'Last edit', revision: 2 })
    expect(base.projects[0].nextStep).toBe('Initial')
  })
  it('retains offline additions and removes locally deleted cards', () => {
    const state = emptyState()
    state.operations = [mutation('add', card, null)]
    expect(projectedState(state).projects).toHaveLength(1)
    state.operations.push(mutation('delete', null))
    expect(projectedState(state).projects).toHaveLength(0)
  })
  it('blocks later edits of a conflicted card while allowing unrelated cards to sync', () => {
    const state = emptyState()
    state.operations = [{ ...mutation('conflict', card), conflict: { remote: { ...card, revision: 3 } } }, mutation('later', card), { ...mutation('other', card), entityId: 'other' }]
    expect(nextMutation(state)?.id).toBe('other')
  })
  it('projects pending section renames separately from project cards', () => {
    const state = emptyState()
    state.sections = [{ id: 'university', name: 'Old name', revision: 0 }]
    state.operations = [{ id: 'rename', entity: 'section', entityId: 'university', before: state.sections[0], after: { id: 'university', name: 'New name', revision: 1 } }]
    expect(projectedState(state).sections[0].name).toBe('New name')
  })
})
