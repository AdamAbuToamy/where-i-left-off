/** Injected provider output for adapter/persistence tests. Never a live model benchmark. */
export function providerReply(value:{text?:string;actions?:unknown[];controls?:unknown[];tasks?:unknown[];[key:string]:unknown}):string{
 const {actions=[],controls=[]}=value;
 return JSON.stringify({...value,...(!value.tasks&&(actions.length||controls.length)?{tasks:[
  ...actions.map((_,i)=>({title:'Data request '+i,outcome:'proposed',actionIndexes:[i],controlIndexes:[],detail:''})),
  ...controls.map((_,i)=>({title:'Site request '+i,outcome:'proposed',actionIndexes:[],controlIndexes:[i],detail:''})),
 ]}:{})});
}
