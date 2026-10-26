import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';
import {acceptanceCases,acceptanceContext} from '../tests/fixtures/assistant/corpus.mjs';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {sourceFingerprint} from './lib/localReleaseGate.mjs';
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
const candidates={qwen17:'Qwen3-1.7B-q4f16_1-MLC',qwen25_15:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',qwen25_3:'Qwen2.5-3B-Instruct-q4f16_1-MLC',qwen4:'Qwen3-4B-q4f16_1-MLC',qwen8:'Qwen3-8B-q4f16_1-MLC'};
const server=httpServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__model'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/tests/browser-local/driver.ts"></script>');return;}
 if(url.pathname.startsWith('/__candidate/')){
  const id=url.pathname.split('/').at(-1),model=candidates[id];if(!model){res.writeHead(404);res.end();return;}
  const base='https://huggingface.co/mlc-ai/'+model+'/resolve/main/';
  const config=await (await fetch(base+'mlc-chat-config.json')).json();
  const meta=await (await fetch(base+'ndarray-cache.json')).json();
  const release={...LOCAL_RELEASE,model,version:'probe-'+id,weightBytes:meta.records.reduce((n,r)=>n+r.nbytes,0)};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({release,config}));return;
 }
 if(url.pathname==='/__cases'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({fingerprint:sourceFingerprint(),cases:acceptanceCases.map(c=>({id:c.id,message:c.message,language:c.language,context:JSON.stringify(acceptanceContext(c.id))}))}));return;}
 if(url.pathname==='/__evaluate'){
  let body='';for await(const chunk of req)body+=chunk;
  const {id,reply}=JSON.parse(body),c=acceptanceCases.find(c=>c.id===id);let result;
  try{if(!c)throw new Error('unknown-case');evaluateAcceptance(c,reply);result={status:'passed'};}catch(e){result={status:'failed',reason:e.message};}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
});
server.listen(8177,'127.0.0.1',()=>console.log('Synthetic model probe listening on 8177'));