import {assistantProvider} from '../../push-worker/src/assistantProvider.mjs';
import {runWorkspaceTools} from '../../push-worker/src/assistantTools.mjs';
import {assistantProviderError,safeProviderFailure} from '../../push-worker/src/assistantErrors.mjs';
/** Live synthetic probe only. No user account data, Firebase writes, or deployment changes. */
export async function checkGeminiModel(key){
 const started=Date.now(),expected={name:'WILO connection test',dueDate:'2026-10-25',description:'connection check'};
 try{
  const provider=assistantProvider({ASSISTANT_PROVIDER:'gemini',GEMINI_API_KEY:key});
  const response=await runWorkspaceTools({language:'en',message:'Propose exactly one personal card named WILO connection test, dueDate 2026-10-25, description connection check. No navigation, other edits or files. This is only a synthetic connection test, do not claim a save.',context:JSON.stringify({localDate:'2026-10-24',timezone:'UTC',study:{courses:[],tasks:[],lessons:[]},scopes:[{id:'personal',name:'Personal',projects:[],sections:[]}]})},[],(input,signal)=>provider.run(input,{signal}));
  const plan=JSON.parse(response),action=plan.actions[0];
  if(plan.actions.length!==1||plan.controls.length||plan.files.length||action.target!=='projects'||action.action!=='create'||action.scope!=='personal'||Object.entries(expected).some(([k,v])=>action.values[k]!==v))throw new Error('ai-incomplete-proposal');
  return {provider:'gemini',model:provider.model,nativeToolProbe:true,fields:['name','dueDate','description'],inferenceMs:Date.now()-started,productionWrites:0};
 }catch(error){throw new Error('Gemini probe failed: '+JSON.stringify({error:assistantProviderError(error),...safeProviderFailure(error)}));}
}
