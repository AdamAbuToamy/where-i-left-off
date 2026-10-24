import {it,expect} from 'vitest';
import {generateKeyPairSync} from 'node:crypto';import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),pem=privateKey.export({type:'pkcs8',format:'pem'});
for(const mode of ['read','fix','denied','wrong-origin'])it(`Auth origin deployment audit is scoped and secret-safe: ${mode}`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'wilo-auth-origin-'));mkdirSync(join(dir,'scripts'));
 try{
  for(const f of ['repair-auth-origin.mjs','api-protection-policy.mjs'])copyFileSync('scripts/'+f,join(dir,'scripts',f));
  const preload=join(dir,'preload.mjs');writeFileSync(preload,`import {writeFileSync} from 'node:fs';let next;const original={apiTargets:[{service:'identitytoolkit.googleapis.com',methods:['ExistingMethod']}],browserKeyRestrictions:{allowedReferrers:['https://where-i-left-off.web.app/*']}};
  globalThis.fetch=async(url,options={})=>{
   if(url==='https://where-i-left-off.web.app/__/firebase/init.json')return Response.json({projectId:'where-i-left-off-b5683',appId:'1:166135877928:web:test',authDomain:'${mode==='wrong-origin'?'attacker.example':'where-i-left-off-b5683.firebaseapp.com'}',apiKey:'public-test-key'});
   if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'test-secret-access-token'});
   if(!url.startsWith('https://apikeys.googleapis.com/'))throw new Error('forbidden-host');
   if(${mode==='denied'})return Response.json({error:'private upstream body'},{status:403});
   if(url.includes('lookupKey'))return Response.json({name:'projects/166135877928/locations/global/keys/test'});
   if(options.method==='PATCH'){const body=JSON.parse(options.body);if(JSON.stringify(body.restrictions.apiTargets)!==JSON.stringify(original.apiTargets))throw new Error('api-limits-modified');next=body.restrictions;writeFileSync('patch.json',JSON.stringify(body));return Response.json({name:'operations/akmf.test-operation'});}
   if(url.includes('/operations/'))return Response.json({done:true});return Response.json({etag:'version-one',restrictions:next||original});
  };`);
  const result=spawnSync(process.execPath,['--import',preload,join(dir,'scripts/repair-auth-origin.mjs'),...(mode==='fix'?['--fix']:[])],{cwd:dir,encoding:'utf8',env:{...process.env,FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'where-i-left-off-b5683',client_email:'test@where-i-left-off-b5683.iam.gserviceaccount.com',private_key:pem})}});
  const report=JSON.parse(readFileSync(join(dir,'auth-origin-report.json'),'utf8'));expect(result.status).toBe(['denied','wrong-origin'].includes(mode)?1:0);
  expect(result.stdout+result.stderr+JSON.stringify(report)).not.toMatch(/PRIVATE KEY|test-secret-access-token|private upstream body|public-test-key/);
  if(mode==='fix'){expect(report.checks[0].repaired).toBe(true);const patch=JSON.parse(readFileSync(join(dir,'patch.json'),'utf8'));expect(patch.restrictions.browserKeyRestrictions.allowedReferrers).toEqual(['https://where-i-left-off.web.app/*','https://where-i-left-off-b5683.firebaseapp.com','https://where-i-left-off-b5683.firebaseapp.com/*']);}
  if(mode==='read')expect(report.status).toBe('needs-repair');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
