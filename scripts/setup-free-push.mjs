import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createInterface} from 'node:readline/promises'
import {generateKeyPairSync} from 'node:crypto'
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'))
const ask=createInterface({input:process.stdin,output:process.stdout})
const cli=resolve('push-worker/node_modules/wrangler/bin/wrangler.js'),configPath='push-worker/wrangler.local.json'
function command(args,options={}){return execFileSync(process.execPath,[cli,...args],{encoding:'utf8',...options})}
function publicValue(key){
 for(const file of ['.env.local','.env'])if(existsSync(file)){
  const match=readFileSync(file,'utf8').match(new RegExp(`^${key}\\s*=\\s*(.+)$`,'m'))
  if(match)return match[1].trim().replace(/^['"]|['"]$/g,'')
 }
 return ''
}
try {
 console.log('إعداد Cloudflare Workers Free فقط. السكربت لا يطلب ترقية خطة أو بطاقة دفع.')
 console.log('الأسرار تُرفع مباشرة من جهازك إلى Cloudflare، ولا تُطبع. لا ترسل ملف المفتاح في المحادثة.')
 if(!existsSync(cli))throw new Error('شغّل npm ci --prefix push-worker أولًا')
 const accountId=(process.env.CLOUDFLARE_ACCOUNT_ID || await ask.question('Account ID من لوحة Cloudflare (32 حرفًا/رقمًا): ')).trim()
 if(!/^[a-f0-9]{32}$/.test(accountId))throw new Error('Account ID غير صالح')
 const readerFile=(await ask.question('المسار المحلي لملف Firebase reader JSON بصلاحيات القراءة فقط: ')).trim().replace(/^['"]|['"]$/g,'')
 const reader=JSON.parse(readFileSync(resolve(readerFile),'utf8'))
 if(reader.type!=='service_account'||reader.project_id!=='where-i-left-off-b5683'||!reader.private_key||!reader.client_email)throw new Error('ملف حساب الخدمة لا يطابق مشروعك')
 const appId=publicValue('VITE_FIREBASE_APP_ID') || (await ask.question('Firebase Web App ID: ')).trim()
 if(!/^\d+:\d+:web:[\w-]+$/.test(appId))throw new Error('Firebase App ID غير صالح')
 const runEnv={...process.env,CLOUDFLARE_ACCOUNT_ID:accountId,WRANGLER_SEND_METRICS:'false'}
 command(['login'],{stdio:'inherit',env:runEnv})
 const config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):JSON.parse(readFileSync('push-worker/wrangler.jsonc','utf8'))
 config.account_id=accountId;config.vars.FIREBASE_APP_ID=appId
 const privatePath='push-worker/.push-private.json'
 let keys
 if(existsSync(privatePath))keys=JSON.parse(readFileSync(privatePath,'utf8'))
 else {
  if(existsSync(configPath))throw new Error('ملف المفتاح المحلي مفقود. لا تولد مفتاحًا جديدًا لخدمة قائمة؛ استعد نسخة المفتاح أولًا.')
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.privateKey.export({format:'jwk'})
  keys={privateKey:jwk.d,publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url')}
  writeFileSync(privatePath,JSON.stringify(keys),{mode:0o600})
 }
 config.vars.VAPID_PUBLIC_KEY=keys.publicKey
 if(config.d1_databases[0].database_id==='SET_BY_SETUP_SCRIPT'){
  const output=command(['d1','list','--json'],{env:runEnv})
  const list=JSON.parse(output),existing=list.find(d=>d.name==='wilo-push')
  if(existing)config.d1_databases[0].database_id=existing.uuid
  else {
   const output=command(['d1','create','wilo-push','--update-config=false'],{env:runEnv})
   const uuid=output.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/)?.[0]
   if(!uuid)throw new Error('تعذر تحديد معرّف D1. افتح لوحة Cloudflare وتحقق من wilo-push.')
   config.d1_databases[0].database_id=uuid
  }
 }
 writeFileSync(configPath,JSON.stringify(config,null,2)+'\n',{mode:0o600})
 const queue=execFileSync(process.execPath,[cli,'queues','list'],{encoding:'utf8',env:runEnv})
 if(!/(?:^|[\s│|])wilo-push(?:$|[\s│|])/.test(queue))command(['queues','create','wilo-push'],{stdio:'inherit',env:runEnv})
 command(['d1','execute','wilo-push','--remote','--file','push-worker/schema.sql','--config',configPath,'--yes'],{stdio:'inherit',env:runEnv})
 command(['deploy','--config',configPath],{stdio:'inherit',env:runEnv})
 command(['secret','bulk','--config',configPath],{input:JSON.stringify({FIREBASE_READER:JSON.stringify(reader),VAPID_PRIVATE_KEY:keys.privateKey}),stdio:['pipe','inherit','inherit'],env:runEnv})
 const endpoint=(await ask.question('انسخ رابط Worker الظاهر أعلاه (https://...workers.dev): ')).trim()
 const url=new URL(endpoint)
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||url.search||url.hash)throw new Error('الرابط ليس عنوان workers.dev صالحًا')
 writeFileSync('public/push-config.json',JSON.stringify({endpoint:url.href})+'\n')
 console.log('تم إعداد الخدمة وربط الرابط. لنشر الموقع الآن: VITE_TEST_OFFLINE=false bash scripts/deploy-production.sh')
 console.log('احتفظ بنسخة آمنة من push-worker/.push-private.json. لا تضفه إلى Git ولا تغيّر المفتاح عند إعادة النشر.')
} finally {ask.close()}
