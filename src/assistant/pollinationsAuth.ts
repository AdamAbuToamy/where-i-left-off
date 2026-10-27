import {authorizeDevice} from '@pollinations/sdk';
import config from './pollinationsConfig.json';
const PREFIX='wilo-pollinations:';
export function pollinationsConnected(uid:string):boolean{return !!sessionStorage.getItem(PREFIX+uid);}
export function pollinationsKey(uid:string):string{const key=sessionStorage.getItem(PREFIX+uid);if(!key)throw new Error('assistant-connect-required');return key;}
export function disconnectPollinations(uid:string){sessionStorage.removeItem(PREFIX+uid);}
/** Official device authorization keeps Wilo open and never puts a secret in a URL. */
export function connectPollinations(uid:string):Promise<void>{
 const popup=window.open('about:blank','wilo-pollinations-connect','popup,width=520,height=720');
 if(!popup)return Promise.reject(new Error('assistant-popup-blocked'));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),300000);
 const connect=async()=>{
  const auth=await authorizeDevice({clientId:config.appKey,scope:'generate',signal:controller.signal});
  const url=new URL(auth.verificationUri);if(url.origin!=='https://enter.pollinations.ai')throw new Error('assistant-connect-invalid');
  if(popup.closed)throw new Error('assistant-connect-cancelled');popup.location.href=url.href;
  const key=await auth.poll();if(!key.startsWith('sk_'))throw new Error('assistant-connect-failed');
  sessionStorage.setItem(PREFIX+uid,key);
 };
 return connect().finally(()=>{clearTimeout(timer);if(!popup.closed)popup.close();});
}