export const IDLE_SLEEP_MS=60000
export function readSleepEnabled(uid:string) {try{return localStorage.getItem(`idle-sleep:${uid}`)!=='off'}catch{return true}}
export function saveSleepEnabled(uid:string,enabled:boolean) {try{localStorage.setItem(`idle-sleep:${uid}`,enabled?'on':'off')}catch{/* Session preference. */}window.dispatchEvent(new CustomEvent('idle-settings-changed',{detail:{uid,enabled}}))}
