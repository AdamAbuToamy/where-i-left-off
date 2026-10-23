import {it,expect} from 'vitest';
// @ts-expect-error The executable repair module is deliberately dependency-free JavaScript.
import {chooseAttestation,domainRepair} from '../scripts/app-check-repair.mjs';
it('matches the browser to the registered provider, instead of guessing Enterprise',()=>{
 expect(chooseAttestation({enterprise:{siteKey:'registered-key'},v3:null,localSiteKey:'wrong-local-key'})).toEqual({provider:'recaptcha-enterprise',siteKey:'registered-key',register:false});
 expect(chooseAttestation({enterprise:null,v3:{siteSecretSet:true},localSiteKey:'existing-v3-key'})).toEqual({provider:'recaptcha-v3',siteKey:'existing-v3-key',register:false});
 expect(()=>chooseAttestation({enterprise:null,v3:null,localSiteKey:''})).toThrow('missing-site-key');
});
it('adds only missing production domains, preserves existing domains, rejects wrong key types',()=>{
 const key={name:'projects/p/keys/k',webSettings:{integrationType:'SCORE',allowedDomains:['example.test']}};
 expect(domainRepair(key,['where-i-left-off.web.app'])).toEqual({name:key.name,webSettings:{allowedDomains:['example.test','where-i-left-off.web.app']}});
 expect(domainRepair({...key,webSettings:{...key.webSettings,allowedDomains:['web.app']}},['where-i-left-off.web.app'])).toBeNull();
 expect(()=>domainRepair({webSettings:{integrationType:'CHECKBOX'}},['where-i-left-off.web.app'])).toThrow('not-a-score-web-key');
 expect(key.webSettings.allowedDomains).toEqual(['example.test']);
});
