export type ExtensionConfig={extensionId:string;published:boolean}
export type InstallPreference={dismissed:boolean;snoozedUntil:number;manualInstalled:boolean}
const KEY='wilo-extension-offer-v1'
export const SNOOZE_MS=7*24*60*60*1000
export function validExtensionId(id:unknown):id is string{return typeof id==='string'&&/^[a-p]{32}$/.test(id)}
export function desktopChromium(ua=navigator.userAgent){return !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)&&/Chrome|Chromium|Edg\//.test(ua)}
export function storeUrl(config:ExtensionConfig){return config.published&&validExtensionId(config.extensionId)?`https://chromewebstore.google.com/detail/${config.extensionId}`:null}
export function readInstallPreference():InstallPreference {
 try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return{dismissed:v.dismissed===true,manualInstalled:v.manualInstalled===true,snoozedUntil:Number.isFinite(v.snoozedUntil)?v.snoozedUntil:0}}catch{return{dismissed:false,manualInstalled:false,snoozedUntil:0}}
}
export function saveInstallPreference(p:InstallPreference){try{localStorage.setItem(KEY,JSON.stringify(p))}catch{/* Respect dismissal for this mounted session even when persistent storage is unavailable. */}}
export function shouldOffer(config:ExtensionConfig,p:InstallPreference,confirmed:boolean,now=Date.now(),ua=navigator.userAgent){return !!storeUrl(config)&&desktopChromium(ua)&&!confirmed&&!p.manualInstalled&&!p.dismissed&&now>=p.snoozedUntil}
type Runtime={lastError?:unknown;sendMessage:(id:string,message:{type:string},callback:(response:unknown)=>void)=>void}
export function detectExtension(id:string):Promise<boolean>{
 if(!validExtensionId(id))return Promise.resolve(false)
 const runtime=(globalThis as typeof globalThis&{chrome?:{runtime?:Runtime}}).chrome?.runtime
 if(!runtime?.sendMessage)return Promise.resolve(false)
 return new Promise(resolve=>{
  let settled=false
  const finish=(value:boolean)=>{if(!settled){settled=true;clearTimeout(timer);resolve(value)}}
  const timer=setTimeout(()=>finish(false),1600)
  try{runtime.sendMessage(id,{type:'WILO_PING'},response=>{const error=runtime.lastError;finish(!error&&!!response&&typeof response==='object'&&'app'in response&&response.app==='where-i-left-off'&&'installed'in response&&response.installed===true)})}catch{finish(false)}
 })
}
