import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
async function files(directory, prefix = '') {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`
    if (entry.isDirectory()) output.push(...await files(`${directory}/${entry.name}`, path))
    else if (entry.name !== 'sw.js') output.push(path)
  }
  return output.sort()
}
// Local AI runtime is optional and large. Do not download it during every PWA install.
const paths = (await files('dist')).filter(path=>path!=='/assistant-config.json'&&!/^\/assets\/(?:AssistantWidget|assistant|localModel|web-llm|index-worker|lib-)/.test(path))
const hash = createHash('sha256')
for (const path of paths) hash.update(await readFile(`dist${path}`))
const version = hash.digest('hex').slice(0, 16)
const source = await readFile('public/sw.js', 'utf8')
await writeFile('dist/sw.js', source.replace("'where-i-left-off-shell-dev'", `'where-i-left-off-shell-${version}'`).replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(paths)};`))
console.log(`Offline shell prepared: ${paths.length} files`)
