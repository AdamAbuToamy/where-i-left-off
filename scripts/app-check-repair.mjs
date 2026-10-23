/** Pure configuration plan. No credentials, security-mode changes or billing operations. */
export function chooseAttestation({enterprise,v3,localSiteKey}){
 if(enterprise?.siteKey)return {provider:'recaptcha-enterprise',siteKey:enterprise.siteKey,register:false};
 if(v3?.siteSecretSet&&localSiteKey)return {provider:'recaptcha-v3',siteKey:localSiteKey,register:false};
 if(localSiteKey)return {provider:'recaptcha-enterprise',siteKey:localSiteKey,register:true};
 throw new Error('missing-site-key');
}
export function domainRepair(key,hosts){
 if(!key?.webSettings||key.webSettings.integrationType!=='SCORE')throw new Error('not-a-score-web-key');
 const current=key.webSettings.allowedDomains||[];
 if(key.webSettings.allowAllDomains)return null;
 const missing=hosts.filter(host=>!current.some(domain=>host===domain||host.endsWith('.'+domain)));
 return missing.length?{name:key.name,webSettings:{allowedDomains:[...current,...missing]}}:null;
}
