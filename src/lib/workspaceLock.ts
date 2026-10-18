// All workspace instances share one outbox. Serialize its reader/committer,
// including other tabs when the browser supports the Web Locks API.
const tails = new Map<string, Promise<void>>()

export async function withWorkspaceLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`where-i-left-off-sync/${key}`, { mode: 'exclusive' }, action)
  }
  const previous = tails.get(key) || Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const tail = previous.then(() => gate)
  tails.set(key, tail)
  await previous
  try { return await action() }
  finally {
    release()
    if (tails.get(key) === tail) tails.delete(key)
  }
}
