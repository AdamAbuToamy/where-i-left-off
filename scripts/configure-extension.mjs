import { writeFileSync } from 'node:fs'
const [id,...flags]=process.argv.slice(2)
if(!/^[a-p]{32}$/.test(id || '') || flags.some(flag=>flag!=='--published')) {
 console.error('Usage: node scripts/configure-extension.mjs EXTENSION_ID [--published]')
 console.error('Use --published only after the store listing is approved and publicly available.')
 process.exit(1)
}
const published=flags.includes('--published')
writeFileSync(new URL('../public/extension-config.json',import.meta.url),JSON.stringify({extensionId:id,published},null,2)+'\n')
console.log(published?'Store link enabled for the next website deployment.':'Extension ID saved; public installation suggestions remain disabled.')
