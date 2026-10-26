// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import LocalActivation from '../src/assistant/LocalActivation';
it('keeps readiness separate from 100% load and makes cancellation available in every stage',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const element=document.createElement('div'),root=createRoot(element),cancel=vi.fn();
 try{
  for(const stage of ['checking','loading','verifying'] as const){
   await act(async()=>root.render(<LocalActivation language="en" loading progress={1} stage={stage} disabled onActivate={()=>{}} onCancel={cancel}/>));
   expect(element.querySelector('progress')?.hasAttribute('value')).toBe(stage==='loading');
   expect(element.querySelector('[aria-current=step]')?.textContent).toContain(stage==='checking'?'Check device':stage==='loading'?'Load & prepare':'Verify readiness');
   const button=element.querySelector('button')!;expect(button.disabled).toBe(false);await act(async()=>button.click());
  }
  expect(cancel).toHaveBeenCalledTimes(3);
 }finally{act(()=>root.unmount());vi.unstubAllGlobals();}
});