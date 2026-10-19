import { listenLocal, readLocal, updateLocal } from './offlineStore'
import type { OfflineState } from './workspaceModel'
import type { WorkspaceStore } from './workspacePorts'

export class IndexedDbWorkspaceStore implements WorkspaceStore {
  private readonly key: string
  constructor(key: string) { this.key = key }
  read(): Promise<OfflineState> { return readLocal(this.key) }
  update(change: (state: OfflineState) => OfflineState): Promise<void> { return updateLocal(this.key, change) }
  listen(changed: () => void): () => void { return listenLocal(this.key, changed) }
}
