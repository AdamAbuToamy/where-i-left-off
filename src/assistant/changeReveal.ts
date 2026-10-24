import type { Change } from './actions';
import type { ControlPlan } from './controls';
export type ChangeDestination={hash:string;attribute?:string;id?:string;container:string};
/** Domain deep links only. Never consume model-supplied selectors or URLs. */
export function changeDestination(change:Change):ChangeDestination{
 const item=(change.after||change.before||{}) as Record<string,unknown>,q=new URLSearchParams();
 if(['courses','tasks','lessons'].includes(change.target)){
  q.set('tab',change.target==='lessons'?'schedule':'overview');
  if(change.target==='tasks'&&item.courseId)q.set('courseId',String(item.courseId));
  return {hash:'#/university?'+q,attribute:change.after?'data-study-'+({courses:'course',tasks:'task',lessons:'lesson'} as const)[change.target as 'courses'|'tasks'|'lessons']:undefined,id:change.id,container:change.target==='lessons'?'.study-time-grid':change.target==='tasks'?'.study-task-list':'.study-layout aside'};
 }
 const project=item as {trashedAt?:number;archivedAt?:number};
 if(change.target==='projects'&&(project.trashedAt||project.archivedAt))return {hash:'#/library?view='+(project.trashedAt?'trash':'archive'),attribute:'data-project',id:change.id,container:'.account-page-outlet'};
 q.set('view','board');q.set('filter','all');
 if(change.target==='projects')q.set('search',String(item.name||''));
 return {hash:(change.scope==='personal'?'#/personal':'#/groups/'+encodeURIComponent(change.scope))+'?'+q,attribute:change.after?(change.target==='projects'?'data-project':'data-section'):undefined,id:change.id,container:change.target==='sections'?'.sections-panel':'.account-page-outlet'};
}
export class AssistantChangeReveal{
 private observer:MutationObserver|null=null;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private cleanHighlight:(()=>void)|undefined;
 dispose(){this.observer?.disconnect();clearTimeout(this.timer);this.cleanHighlight?.();this.cleanHighlight=undefined;}
 show(change:Change,preserveView=false){
  const destination=changeDestination(change);
  const page=change.scope==='personal'?'#/personal':'#/groups/'+encodeURIComponent(change.scope);
  if(preserveView&&change.target==='projects'&&location.hash.split('?')[0]===page&&new URLSearchParams(location.hash.split('?')[1]).get('view')==='week')destination.hash=location.hash;
  this.reveal(destination);
 }
 showControls(plans:ControlPlan[]){
  const navigation=[...plans].reverse().find(p=>p.control.kind==='navigate');
  if(navigation){this.reveal({hash:location.hash,container:'.account-page-outlet'});return;}
  if(plans.length)this.reveal({hash:'#/settings',container:'.settings-page'});
 }
 private reveal(destination:ChangeDestination){
  this.dispose();location.hash=destination.hash;
  // React/Firebase render asynchronously; observe until the confirmed record is rendered.
  const find=()=>{
   const element=destination.attribute?Array.from(document.querySelectorAll<HTMLElement>('['+destination.attribute+']')).find(e=>e.getAttribute(destination.attribute!)===destination.id):document.querySelector<HTMLElement>(destination.container)||document.querySelector<HTMLElement>('.account-page-outlet');
   if(!element)return false;
   this.observer?.disconnect();clearTimeout(this.timer);
   const previous=element.getAttribute('tabindex');element.setAttribute('tabindex','-1');element.classList.add('assistant-change-highlight');
   element.scrollIntoView?.({block:'center',inline:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   element.focus({preventScroll:true});
   const cleanup=()=>{element.classList.remove('assistant-change-highlight');if(previous===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',previous);};
   this.cleanHighlight=cleanup;this.timer=setTimeout(cleanup,6000);return true;
  };
  // Wait for hash handlers even if the previous page happens to contain a matching container.
  this.timer=setTimeout(()=>{if(find())return;this.observer=new MutationObserver(find);this.observer.observe(document.body,{childList:true,subtree:true});this.timer=setTimeout(()=>this.observer?.disconnect(),8000);},80);
 }
}
