// @vitest-environment jsdom
import {browserWorkspaceConnectivity} from '../src/lib/browserWorkspaceConnectivity'
import {withWorkspaceLock} from '../src/lib/workspaceLock'
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
  workspace = new OfflineWorkspace({connectivity:browserWorkspaceConnectivity,lock:{run:withWorkspaceLock}, key: 'test/alice', local, remote, personal: true, isCurrentUser: () => current, receive: () => {}, now: () => 1000 })
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

it('reopens terminated read listeners on retry and ignores callbacks from the old subscriptions',async()=>{
 const projectReads:{receive:Parameters<WorkspaceRemote['watchProjects']>[0];fail:Parameters<WorkspaceRemote['watchProjects']>[1]}[]=[];
 const sectionReads:{receive:Parameters<WorkspaceRemote['watchSections']>[0];fail:Parameters<WorkspaceRemote['watchSections']>[1]}[]=[];
 const unsubscribe=vi.fn(),receive=vi.fn();
 remote.watchProjects=vi.fn((next,fail)=>{projectReads.push({receive:next,fail});return unsubscribe;});
 remote.watchSections=vi.fn((next,fail)=>{sectionReads.push({receive:next,fail});return unsubscribe;});
 const coordinator=new OfflineWorkspace({connectivity:browserWorkspaceConnectivity,lock:{run:withWorkspaceLock},key:'test/reconnect',local,remote,personal:true,isCurrentUser:()=>current,receive});
 const stop=coordinator.start();
 try{
  await vi.waitFor(()=>expect(projectReads).toHaveLength(1));
  projectReads[0].fail(Object.assign(new Error('denied'),{code:'permission-denied'}));
  sectionReads[0].fail(Object.assign(new Error('denied'),{code:'permission-denied'}));
  await coordinator.add('Keep queued card','',0,{});
  const id=local.state.operations[0].id;
  commit.mockRejectedValueOnce(new Error('network unavailable'));
  coordinator.retry();
  expect(projectReads).toHaveLength(2);expect(sectionReads).toHaveLength(2);expect(unsubscribe).toHaveBeenCalledTimes(2);
  await vi.waitFor(()=>expect(receive.mock.calls.at(-1)?.[0].syncing).toBe(false));
  expect(local.state.operations[0].id).toBe(id);
  projectReads[1].receive([],false);sectionReads[1].receive([],false);
  await vi.waitFor(()=>expect(receive.mock.calls.at(-1)?.[0].cached).toBe(false));
  coordinator.retry();await vi.waitFor(()=>expect(local.state.operations).toHaveLength(0));
  projectReads[0].fail(new Error('stale listener'));
  expect(receive.mock.calls.at(-1)?.[0].error).toBeNull();
  expect(local.state.projects[0].name).toBe('Keep queued card');
  expect(commit.mock.calls.map(([op])=>(op as {id:string}).id)).toEqual([id,id]);
 }finally{stop();}
 coordinator.retry();expect(projectReads).toHaveLength(2);
});
it('does not restart listeners for an account that is no longer active',async()=>{
 const watch=vi.fn(()=>()=>{});remote.watchProjects=watch;
 const stop=workspace.start();
 try{await vi.waitFor(()=>expect(watch).toHaveBeenCalledTimes(1));current=false;workspace.retry();expect(watch).toHaveBeenCalledTimes(1);}finally{stop();}
});