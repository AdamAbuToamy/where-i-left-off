import {existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const config='push-worker/wrangler.local.json',cli=resolve('push-worker/node_modules/wrangler/bin/wrangler.js');
try{
 if(!existsSync(config)||!existsSync(cli))throw new Error('شغّل npm ci --prefix push-worker على جهاز إعداد Cloudflare السابق.');
 const value=JSON.parse(readFileSync(config,'utf8'));
 const database=value.d1_databases?.find(binding=>binding.binding==='DB')?.database_name;
 if(typeof database!=='string'||!database)throw new Error('لم أجد قاعدة التذكيرات DB في إعداد Worker الحالي. لم نغيّر الإعداد.');
 copyFileSync(config,config+'.backup-'+Date.now());
 // Bind the free-capable model to the existing Worker. No billing or plan change APIs are called.
 value.ai={binding:'AI'};value.vars={...value.vars,ASSISTANT_FREE_ONLY:'true'};
 writeFileSync(config,JSON.stringify(value,null,2)+'\n');
 const run=args=>execFileSync(process.execPath,[cli,...args,'--config',config],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 run(['d1','execute',database,'--remote','--command',readFileSync('push-worker/assistant-schema.sql','utf8'),'--yes']);run(['deploy']);
 console.log('تم نشر المساعد بحصة محدودة. أبق حساب Workers على Free؛ السكربت لا يغير الخطة أو يضيف وسيلة دفع.');
}catch(e){console.error(e.message);process.exitCode=1;}
