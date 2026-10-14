// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { Timestamp } from 'firebase/firestore'
const listeners = vi.hoisted(() => new Map<string, (value: unknown) => void>())
vi.mock('../src/lib/firebase', () => ({ db:{app:{options:{projectId:'demo-lifecycle'}}} }))
vi.mock('../src/lib/logging', () => ({ logEvent:vi.fn() }))
vi.mock('firebase/firestore', async importOriginal => ({
 ...await importOriginal<typeof import('firebase/firestore')>(),
 doc: (_db:unknown,...parts:string[]) => ({path:parts.join('/')}),
 onSnapshot: (ref:{path:string}, _options:unknown, receive:(snapshot:unknown)=>void) => {
  listeners.set(ref.path,receive); return () => { listeners.delete(ref.path) }
 },
}))
import { AccountLifecycle } from '../src/components/AccountDeletion'
let root:Root, container:HTMLDivElement, online=true
const user = (uid='alice') => ({uid,email:`${uid}@example.test`,providerData:[{providerId:'password'}]} as User)
function mount(uid='alice') {
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
 act(() => root.render(<AccountLifecycle user={user(uid)} language="en"><div>Offline outline completed</div></AccountLifecycle>))
}
function emit(uid='alice', request:unknown=null, cached=false) {
 act(() => listeners.get(`accountDeletions/${uid}`)?.({exists:()=>request!==null,data:()=>request,metadata:{fromCache:cached}}))
}
function unmount() { act(() => root.unmount());container.remove() }
beforeEach(() => {
 online=true; localStorage.clear();listeners.clear()
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online)
})
afterEach(() => { unmount();vi.restoreAllMocks();vi.unstubAllGlobals() })
describe('account gate across offline reloads', () => {
 it('opens cached projects offline after the server previously verified no deletion request', () => {
  mount();emit();expect(container.textContent).toContain('Offline outline completed')
  unmount();online=false;mount();emit('alice',null,true)
  expect(container.textContent).toContain('Offline outline completed')
 })
 it('keeps a verified pending deletion blocked when an offline snapshot lacks the document', () => {
  mount();emit('alice',{status:'pending',requestedAt:Timestamp.fromMillis(Date.now())})
  unmount();online=false;mount();emit('alice',null,true)
  expect(container.textContent).toContain('Your account is awaiting deletion')
  expect(container.textContent).not.toContain('Offline outline completed')
 })
 it('keeps optional fields accessible while the tour highlights required fields', () => {
  mount();emit()
  const field = container.querySelector('div')!;field.className='project-extra-fields'
  const style=document.createElement('style');style.textContent=readFileSync('src/components/WelcomeTour.css','utf8');document.head.append(style)
  try {
   for (const step of ['1','2']) { document.body.dataset.tourStep=step;expect(getComputedStyle(field).display).not.toBe('none') }
  } finally { style.remove();delete document.body.dataset.tourStep }
 })
 it('does not reuse another account’s verification and accepts the server state after reconnection', () => {
  mount();emit();unmount();online=false;mount('bob');emit('bob',null,true)
  expect(container.textContent).not.toContain('Offline outline completed')
  online=true;emit('bob')
  expect(container.textContent).toContain('Offline outline completed')
 })
})
