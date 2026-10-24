// Only Firebase services actually used by this site's Authentication, Firestore and App Check.
export const REQUIRED_SERVICES = ['firebase.googleapis.com','logging.googleapis.com','firebaseappcheck.googleapis.com','identitytoolkit.googleapis.com','securetoken.googleapis.com','datastore.googleapis.com','firestore.googleapis.com'];
export const PRODUCTION_ORIGINS = ['https://where-i-left-off.web.app','https://where-i-left-off.firebaseapp.com'];
export function firebaseOrigins(authDomain,projectId='where-i-left-off-b5683'){
 if(![projectId+'.firebaseapp.com',...PRODUCTION_ORIGINS.map(v=>new URL(v).hostname)].includes(authDomain))throw new Error('unrecognized-auth-domain');
 return [...new Set([...PRODUCTION_ORIGINS,'https://'+authDomain])];
}
function matches(pattern, value) {
 if(typeof pattern!=='string'||pattern.length>2000)return false;
 const regex=pattern.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
 return new RegExp('^'+regex+'$').test(value);
}
export function inspectRestrictions(restrictions={},origins=PRODUCTION_ORIGINS) {
 const targets=restrictions.apiTargets||[];
 const missingServices=targets.length?REQUIRED_SERVICES.filter(service=>!targets.some(t=>t.service===service)):[];
 const methodRestricted=targets.filter(t=>REQUIRED_SERVICES.includes(t.service)&&t.methods?.length).map(t=>t.service);
 const browser=restrictions.browserKeyRestrictions;
 const incompatibleApplication=Boolean(restrictions.serverKeyRestrictions||restrictions.androidKeyRestrictions||restrictions.iosKeyRestrictions);
 const missingOrigins=browser?origins.filter(origin=>!['','/','/index.html','/__/auth/handler'].every(path=>(browser.allowedReferrers||[]).some(pattern=>matches(pattern,origin+path)))):[];
 return {apiRestricted:targets.length>0,applicationRestricted:Boolean(browser)||incompatibleApplication,missingServices,methodRestricted,missingOrigins,incompatibleApplication,unrelatedGenerativeApiAllowed:!targets.length||targets.some(t=>t.service==='generativelanguage.googleapis.com')};
}
export function repairRestrictions(restrictions={},origins=PRODUCTION_ORIGINS) {
 const report=inspectRestrictions(restrictions,origins);
 // Do not convert mobile/server keys, discard method limits or silently broaden unrestricted keys.
 if(report.incompatibleApplication||report.methodRestricted.length)throw new Error('manual-restriction-review-required');
 const next=structuredClone(restrictions);
 if(report.missingServices.length)next.apiTargets=[...(next.apiTargets||[]),...report.missingServices.map(service=>({service}))];
 if(report.missingOrigins.length)next.browserKeyRestrictions.allowedReferrers=[...(next.browserKeyRestrictions.allowedReferrers||[]),...report.missingOrigins.flatMap(origin=>[origin,origin+'/*'])];
 return {report,changed:Boolean(report.missingServices.length||report.missingOrigins.length),restrictions:next};
}
/** Fix only the same-project Auth origin; leave API/method restrictions intact. */
export function repairAuthOrigin(restrictions={},authDomain){
 const origins=firebaseOrigins(authDomain),origin='https://'+authDomain,report=inspectRestrictions(restrictions,[origin]);
 if(report.incompatibleApplication)throw new Error('manual-restriction-review-required');
 const next=structuredClone(restrictions);
 if(!next.browserKeyRestrictions||!report.missingOrigins.length)return {changed:false,restrictions:next,origins};
 next.browserKeyRestrictions.allowedReferrers=[...(next.browserKeyRestrictions.allowedReferrers||[]),origin,origin+'/*'];
 return {changed:true,restrictions:next,origins};
}
