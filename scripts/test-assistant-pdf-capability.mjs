import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createServer} from 'vite';import {sourceFingerprint} from './lib/localReleaseGate.mjs';import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
const key=JSON.parse(readFileSync('.wrangler/polli-native-suite.private.json','utf8')).key;globalThis.sessionStorage={getItem:n=>n==='wilo-pollinations:pdf-test'?key:null};
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'});
try{
 const {PollinationsAssistant}=await vite.ssrLoadModule('/src/assistant/pollinationsClient.ts'),{assistantContext}=await vite.ssrLoadModule('/src/assistant/assistantRepository.ts'),{blankAssistantData,parseAssistantReply}=await vite.ssrLoadModule('/src/assistant/actions.ts'),{buildAssistantPdf}=await vite.ssrLoadModule('/src/assistant/pdfExport.ts');
 const data=blankAssistantData(),names=['Mathematics','Physics','Computer Science'];data.study.courses=names.map((name,i)=>({id:'synthetic-course-'+i,name,notes:'Weekly exercises and lecture revision. Exam: 2026-10-28.',url:'',x:0,y:0,requires:[],source:{description:'private long imported text '.repeat(6000),shortName:'C'+i,teachers:[],sections:[],status:'available',warnings:[]}}));
 const context=assistantContext({data,raw:new Map(),pending:false}),client=new PollinationsAssistant('pdf-test'),results=[];
 for(const [language,message]of [['en','give me pdf of all my courses'],['ar','اعطني ملخص الكورسات في ملف PDF']]){
  const route=await client.conversation({message,language,history:[]});if(!route.needsWorkspace)throw new Error('pdf-routed-as-unsupported');
  const result=await client.workspace({message,language,context,history:[],requirements:route.requirements}),reply=parseAssistantReply(result.text),file=reply.files.find(f=>/\.pdf$/i.test(f.name));
  if(!file||reply.actions.length||reply.controls?.length||!names.every(name=>file.content.includes(name)))throw new Error('incomplete-pdf-proposal:'+JSON.stringify(reply));
  const bytes=await buildAssistantPdf(file.content,{name:file.name,language},(w,h)=>createCanvas(w,h));if(Buffer.from(bytes).subarray(0,5).toString()!=='%PDF-')throw new Error('not-real-pdf');
  mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/assistant-live-'+language+'.pdf',Buffer.from(bytes));results.push({language,message,fileName:file.name,content:file.content,pdfBytes:bytes.byteLength});
 }
 const report={status:'passed',fingerprint:sourceFingerprint(),localContextChars:context.length,results,productionWrites:0,persistenceTested:false};
 writeFileSync('assistant-pdf-capability-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await vite.close();}
