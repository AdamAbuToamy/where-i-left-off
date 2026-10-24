// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {AssistantChangeReveal,changeDestination} from '../src/assistant/changeReveal';
import type {Change} from '../src/assistant/actions';
const course:Change={target:'courses',scope:'personal',id:'saved-course',before:null,after:{name:'Networks'}};
afterEach(()=>{vi.useRealTimers();document.body.innerHTML='';});
it('routes every data kind through existing views, including deleted records and the archive',()=>{
 expect(changeDestination(course).hash).toBe('#/university?tab=overview');
 expect(changeDestination({...course,target:'lessons',after:{courseId:'c'}}).hash).toBe('#/university?tab=schedule');
 expect(changeDestination({...course,target:'tasks',after:{courseId:'c'}}).attribute).toBe('data-study-task');
 expect(changeDestination({...course,target:'sections',scope:'group123'}).hash).toContain('#/groups/group123');
 expect(changeDestination({...course,target:'projects',after:{archivedAt:5}}).hash).toBe('#/library?view=archive');
 expect(changeDestination({...course,target:'projects',scope:'group123',after:{trashedAt:5}}).hash).toBe('#/library?view=trash');
 expect(changeDestination({...course,after:null,before:{name:'Removed'}}).attribute).toBeUndefined();
});
it('waits for the saved element, highlights it, and restores its original focus attributes',async()=>{
 vi.useFakeTimers();const reveal=new AssistantChangeReveal();reveal.show(course);await vi.advanceTimersByTimeAsync(80);
 const node=document.createElement('article');node.setAttribute('data-study-course',course.id);document.body.append(node);
 await Promise.resolve();expect(node.classList.contains('assistant-change-highlight')).toBe(true);expect(document.activeElement).toBe(node);
 await vi.advanceTimersByTimeAsync(6000);expect(node.classList.contains('assistant-change-highlight')).toBe(false);expect(node.hasAttribute('tabindex')).toBe(false);reveal.dispose();
});
it('preserves an explicitly requested week when revealing a dated card and cancels stale observers',async()=>{
 vi.useFakeTimers();location.hash='#/personal?view=week&weekOf=2026-10-25';const reveal=new AssistantChangeReveal();
 reveal.show({...course,target:'projects',after:{name:'Ammar',dueDate:'2026-10-25'}},true);expect(location.hash).toContain('weekOf=2026-10-25');
 await vi.advanceTimersByTimeAsync(80);reveal.dispose();const node=document.createElement('article');node.setAttribute('data-project',course.id);document.body.append(node);await Promise.resolve();expect(node.classList.contains('assistant-change-highlight')).toBe(false);
});
