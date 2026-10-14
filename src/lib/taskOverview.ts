import type { Project } from '../types'
import { localDateKey } from './projects'
export type TaskEntry = { project:Project; scope:string; groupId?:string;canManage?:boolean }
export function checklistItems(text='') {
 return text.split('\n').map((line,index) => ({ index, done:/^\s*\[x\]\s/i.test(line), text:line.replace(/^\s*\[[ x]\]\s*/i,'').replace(/^\d+[.)]\s+/,'').trim() })).filter(item => !!item.text)
}
export function sortTasks(entries:TaskEntry[], today=localDateKey()) {
 const score = (p:Project) => p.status==='done' ? 9 : p.dueDate && p.dueDate<=today ? 0 : p.status==='active' ? 1 : p.status==='waiting' ? 3 : 2
 return [...entries].sort((a,b) => score(a.project)-score(b.project) || (a.project.dueDate || '9999').localeCompare(b.project.dueDate || '9999') || a.project.rank-b.project.rank || a.project.id.localeCompare(b.project.id))
}
export function taskLink(entry:TaskEntry) { return entry.groupId ? `#/groups/${entry.groupId}/${entry.project.id}` : `#/personal/${entry.project.id}` }
