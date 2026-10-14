export const MAX_SESSION_SECONDS=90*60
export type SessionClock={startedAt:number;runningSince:number|null;accumulated:number}
export function elapsedSeconds(clock:SessionClock,now=Date.now()){return Math.min(MAX_SESSION_SECONDS,Math.max(0,Math.floor((clock.accumulated+(clock.runningSince===null?0:Math.max(0,now-clock.runningSince)))/1000)))}
export function pauseClock(clock:SessionClock,now=Date.now()):SessionClock{return{...clock,runningSince:null,accumulated:Math.min(MAX_SESSION_SECONDS*1000,clock.accumulated+(clock.runningSince===null?0:Math.max(0,now-clock.runningSince)))}}
