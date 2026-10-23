import {expect,it} from 'vitest';
import {coverageHint} from '../src/assistant/coverageHint';
import {parseAssistantReply} from '../src/assistant/actions';
it('renders only bounded translated field diagnostics, ignoring arbitrary values and messages',()=>{
 const error={details:[{task:2,reason:'missing-effect',field:'description',secret:'must-not-render'},{task:999,reason:'missing-effect',field:'name'},{task:1,reason:'provider raw secret',field:'name'}]};
 expect(coverageHint(error,'ar')).toContain('الطلب 3');expect(coverageHint(error,'ar')).toContain('الملاحظات والوصف');expect(coverageHint(error,'en')).not.toContain('secret');expect(coverageHint(error,'he')).toContain('בקשה 3');
});
it('handoffs can navigate but cannot mutate account settings under a non-proposed task',()=>{
 const base={text:'Use the original form',actions:[],files:[],controls:[{kind:'navigate',values:{page:'settings'}}],tasks:[{title:'Password',outcome:'unsupported',actionIndexes:[],controlIndexes:[0],detail:'Use the password form'}]};
 expect(parseAssistantReply(JSON.stringify(base)).tasks?.[0].outcome).toBe('unsupported');
 expect(()=>parseAssistantReply(JSON.stringify({...base,controls:[{kind:'language',values:{language:'he'}}]}))).toThrow('assistant-invalid');
});
