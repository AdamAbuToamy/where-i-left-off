import {authorizeDevice} from '@pollinations/sdk';
import {connectionCommand} from './accountConnection';
import {emulatorMode} from '../lib/firebase';
import config from './pollinationsConfig.json';
const PREFIX='wilo-pollinations:';
const connections=new Set<string>();
function legacyKey(uid:string):string|null{try{return sessionStorage.getItem(PREFIX+uid);}catch{return null;}}
function clearLegacy(uid:string){try{sessionStorage.removeItem(PREFIX+uid);}catch{/* Account storage does not require browser storage. */}}
export function pollinationsConnected(uid:string):boolean{return connections.has(uid)||(emulatorMode&&!!legacyKey(uid));}
export async function restorePollinations(uid:string):Promise<boolean>{
 if(emulatorMode&&legacyKey(uid))return true;
 const legacy=legacyKey(uid);
 let connected=await connectionCommand(uid,'connection-status');
 if(!connected&&legacy)connected=await connectionCommand(uid,'connection-save',legacy);
 if(connected){connections.add(uid);clearLegacy(uid);}else connections.delete(uid);
 return connected;
}
export function pollinationsTestMode(uid:string):boolean{return emulatorMode&&!!legacyKey(uid);}
export function pollinationsKey(uid:string):string{const key=legacyKey(uid);if(!key)throw new Error('assistant-connect-required');return key;}
export async function disconnectPollinations(uid:string){
 await connectionCommand(uid,'connection-delete');
 connections.delete(uid);clearLegacy(uid);
}
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
  await connectionCommand(uid,'connection-save',key);
  connections.add(uid);clearLegacy(uid);
 };
 return connect().finally(()=>{clearTimeout(timer);if(!popup.closed)popup.close();});
}