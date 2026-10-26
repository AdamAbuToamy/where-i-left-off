import {readFileSync,writeFileSync} from 'node:fs';import {createServer} from 'vite';import {sourceFingerprint} from './lib/localReleaseGate.mjs';
const key=JSON.parse(readFileSync('.wrangler/polli-native-suite.private.json','utf8')).key;
globalThis.sessionStorage={getItem:n=>n==='wilo-pollinations:large-summary-test'?key:null};
const nativeFetch=globalThis.fetch;let payloadSizes=[];
globalThis.fetch=(url,options)=>{if(String(url).includes('/chat/completions')){payloadSizes.push(options.body.length);if(options.body.includes('PRIVATE_RAW_BODY_SENTINEL'))throw new Error('raw-source-leaked');}return nativeFetch(url,options);};
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'});
try{
 const {PollinationsAssistant}=await vite.ssrLoadModule('/src/assistant/pollinationsClient.ts'),{assistantContext}=await vite.ssrLoadModule('/src/assistant/assistantRepository.ts'),{blankAssistantData}=await vite.ssrLoadModule('/src/assistant/actions.ts');
 const data=blankAssistantData(),names=['الرياضيات','الفيزياء','الكيمياء','البرمجة','الخوارزميات','قواعد البيانات','الإحصاء','الشبكات','المنطق','الجبر','أنظمة التشغيل','هندسة البرمجيات'];
 data.study.courses=names.map((name,i)=>({id:'synthetic-course-'+i,name,notes:'كورس '+name+'؛ المطلوب مراجعة المحاضرات وحل التمارين أسبوعياً.',url:'',x:0,y:0,requires:[],source:{description:'PRIVATE_RAW_BODY_SENTINEL '.repeat(5000),shortName:'C'+i,teachers:[],sections:[],status:'available',warnings:[]}}));
 const context=assistantContext({data,raw:new Map(),pending:false}),client=new PollinationsAssistant('large-summary-test'),message='لخص لي الكورسات اللي عندي',started=Date.now();
 const route=await client.conversation({message,language:'ar',history:[]});
 if(!route.needsWorkspace)throw new Error('summary-did-not-request-account');
 const result=await client.workspace({message,language:'ar',context,history:[],requirements:route.requirements}),proposal=JSON.parse(result.text);
 if(proposal.actions.length||proposal.controls.length||!names.every(name=>proposal.text.includes(name)))throw new Error('incomplete-course-summary:'+JSON.stringify(proposal));
 const report={status:'passed',fingerprint:sourceFingerprint(),message,syntheticCourses:names.length,localContextChars:context.length,providerPayloadChars:payloadSizes,elapsedMs:Date.now()-started,reply:proposal.text,productionWrites:0,persistenceTested:false};
 writeFileSync('assistant-large-context-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await vite.close();}
