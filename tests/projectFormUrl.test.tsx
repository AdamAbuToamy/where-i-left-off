// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('../src/components/CatalogLookup',()=>({default:({onChoose}:{onChoose:(title:string,values:object)=>void})=><button type="button" onClick={()=>onChoose('Selected book',{projectUrl:'https://old.example/book',resourceType:'book'})}>Choose catalog item</button>}));
import NewProjectForm from '../src/components/NewProjectForm';
it('saves the edited link instead of a stale URL carried by catalog metadata',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const element=document.createElement('div'),root=createRoot(element),add=vi.fn().mockResolvedValue(true);document.body.append(element);
 try{
  await act(async()=>root.render(<NewProjectForm language="en" isOpen onAdd={add} onCancel={()=>{}}/>));
  await act(async()=>element.querySelector('button')!.click());
  const url=element.querySelector<HTMLInputElement>('#project-url')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(url,'https://new.example/book');url.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>element.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(add).toHaveBeenCalledWith('Selected book','',expect.objectContaining({projectUrl:'https://new.example/book',resourceType:'book'}));
 }finally{act(()=>root.unmount());element.remove();vi.unstubAllGlobals();}
});