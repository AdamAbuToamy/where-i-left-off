import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readTheme, saveTheme } from '../src/lib/theme'
import { deletionDue, DELETION_GRACE_MS } from '../scripts/deletionPolicy.mjs'
const values = new Map<string,string>()
beforeEach(() => {
 values.clear()
 vi.stubGlobal('localStorage',{ getItem:(k:string)=>values.get(k), setItem:(k:string,v:string)=>values.set(k,v) })
 vi.stubGlobal('document',{documentElement:{dataset:{}}})
})
describe('appearance preferences and deletion deadline', () => {
 it('isolates appearance by account and ignores unknown palettes', () => {
  saveTheme('alice','ocean'); expect(readTheme('alice')).toBe('ocean'); expect(readTheme('bob')).toBe('original')
  values.set('site-theme:bob','unknown'); expect(readTheme('bob')).toBe('original')
 })
 it('never processes before 24 hours, permits exactly the deadline, and rejects malformed dates', () => {
  const request = {status:'pending',requestedAt:{toMillis:()=>1000}}
  expect(deletionDue(request,1000+DELETION_GRACE_MS-1)).toBe(false)
  expect(deletionDue(request,1000+DELETION_GRACE_MS)).toBe(true)
  expect(deletionDue({status:'pending'},Date.now())).toBe(false)
 })
 it('respects processing leases and never reprocesses completed or cancelled requests', () => {
  const request = {status:'processing',requestedAt:{toMillis:()=>1000},leaseUntil:{toMillis:()=>DELETION_GRACE_MS+2000}}
  expect(deletionDue(request,DELETION_GRACE_MS+1000)).toBe(false)
  expect(deletionDue(request,DELETION_GRACE_MS+2000)).toBe(true)
  for (const status of ['completed','cancelled']) expect(deletionDue({...request,status},DELETION_GRACE_MS+3000)).toBe(false)
 })
})
