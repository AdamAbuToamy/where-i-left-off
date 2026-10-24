import {existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const config='push-worker/wrangler.local.json',cli=resolve('push-worker/node_modules/wrangler/bin/wrangler.js');
try{
 if(!existsSync(config)||!existsSync(cli))throw new Error('شغّل npm ci --prefix push-worker على جهاز إعداد Cloudflare السابق.');
 const value=JSON.parse(readFileSync(config,'utf8'));
 if(!value.name||!value.d1_databases?.some(b=>b.binding==='DB'))throw new Error('إعداد Worker الحالي غير مكتمل.');
 const key=process.env.GROQ_API_KEY?.trim();
 if(!key)throw new Error('ضع مفتاح Groq في متغير GROQ_API_KEY على جهازك فقط. لا ترسله في المحادثة.');
 const env={...process.env,WRANGLER_SEND_METRICS:'false'};delete env.GROQ_API_KEY;
 // Input is piped directly to Wrangler, never passed in command arguments or config.
 execFileSync(process.execPath,[cli,'secret','put','GROQ_API_KEY','--config',config],{input:key+'\n',stdio:['pipe','inherit','inherit'],env});
 copyFileSync(config,config+'.backup-'+Date.now());
 value.vars={...value.vars,ASSISTANT_FREE_ONLY:'true',ASSISTANT_PROVIDER:'groq'};
 writeFileSync(config,JSON.stringify(value,null,2)+'\n');
 execFileSync(process.execPath,[cli,'deploy','--config',config],{stdio:'inherit',env});
 console.log('تم نشر ربط Groq. استخدم حساب Groq المجاني دون تفعيل الدفع. الحصة مشتركة بين مستخدمي الموقع.');
}catch(error){console.error(error.message);process.exitCode=1;}
