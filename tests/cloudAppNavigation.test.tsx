// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
const fake=vi.hoisted(()=>({crash:'',assistantImports:0,user:{uid:'same-user-key',displayName:'Tester',email:'tester@example.test',emailVerified:true}}));
vi.mock('../src/lib/firebase',()=>({auth:{},db:{},configured:true,emulatorMode:false}));
vi.mock('firebase/auth',()=>({onAuthStateChanged:(_auth:unknown,next:(user:unknown)=>void)=>{next(fake.user);return()=>{};},signOut:vi.fn()}));
vi.mock('../src/lib/pushNotifications',()=>({useInstalledApp:()=>false,preparePushSignOut:async()=>{}}));
vi.mock('../src/lib/logging',()=>({logEvent:vi.fn(),flushLogs:async()=>{},traced:async(_name:string,fn:()=>unknown)=>fn(),safeCode:()=>''}));
vi.mock('../src/lib/theme',()=>({applyTheme:()=>{}}));
vi.mock('../src/components/CloudPushSync',()=>({default:()=> <aside data-common="push"/>}));
vi.mock('../src/components/WelcomeTour',()=>({default:()=> <aside data-common="tour"/>}));
vi.mock('../src/components/WorkflowAgent',()=>({default:()=>null}));vi.mock('../src/components/AnnouncementInbox',()=>({default:()=>null}));vi.mock('../src/components/ExtensionInstall',()=>({default:()=>null}));vi.mock('../src/components/PushLifecycle',()=>({default:()=>null}));
vi.mock('../src/components/SideNavigation',()=>({default:()=>null}));vi.mock('../src/assistant/AssistantWidget',()=>{fake.assistantImports++;return {default:()=> <aside data-assistant="pilot"/>};});vi.mock('../src/components/AuthPanel',()=>({default:()=>null}));
vi.mock('../src/components/Support',()=>({default:()=>null,LegalLinks:()=> <footer data-footer="legal"/>}));
vi.mock('../src/components/AccountDeletion',()=>({AccountLifecycle:({children}:{children:unknown})=>children}));
vi.mock('../src/components/IdleSleep',()=>({default:({children}:{children:unknown})=>children}));
vi.mock('../src/components/AccountPage',()=>({default:({page}:{page:string})=>{if(fake.crash===page)throw new Error('simulated-page-error');return <section data-screen={page}/>;} }));
import CloudApp from '../src/CloudApp';
import {assistantAccess} from '../src/lib/assistantAccess';
it('the complete app shell works without randomUUID and keeps unique keys and one route through repeated navigation',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const errors=vi.spyOn(console,'error').mockImplementation(()=>{}),node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try{
  vi.stubGlobal('crypto',{getRandomValues:globalThis.crypto.getRandomValues.bind(globalThis.crypto)});
  await act(async()=>root.render(<CloudApp/>));
  for(const page of ['personal','resume','university','settings','analytics','groups','admin','resume','personal']){
   await act(async()=>{window.location.hash='/'+page;window.dispatchEvent(new HashChangeEvent('hashchange'));});
   expect(node.querySelectorAll('[data-screen]')).toHaveLength(1);expect(node.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe(page);expect(node.querySelectorAll('[data-common]')).toHaveLength(2);expect(node.querySelectorAll('[data-footer]')).toHaveLength(1);
  }
  expect(errors.mock.calls.filter(call=>String(call[0]).includes('same key'))).toEqual([]);
 }finally{act(()=>root.unmount());node.remove();errors.mockRestore();vi.unstubAllGlobals();}
});

it('isolates a feature render error and lets navigation recover without reloading the entire site',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const errors=vi.spyOn(console,'error').mockImplementation(()=>{}),node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try {
  window.location.hash='/personal';await act(async()=>root.render(<CloudApp/>));
  fake.crash='university';await act(async()=>{window.location.hash='/university';window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(node.querySelector('.account-page-outlet [role=alert]')).not.toBeNull();
  expect(node.querySelector('.header-signout')).not.toBeNull();expect(node.querySelectorAll('[data-common]')).toHaveLength(2);
  await act(async()=>{window.location.hash='/analytics';window.dispatchEvent(new HashChangeEvent('hashchange'));});
  expect(node.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('analytics');expect(node.querySelectorAll('[role=alert]')).toHaveLength(0);
 } finally {fake.crash='';act(()=>root.unmount());node.remove();errors.mockRestore();vi.unstubAllGlobals();}
});

it('production navigation never loads the assistant module even when the emulator-only feature is requested',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubEnv('VITE_ASSISTANT_ENABLED','true');const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try{await act(async()=>root.render(<CloudApp/>));expect(node.querySelector('[data-screen]')).not.toBeNull();expect(fake.assistantImports).toBe(0);}
 finally{act(()=>root.unmount());node.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();}
});


it('exposes the isolated production pilot only to the verified owner',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const node=document.createElement('div');document.body.append(node);const root=createRoot(node),prior={...fake.user};
 try{
  fake.user.email='adam2002hosny@gmail.com';fake.user.emailVerified=false;
  await act(async()=>root.render(<CloudApp key="unverified"/>));expect(node.querySelector('[data-assistant]')).toBeNull();
  fake.user.emailVerified=true;await act(async()=>root.render(<CloudApp key="verified-off"/>));expect(node.querySelector('[data-assistant]')).toBeNull();
  expect(assistantAccess('true',false,'adam2002hosny@gmail.com',true)).toBe(true);
  expect(assistantAccess('false',false,'adam2002hosny@gmail.com',true)).toBe(false);
  expect(assistantAccess('true',false,'adam2002hosny@gmail.com',false)).toBe(false);
  fake.user.email='other@example.test';await act(async()=>root.render(<CloudApp key="other"/>));expect(node.querySelector('[data-assistant]')).toBeNull();
 }finally{Object.assign(fake.user,prior);act(()=>root.unmount());node.remove();vi.unstubAllGlobals();}
});
