// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { OfflineWorkspace } from '../src/lib/offlineWorkspace'
import { emptyState, projectedState } from '../src/lib/workspaceModel'
import type { OfflineState } from '../src/lib/workspaceModel'
import type { CommitResult, WorkspaceRemote, WorkspaceStore } from '../src/lib/workspacePorts'

class MemoryStore implements WorkspaceStore {
  state: OfflineState = emptyState()
  async read() { return this.state }
  async update(change: (state: OfflineState) => OfflineState) { this.state = change(this.state) }
  listen() { return () => {} }
}
let local: MemoryStore, remote: WorkspaceRemote, workspace: OfflineWorkspace, current: boolean
const commit = vi.fn<(op: unknown) => Promise<CommitResult>>()
function make() {
  let serial = 0
  local = new MemoryStore(); current = true
  remote = { newId: () => `id-${++serial}`, watchProjects: () => () => {}, watchSections: () => () => {}, commit }
  workspace = new OfflineWorkspace({ key: 'test/alice', local, remote, personal: true, isCurrentUser: () => current, receive: () => {}, now: () => 1000 })
}
beforeEach(() => { vi.stubGlobal('navigator', { onLine: true }); commit.mockReset().mockResolvedValue({}); make() })
afterEach(() => vi.unstubAllGlobals())
it('queues and flushes the application path with all card metadata preserved', async () => {
  await workspace.add('Robot', 'Connect', 0, { links: ['https://example.test'], checkpoint: 'Printed' })
  const card = projectedState(local.state).projects[0]
  await workspace.change(card, 'edit', { nextStep: 'Test' })
  expect(local.state.operations).toHaveLength(2)
  await workspace.flush()
  expect(commit).toHaveBeenCalledTimes(2); expect(local.state.operations).toHaveLength(0)
  expect(local.state.projects[0]).toMatchObject({ name: 'Robot', nextStep: 'Test', revision: 1, checkpoint: 'Printed', links: ['https://example.test'] })
})
it('retains failed writes and retries the same mutation ID without duplicating work', async () => {
  commit.mockRejectedValueOnce(new Error('offline'))
  await workspace.add('Robot', '', 0, {})
  const id = local.state.operations[0].id
  await workspace.flush(); expect(local.state.operations).toHaveLength(1)
  workspace.retry()
  await vi.waitFor(() => expect(local.state.operations).toHaveLength(0))
  expect(commit.mock.calls.map(([op]) => (op as {id:string}).id)).toEqual([id, id])
})
it('surfaces a conflict and can choose the cloud version without overwriting it', async () => {
  await workspace.add('Robot', '', 0, {})
  const card = projectedState(local.state).projects[0]
  commit.mockResolvedValueOnce({ remote: { ...card, name: 'Cloud version', revision: 2 } })
  await workspace.flush()
  const mutation = local.state.operations[0]
  expect(mutation.conflict?.remote?.name).toBe('Cloud version')
  await workspace.resolve(mutation.id, 'remote')
  expect(local.state.operations).toHaveLength(0)
  expect(local.state.projects[0].name).toBe('Cloud version')
})
it('prevents account switching from modifying queued data or flushing it', async () => {
  await workspace.add('Robot', '', 0, {})
  const id = local.state.operations[0].id
  current = false
  await expect(workspace.add('Other', '', 0, {})).rejects.toThrow('permission-denied')
  await expect(workspace.resolve(id, 'remote')).rejects.toThrow('permission-denied')
  await workspace.flush()
  expect(commit).not.toHaveBeenCalled(); expect(local.state.operations).toHaveLength(1)
})
it('checks identity again inside the storage transaction', async () => {
  const update = local.update.bind(local)
  local.update = async change => { current = false; await update(change) }
  await expect(workspace.add('Robot', '', 0, {})).rejects.toThrow('permission-denied')
  expect(local.state.operations).toHaveLength(0)
})
