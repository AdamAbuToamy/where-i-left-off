import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASSISTANT_PROTOCOL as protocol} from '../shared/assistantProtocol.mjs';
export function validateAssistantEndpoint(endpoint){
 const url=new URL(endpoint);if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.pathname!=='/assistant'||url.search||url.hash||url.username||url.password||url.port)throw new Error('عنوان خادم المساعد غير صالح.');return url;
}
export async function checkAssistantDeployment(endpoint,origin='https://where-i-left-off.web.app'){
 const url=validateAssistantEndpoint(endpoint);
 const response=await fetch(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-firebase-appcheck'},signal:AbortSignal.timeout(15000)});
 if(response.status!==204||response.headers.get('access-control-allow-origin')!==origin)throw new Error(`فشل فحص اتصال المساعد/CORS: HTTP ${response.status}. لم يكتمل تحقق النشر.`);
 const permitted=(response.headers.get('access-control-allow-headers')||'').toLowerCase().split(',').map(v=>v.trim());
 if(!['authorization','content-type','x-firebase-appcheck'].every(v=>permitted.includes(v))||!(response.headers.get('access-control-allow-methods')||'').toUpperCase().split(',').map(v=>v.trim()).includes('POST'))throw new Error('إعداد CORS لا يسمح برموز الدخول والتحقق المطلوبة للمساعد.');
 if(response.headers.get('x-wilo-assistant-version')!==protocol)throw new Error('خادم المساعد المنشور ليس بالإصدار المطلوب. انشر Worker قبل نشر الواجهة.');
 return {protocol,cors:true,inferenceTested:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
 try{const {endpoint}=JSON.parse(readFileSync('public/assistant-config.json','utf8'));console.log(JSON.stringify(await checkAssistantDeployment(endpoint)));console.log('فحص إصدار Worker وCORS نجح دون طلب AI. يلزم فحص الحساب والحفظ داخل الموقع.');}catch(error){console.error(error.message);process.exitCode=1;}
}
