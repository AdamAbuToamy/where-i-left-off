import {assistantProvider} from '../../../push-worker/src/assistantProvider.mjs';
import {acceptanceCases} from './corpus.mjs';
import {runAcceptanceCase} from './runCase.mjs';
/** Local-only synthetic harness; authorization cannot come from a browser origin. */
export default {async fetch(request,env){
 if(request.headers.has('origin')||request.headers.get('authorization')!==`Bearer ${env.TEST_TOKEN}`)return new Response('',{status:403});
 if(request.method!=='POST')return new Response('',{status:405});
 const {id}=await request.json(),testCase=acceptanceCases.find(c=>c.id===id);
 if(!testCase)return Response.json({error:'unknown-case'},{status:400});
 return Response.json(await runAcceptanceCase(testCase,assistantProvider(env)));
}};
