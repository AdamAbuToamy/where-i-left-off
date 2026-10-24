import {it,expect,vi} from 'vitest';
// @ts-expect-error Public Node module shared by CLI diagnostics.
import {probeFirebaseAuth} from '../scripts/lib/firebase-auth-probe.mjs';
const sdk={projectId:'where-i-left-off-b5683',appId:'1:166135877928:web:test',authDomain:'where-i-left-off-b5683.firebaseapp.com',apiKey:'AIza'+'t'.repeat(35)};
const ok=()=>Response.json({projectId:'166135877928',authorizedDomains:['where-i-left-off.web.app',sdk.authDomain]});
it('proves the Auth handler origin is blocked even when normal site requests succeed, without IAM credentials',async()=>{
 const request=vi.fn(async(_url:string,options:{headers:{Referer:string}})=>options.headers.Referer.includes('-b5683.')?Response.json({error:{details:[{reason:'API_KEY_HTTP_REFERRER_BLOCKED',message:sdk.apiKey}]}},{status:403}):ok());
 const result=await probeFirebaseAuth(sdk,{fetch:request});expect(result.status).toBe('auth-origin-blocked');expect(result.checks.map((c:{status:number})=>c.status)).toEqual([200,403]);expect(JSON.stringify(result)).not.toContain(sdk.apiKey);expect(result.oauthSignInVerified).toBe(false);
 for(const [url,options] of request.mock.calls){expect(url).toContain('https://identitytoolkit.googleapis.com/v1/projects?key=');expect(Object.keys(options.headers)).toEqual(['Referer']);}
});
it('never confuses authorized domains with an API referrer restriction or proof of OAuth completion',async()=>{
 const result=await probeFirebaseAuth(sdk,{fetch:async()=>ok()});expect(result.status).toBe('public-auth-checks-passed');expect(result.emailLinkVerified).toBe(false);
 const missing=await probeFirebaseAuth(sdk,{fetch:async()=>Response.json({projectId:'166135877928',authorizedDomains:[]})});expect(missing.status).toBe('needs-review');expect(missing.checks[0].missingAuthorizedDomains).toHaveLength(2);
});
it('refuses cross-project or arbitrary domains before making a request',async()=>{
 const request=vi.fn();for(const changed of [{projectId:'another-project'},{authDomain:'attacker.example'},{appId:'1:999:web:bad'},{apiKey:'private-key'}])await expect(probeFirebaseAuth({...sdk,...changed},{fetch:request})).rejects.toThrow();expect(request).not.toHaveBeenCalled();
});
it('keeps upstream text and network details out of the safe report',async()=>{
 const result=await probeFirebaseAuth(sdk,{fetch:async()=>{throw new Error('private upstream data')}});expect(result.status).toBe('needs-review');expect(JSON.stringify(result)).not.toContain('private upstream data');
});
