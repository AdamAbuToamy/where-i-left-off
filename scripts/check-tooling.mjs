import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'

// Resolve the actual dependencies used by the CLI, not unrelated root packages.
const require = createRequire(import.meta.url)
const cliRequire = createRequire(require.resolve('firebase-tools/package.json'))
const chokidar = cliRequire('chokidar')
const gaxiosRequire = createRequire(cliRequire.resolve('gaxios'))
const uuid = gaxiosRequire('uuid')
assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
const pubsubRequire = createRequire(cliRequire.resolve('@google-cloud/pubsub'))
const { W3CTraceContextPropagator } = pubsubRequire('@opentelemetry/core')
const api = pubsubRequire('@opentelemetry/api')
const traceId = '1234567890abcdef1234567890abcdef'
const spanId = '1234567890abcdef'
const context = api.trace.setSpanContext(api.ROOT_CONTEXT, { traceId, spanId, traceFlags: 1 })
const carrier = {}
const propagator = new W3CTraceContextPropagator()
propagator.inject(context, carrier, api.defaultTextMapSetter)
assert.equal(api.trace.getSpanContext(propagator.extract(api.ROOT_CONTEXT, carrier, api.defaultTextMapGetter)).traceId, traceId)
const { PubSub } = cliRequire('@google-cloud/pubsub')
const client = new PubSub({ projectId: 'demo-where-i-left-off', apiEndpoint: '127.0.0.1:8085' })
assert.equal(typeof client.topic('compatibility-test').createSubscription, 'function')
await client.close()

const directory = await mkdtemp(join(tmpdir(), 'recall-watcher-'))
const file = join(directory, 'firestore.rules')
await writeFile(file, 'first')
const watcher = chokidar.watch(file, { ignoreInitial: true, persistent: true })
const timer = setTimeout(() => { console.error('File watcher timed out'); process.exit(1) }, 10000)
try {
  await once(watcher, 'ready')
  const changed = once(watcher, 'change')
  await writeFile(file, 'second')
  const [path] = await changed
  assert.equal(path, file)
} finally {
  clearTimeout(timer)
  await watcher.close()
  await rm(directory, { recursive: true, force: true })
}
console.log('Firebase tooling compatibility: UUID, trace propagation, Pub/Sub loading and rules-file watching passed.')
