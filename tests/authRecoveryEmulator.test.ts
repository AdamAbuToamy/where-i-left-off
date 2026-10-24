import {afterAll,beforeAll,expect,it} from 'vitest';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,sendEmailVerification,applyActionCode,getIdTokenResult,signOut,signInWithEmailAndPassword,GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
import {randomUUID} from 'node:crypto';
import {EmailVerification} from '../src/lib/emailVerification';
const project='demo-where-i-left-off',host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
if(!host||!/^127\.0\.0\.1:\d+$/.test(host))throw new Error('Local Auth emulator required; never run against production.');
const app=initializeApp({projectId:project,apiKey:'demo-key',authDomain:project+'.firebaseapp.com'},'auth-recovery-'+randomUUID()),auth=getAuth(app);
beforeAll(()=>connectAuthEmulator(auth,'http://'+host,{disableWarnings:true}));
afterAll(()=>deleteApp(app));
it('verifies a fresh email link, rejects reuse, then refreshes the verified user and token without changing security',async()=>{
 const email='verify-'+randomUUID()+'@example.test',password='Test-'+randomUUID();
 const {user}=await createUserWithEmailAndPassword(auth,email,password);expect(user.emailVerified).toBe(false);
 await sendEmailVerification(user);
 const result=await fetch('http://'+host+'/emulator/v1/projects/'+project+'/oobCodes'),body=await result.json();
 const code=body.oobCodes.find((r:{email:string;requestType:string})=>r.email===email&&r.requestType==='VERIFY_EMAIL')?.oobCode;
 expect(typeof code).toBe('string');await applyActionCode(auth,code);
 await expect(applyActionCode(auth,code)).rejects.toHaveProperty('code');
 expect(await new EmailVerification(user).refresh()).toBe(true);expect((await getIdTokenResult(user,true)).claims.email_verified).toBe(true);
 await signOut(auth);const again=await signInWithEmailAndPassword(auth,email,password);expect(again.user.uid).toBe(user.uid);expect(again.user.emailVerified).toBe(true);
});
it('an invalid verification link cannot mark an account verified',async()=>{
 const {user}=await createUserWithEmailAndPassword(auth,'invalid-'+randomUUID()+'@example.test','Test-'+randomUUID());
 await expect(applyActionCode(auth,'not-a-valid-code')).rejects.toHaveProperty('code');expect(await new EmailVerification(user).refresh()).toBe(false);
});
it('handles a Google identity in the Auth emulator without contacting real Google OAuth',async()=>{
 const now=Math.floor(Date.now()/1000),token=[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:'demo-client',sub:randomUUID(),email:'google-'+randomUUID()+'@example.test',email_verified:true,iat:now,exp:now+3600})).toString('base64url'),''].join('.');
 const result=await signInWithCredential(auth,GoogleAuthProvider.credential(token));expect(result.user.providerData.some(p=>p.providerId==='google.com')).toBe(true);expect(result.user.emailVerified).toBe(true);
 expect((await getIdTokenResult(result.user)).claims.firebase).toMatchObject({sign_in_provider:'google.com'});
});
