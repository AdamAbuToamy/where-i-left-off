import {writeFileSync} from 'node:fs';
import {probeFirebaseAuth} from './lib/firebase-auth-probe.mjs';
let report;
try{
 const r=await fetch('https://where-i-left-off.web.app/__/firebase/init.json',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error();report=await probeFirebaseAuth(await r.json());
 console.log(JSON.stringify(report,null,2));
 if(report.status!=='public-auth-checks-passed')process.exitCode=2;
}catch{report={status:'public-config-unavailable'};console.error(JSON.stringify(report));process.exitCode=1;}
writeFileSync('auth-browser-report.json',JSON.stringify(report,null,2)+'\n');
