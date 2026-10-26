import {LocalAssistantModel,localFailureMessage} from '../../src/assistant/localModel';
import type {LocalRequest} from '../../src/assistant/localModel';
import {LOCAL_RELEASE} from '../../shared/localRelease.mjs';
// No test expectations, corpus imports, Firebase identity or production data here.
const candidate=new URLSearchParams(location.search).get('candidate');
const candidateData=candidate?await (await fetch('/__candidate/'+encodeURIComponent(candidate))).json():null;
const release=candidateData?.release||LOCAL_RELEASE;
const model=new LocalAssistantModel(release,candidateData?.config);
const driver={
 release,
 async preflight(){
  const gpu=(navigator as unknown as {gpu?:{requestAdapter:(options?:{powerPreference:string})=>Promise<{features:Set<string>;info?:{vendor?:string;architecture?:string;description?:string};limits?:{maxStorageBufferBindingSize:number}}|null>}}).gpu;
  const adapter=await gpu?.requestAdapter({powerPreference:'high-performance'});
  return {secure:window.isSecureContext,webgpu:!!gpu,adapter:!!adapter,shaderF16:adapter?.features.has('shader-f16')||false,info:adapter?.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description}:null,browser:navigator.userAgent};
 },
 async load(){await model.load(f=>console.info('WILO_MODEL_PROGRESS:'+Math.round(f*100)));return {ready:true,release};},
 async smoke(){return model.smoke();},
 async answer(request:LocalRequest){
  const start=performance.now();
  try{const {text}=await model.answer(request);return {text,elapsedMs:Math.round(performance.now()-start),trace:structuredClone(model.trace)};}
  catch(error){return {error:localFailureMessage(error),elapsedMs:Math.round(performance.now()-start),trace:structuredClone(model.trace)};}
 },
 dispose(){model.dispose();},
};
Object.defineProperty(window,'wiloAcceptance',{value:driver});
