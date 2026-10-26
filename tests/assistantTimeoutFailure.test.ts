import {expect,it} from 'vitest';
import {AssistantFailure} from '../src/assistant/failure';
it('keeps a total deadline failure recognizable when it occurs between provider turns',()=>{
 const cause=new DOMException('The operation was aborted due to timeout','TimeoutError');
 expect(AssistantFailure.from(cause,'request')).toMatchObject({code:'assistant-timeout',stage:'provider',cause});
 expect(AssistantFailure.from(cause,'read')).toMatchObject({code:'assistant-timeout',stage:'read'});
});
