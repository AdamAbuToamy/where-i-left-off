// @vitest-environment node
import { expect, test } from 'vitest'
import { withWorkspaceLock } from '../src/lib/workspaceLock'

test('independent workers consume a shared outbox only once per operation', async () => {
  const queue = ['one', 'two', 'three']
  const committed: string[] = []
  await Promise.all(Array.from({ length: 8 }, () => withWorkspaceLock('same-account', async () => {
    while (queue.length) {
      const next = queue[0]
      await new Promise(resolve => setTimeout(resolve, 2))
      committed.push(next)
      queue.shift()
    }
  })))
  expect(committed).toEqual(['one', 'two', 'three'])
})

test('an error releases the lock and unrelated accounts do not block each other', async () => {
  let release!: () => void
  const blocked = withWorkspaceLock('account-a', () => new Promise<void>(resolve => { release = resolve }))
  await Promise.resolve()
  await expect(withWorkspaceLock('account-b', async () => 7)).resolves.toBe(7)
  release()
  await blocked
  await expect(withWorkspaceLock('account-a', async () => { throw new Error('failed') })).rejects.toThrow('failed')
  await expect(withWorkspaceLock('account-a', async () => 9)).resolves.toBe(9)
})
