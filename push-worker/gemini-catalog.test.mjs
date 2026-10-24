import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {GEMINI_MODEL} from './src/assistantProvider.mjs';
for(const mode of ['present','missing','blocked','pagination'])test('metadata-only Gemini catalog probe: '+mode,()=>{
 const folder=mkdtempSync(join(tmpdir(),'wilo-catalog-'));try{
  const preload=join(folder,'mock.mjs');writeFileSync(preload,`let calls=0;globalThis.fetch=async(url,options)=>{calls++;if(new URL(url).pathname!=='/v1beta/models'||new URL(url).searchParams.has('key')||options.headers['x-goog-api-key']!=='test-only-secret')throw new Error('unexpected-request');if('${mode}'==='blocked')return Response.json({error:{message:'test-only-secret unauthorized'}},{status:403});if('${mode}'==='pagination'&&calls===1)return Response.json({models:[],nextPageToken:'next'});return Response.json({models:[{name:'models/${mode==='missing'?'gemini-other':GEMINI_MODEL}',supportedGenerationMethods:['generateContent']},{name:'tunedModels/private-user-model',supportedGenerationMethods:['generateContent']}]});};`);
  const result=spawnSync(process.execPath,['--import',preload,fileURLToPath(new URL('../scripts/check-gemini-catalog.mjs',import.meta.url))],{cwd:folder,encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'test-only-secret'},timeout:10000});
  assert.equal(result.status,['present','pagination'].includes(mode)?0:2,result.stderr);const report=JSON.parse(readFileSync(join(folder,'gemini-catalog-report.json'),'utf8'));assert.equal(report.inferenceRequests,0);assert.equal((result.stdout+result.stderr).includes('test-only-secret'),false);assert.equal(result.stdout.includes('private-user-model'),false);
  if(mode==='missing')assert.equal(report.configuredModelPresent,false);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
