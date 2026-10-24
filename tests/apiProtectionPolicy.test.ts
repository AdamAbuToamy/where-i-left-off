import {expect,it} from 'vitest';
// @ts-expect-error This CLI policy is a Node ESM module.
import {inspectRestrictions,repairRestrictions,REQUIRED_SERVICES,firebaseOrigins,repairAuthOrigin} from '../scripts/api-protection-policy.mjs';
it('detects App Check blocked by an Authentication-only API allowlist and preserves existing API targets',()=>{
 const r={apiTargets:[{service:'identitytoolkit.googleapis.com'}],browserKeyRestrictions:{allowedReferrers:['https://example.edu/*']}};
 const p=repairRestrictions(r);
 expect(p.report.missingServices).toContain('firebaseappcheck.googleapis.com');
 expect(p.restrictions.apiTargets).toContainEqual(r.apiTargets[0]);
 expect(p.restrictions.browserKeyRestrictions.allowedReferrers).toEqual(['https://example.edu/*','https://where-i-left-off.web.app','https://where-i-left-off.web.app/*','https://where-i-left-off.firebaseapp.com','https://where-i-left-off.firebaseapp.com/*']);
 expect(p.restrictions.apiTargets.some((x:{service:string})=>x.service==='generativelanguage.googleapis.com')).toBe(false);
 expect(r.apiTargets).toHaveLength(1);
 expect(repairRestrictions(p.restrictions).changed).toBe(false);
});
it('preserves method restrictions and refuses to convert server or mobile keys into browser keys',()=>{
 expect(()=>repairRestrictions({apiTargets:[{service:'firebaseappcheck.googleapis.com',methods:['OnlyOne']}]})).toThrow('manual-restriction-review-required');
 for(const type of ['serverKeyRestrictions','androidKeyRestrictions','iosKeyRestrictions'])expect(()=>repairRestrictions({[type]:{}})).toThrow();
});
it('does not introduce unrestricted API access and correctly matches domain boundaries',()=>{
 expect(repairRestrictions({}).changed).toBe(false);
 const r={apiTargets:REQUIRED_SERVICES.map((service:string)=>({service})),browserKeyRestrictions:{allowedReferrers:['https://*.web.app/*','https://where-i-left-off.web.app','https://where-i-left-off.firebaseapp.com','https://where-i-left-off.firebaseapp.com/*']}};
 expect(inspectRestrictions(r).missingOrigins).toEqual([]);
 expect(inspectRestrictions({browserKeyRestrictions:{allowedReferrers:['https://where-i-left-off.web.app.attacker.test/*']}}).missingOrigins).toContain('https://where-i-left-off.web.app');
});

it('repairs an omitted or empty Google allowedReferrers field without losing API restrictions',()=>{
 for(const browserKeyRestrictions of [{},{allowedReferrers:[]}]){
  const input={apiTargets:REQUIRED_SERVICES.map((service:string)=>({service})),browserKeyRestrictions};
  const plan=repairRestrictions(input);
  expect(plan.report.missingServices).toEqual([]);
  expect(plan.restrictions.browserKeyRestrictions.allowedReferrers).toEqual(['https://where-i-left-off.web.app','https://where-i-left-off.web.app/*','https://where-i-left-off.firebaseapp.com','https://where-i-left-off.firebaseapp.com/*']);
  expect(plan.restrictions.apiTargets).toEqual(input.apiTargets);
  expect(repairRestrictions(plan.restrictions).changed).toBe(false);
 }
});

it('checks the actual same-project Firebase Auth handler origin as well as the branded hosting sites',()=>{
 const origins=firebaseOrigins('where-i-left-off-b5683.firebaseapp.com');
 const input={apiTargets:REQUIRED_SERVICES.map((service:string)=>({service})),browserKeyRestrictions:{allowedReferrers:['https://where-i-left-off.web.app','https://where-i-left-off.web.app/*','https://where-i-left-off.firebaseapp.com','https://where-i-left-off.firebaseapp.com/*']}};
 expect(inspectRestrictions(input,origins).missingOrigins).toEqual(['https://where-i-left-off-b5683.firebaseapp.com']);
 const fixed=repairRestrictions(input,origins);expect(fixed.restrictions.apiTargets).toEqual(input.apiTargets);expect(inspectRestrictions(fixed.restrictions,origins).missingOrigins).toEqual([]);
 expect(fixed.restrictions.browserKeyRestrictions.allowedReferrers).not.toContain('*');expect(()=>firebaseOrigins('attacker.example')).toThrow('unrecognized-auth-domain');
});

it('Auth-only repair keeps every API method limit and adds only the known Firebase handler origin',()=>{
 const input={apiTargets:[{service:'identitytoolkit.googleapis.com',methods:['Accounts.SignInWithIdp']}],browserKeyRestrictions:{allowedReferrers:['https://where-i-left-off.web.app/*']}};
 const fixed=repairAuthOrigin(input,'where-i-left-off-b5683.firebaseapp.com');expect(fixed.changed).toBe(true);expect(fixed.restrictions.apiTargets).toEqual(input.apiTargets);
 expect(fixed.restrictions.browserKeyRestrictions.allowedReferrers).toEqual(['https://where-i-left-off.web.app/*','https://where-i-left-off-b5683.firebaseapp.com','https://where-i-left-off-b5683.firebaseapp.com/*']);
 expect(repairAuthOrigin(fixed.restrictions,'where-i-left-off-b5683.firebaseapp.com').changed).toBe(false);expect(repairAuthOrigin({},'where-i-left-off-b5683.firebaseapp.com').changed).toBe(false);
});
