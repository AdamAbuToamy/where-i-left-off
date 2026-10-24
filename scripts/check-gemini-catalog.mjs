import {writeFileSync} from 'node:fs';
import {GEMINI_MODEL} from '../push-worker/src/assistantProvider.mjs';
import {syntheticProviderDiagnostic} from './lib/providerDiagnostic.mjs';
const key=process.env.GEMINI_API_KEY?.trim(),report={provider:'gemini',configuredModel:GEMINI_MODEL,inferenceRequests:0};
try{
 if(!key)throw new Error('gemini-key-required');
 const names=[];let token='';
 for(let page=0;page<3;page++){
  const query=new URLSearchParams({pageSize:'1000',...(token?{pageToken:token}:{})});
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?'+query,{headers:{'x-goog-api-key':key},redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(!r.ok){report.error=syntheticProviderDiagnostic({status:r.status,body:await r.text()},key);throw new Error('gemini-catalog-http-error');}
  const body=await r.json();
  names.push(...(body.models||[]).filter(m=>/^models\/gemini-[a-zA-Z0-9.-]+$/.test(m.name)&&m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.slice(7)));
  token=body.nextPageToken||'';if(!token)break;
 }
 const available=[...new Set(names)],present=available.includes(GEMINI_MODEL);
 Object.assign(report,{status:present&&!token?'catalog-checked':'configured-model-unavailable',configuredModelPresent:present,catalogComplete:!token,availableGenerateContentModels:available});
 if(!present||token)process.exitCode=2;
}catch(error){report.status='blocked';report.reason=['gemini-key-required','gemini-catalog-http-error'].includes(error.message)?error.message:'gemini-catalog-unavailable';process.exitCode=2;}
console.log(JSON.stringify(report));writeFileSync('gemini-catalog-report.json',JSON.stringify(report,null,2)+'\n');
