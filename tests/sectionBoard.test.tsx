import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/components/ProjectCard',()=>({default:({project}:{project:{name:string}})=><article>{project.name}</article>}));
import ProjectBoard from '../src/components/ProjectBoard';
import type {Project} from '../src/types';
const projects=[{id:'a',name:'A',sectionId:'one'},{id:'b',name:'B',sectionId:'two'},{id:'c',name:'C',sectionId:'removed'}] as Project[];
it('groups each visible card exactly once and retains orphan cards as no section',()=>{
 const html=renderToStaticMarkup(<ProjectBoard groupBySection projects={projects} sections={[{id:'one',name:'Study'},{id:'two',name:'Work'}]} language="en" onReorder={()=>{}} onToggle={()=>{}} onUpdate={async()=>true} onDelete={async()=>true}/>);
 expect(html.match(/class="section-cluster"/g)).toHaveLength(3);expect(html).toContain('Study');expect(html).toContain('Work');expect(html).toContain('No section');for(const name of ['A','B','C'])expect(html.split(`<article>${name}</article>`)).toHaveLength(2);
});
it('ordinary cards view keeps its existing flat board',()=>{
 const html=renderToStaticMarkup(<ProjectBoard projects={projects} sections={[]} language="ar" onReorder={()=>{}} onToggle={()=>{}} onUpdate={async()=>true} onDelete={async()=>true}/>);expect(html).not.toContain('section-cluster');
});
