import {expect,it} from 'vitest';
import {parseAssistantReply,planAssistantChanges,blankAssistantData} from '../src/assistant/actions';
import {taskState} from '../src/assistant/taskLedger';
it('keeps ten requested tasks pending until their corresponding domain receipts confirm execution',()=>{
 const actions=Array.from({length:10},(_,i)=>({target:'courses',action:'create',id:'new-'+i,values:{name:'Course '+i}}));
 const tasks=actions.map((_,i)=>({title:'Task '+i,outcome:'proposed',actionIndexes:[i],controlIndexes:[],detail:''}));
 const reply=parseAssistantReply(JSON.stringify({text:'Saved!',actions,tasks}));
 const changes=planAssistantChanges(blankAssistantData(),reply.actions,Date.now(),true);
 for(const task of reply.tasks!){expect(taskState(task,changes,undefined,undefined,false)).toBe('pending');expect(taskState(task,changes,changes,[],true)).toBe('saved');}
 expect(taskState(reply.tasks![9],changes,changes.slice(0,9),[],true)).toBe('failed');
});
it('tracks several edits to the same record without confusing task count with document count',()=>{
 const data=blankAssistantData();data.study.courses=[{id:'a',name:'Original',notes:'',url:'',requires:[],x:0,y:0}];
 const changes=planAssistantChanges(data,[{target:'courses',action:'update',id:'a',values:{name:'Renamed'}},{target:'courses',action:'update',id:'a',values:{notes:'New notes'}}],Date.now(),true);
 expect(changes).toHaveLength(1);expect(changes[0].actionIndexes).toEqual([0,1]);
});
it('rejects fake completed task states and invalid operation references',()=>{
 for(const task of [{title:'Done',outcome:'saved',actionIndexes:[],controlIndexes:[],detail:''},{title:'Missing',outcome:'proposed',actionIndexes:[99],controlIndexes:[],detail:''},{title:'Pretend',outcome:'proposed',actionIndexes:[],controlIndexes:[],detail:''}])expect(()=>parseAssistantReply(JSON.stringify({text:'ok',tasks:[task],actions:[]}))).toThrow('assistant-invalid');
});
it('marks duplicate/no-op actions unchanged before Apply rather than leaving an impossible pending task',()=>{
 const task={title:'Already present',outcome:'proposed' as const,actionIndexes:[0],controlIndexes:[],detail:''};
 expect(taskState(task,[],undefined,undefined,false)).toBe('unchanged');
 expect(taskState({...task,controlIndexes:[0]},[],undefined,undefined,false)).toBe('pending');
});
