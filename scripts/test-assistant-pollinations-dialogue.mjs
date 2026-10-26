import {readFileSync,writeFileSync} from 'node:fs';import {createServer} from 'vite';import {acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
const key=JSON.parse(readFileSync('.wrangler/polli-native-suite.private.json','utf8')).key;globalThis.sessionStorage={getItem:n=>n==='wilo-pollinations:synthetic-dialogue'?key:null};
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'}),results=[];
try{
 const {PollinationsAssistant}=await vite.ssrLoadModule('/src/assistant/pollinationsClient.ts');const {conversationHistory}=await vite.ssrLoadModule('/src/assistant/conversationHistory.ts');const {validateWorkspaceReply}=await vite.ssrLoadModule('/src/assistant/workspaceValidation.ts');
 const client=new PollinationsAssistant('synthetic-dialogue'),context=acceptanceContext();context.localDate='2026-10-25';context.scopes[0].sections=[{id:'adam-section',name:'ادم'}];
 const history=[];let createdId;
 const run=async(message,verify)=>{const start=Date.now(),h=conversationHistory(history);let output;try{const route=await client.conversation({message,language:'ar',history:h});if(!route.needsWorkspace)throw new Error('route-missed-workspace: '+route.text);
 const result=await client.workspace({message,language:'ar',context:JSON.stringify(context),history:h}),{reply,changes}=validateWorkspaceReply(message,context,result.text);output={reply,changes,history:h};verify(changes,reply);
 // Simulate confirmed writes in the isolated test state; never call Firestore.
 for(const change of changes){const list=change.target==='projects'||change.target==='sections'?context.scopes.find(s=>s.id===change.scope)[change.target]:context.study[change.target];const i=list.findIndex(x=>x.id===change.id);if(i>=0)list.splice(i,1);if(change.after)list.push(change.after);}
 history.push({role:'user',text:message},{role:'assistant',text:'تم تطبيق التغييرات في الموقع.',resolved:true,receipt:{changes}});results.push({message,status:'passed',reply,changes,elapsedMs:Date.now()-start});
 }catch(e){results.push({message,status:'failed',reason:e.message,...(output?{output}:{}),elapsedMs:Date.now()-start});}console.log(JSON.stringify(results.at(-1)));writeFileSync('assistant-acceptance-pollinations-dialogue.json',JSON.stringify({kind:'live-synthetic-dialogue',productionWrites:0,results},null,2));};
 const assert=(ok,why)=>{if(!ok)throw new Error(why);};
 await run('اضف بطاقة باسم عمار',changes=>{assert(changes.length===1&&!changes[0].before&&changes[0].after.name==='عمار','create-card');createdId=changes[0].id;});
 if(createdId){await run('ضعها في قسم ادم وبتاريخ 28 الشهر',changes=>{assert(changes.length===1&&changes[0].id===createdId,'wrong-followup-card');assert(changes[0].after.sectionId==='adam-section'&&changes[0].after.dueDate==='2026-10-28','followup-section-date');});
 await run('ضعها في قسم ادم',(changes,reply)=>{assert(changes.every(c=>c.id===createdId)&&!/[?؟]/.test(reply.text),'wrong-repeat-target');});
 history.push({role:'user',text:'ضعها في قسم ادم'},{role:'assistant',text:'أي بطاقة تقصد؟',resolved:true});
 await run('عمار',(changes,reply)=>{assert(changes.every(c=>c.id===createdId)&&!/[?؟]/.test(reply.text),'lost-reference-after-clarification');});}
}finally{await vite.close();}