// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {afterEach,beforeEach,expect,it,vi} from 'vitest';import type {User} from 'firebase/auth';
import type {PageName} from '../src/lib/navigation';
vi.mock('../src/lib/firebase',()=>({db:{}}));vi.mock('../src/lib/admin',()=>({isAdmin:()=>true}));
vi.mock('../src/components/Workspace',()=>({default:()=> <div data-screen="cards">Cards</div>}));
vi.mock('../src/components/GroupSpaces',()=>({default:({children}:{children:(group:undefined,members:[])=>unknown})=>children(undefined,[])}));
vi.mock('../src/components/ContinueNow',()=>({default:()=> <div data-screen="resume">Today</div>}));
vi.mock('../src/components/LibraryPage',()=>({default:()=> <div data-screen="library"/>}));
vi.mock('../src/components/AnalyticsPage',()=>({default:()=> <div data-screen="analytics"/>}));
vi.mock('../src/components/NotificationSettings',()=>({default:()=> <div data-screen="notifications"/>}));
vi.mock('../src/components/ProfileSettings',()=>({default:()=> <div data-screen="settings"/>}));
vi.mock('../src/components/AdminDashboard',()=>({default:()=> <div data-screen="admin"/>}));
vi.mock('../src/university/UniversityPage',()=>({default:()=> <div data-screen="university">Study</div>}));
import AccountPage from '../src/components/AccountPage';
let node:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);node=document.createElement('div');document.body.append(node);root=createRoot(node);});afterEach(()=>{act(()=>root.unmount());node.remove();vi.unstubAllGlobals();});
it('shows exactly one screen through repeated navigation and removes cards from study/today/settings',async()=>{
 for(const page of ['personal','university','resume','settings','groups','library','analytics','notifications','admin','personal'] as PageName[]){
  await act(async()=>{root.render(<AccountPage page={page} user={{uid:'alice',emailVerified:true} as User} groupId="" language="en" installed={true} profileVersion={0}/>);});
  expect(node.querySelectorAll('[data-screen]')).toHaveLength(1);expect(node.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe(['personal','groups'].includes(page)?'cards':page);
 }
});
