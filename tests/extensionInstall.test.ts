// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectExtension, readInstallPreference, saveInstallPreference, shouldOffer, SNOOZE_MS, storeUrl } from '../src/lib/extensionInstall'
const config={extensionId:'a'.repeat(32),published:true},pref={dismissed:false,manualInstalled:false,snoozedUntil:0},ua='Mozilla Chrome/130.0 Safari/537.36'
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear()})
describe('extension install suggestions',()=>{
 it('requires a published valid store item and desktop browser',()=>{
  expect(storeUrl({...config,extensionId:'https://fake'})).toBeNull()
  expect(storeUrl({...config,published:false})).toBeNull()
  expect(shouldOffer(config,pref,false,10,ua)).toBe(true)
  for(const agent of ['iPhone Chrome/130','Android Chrome/130','Firefox/120'])expect(shouldOffer(config,pref,false,10,agent)).toBe(false)
 })
 it('honors detection, permanent dismissal, manual installation and seven-day snooze',()=>{
  expect(shouldOffer(config,pref,true,10,ua)).toBe(false)
  for(const p of [{...pref,dismissed:true},{...pref,manualInstalled:true},{...pref,snoozedUntil:SNOOZE_MS}])expect(shouldOffer(config,p,false,10,ua)).toBe(false)
  expect(shouldOffer(config,{...pref,snoozedUntil:SNOOZE_MS},false,SNOOZE_MS,ua)).toBe(true)
  saveInstallPreference({...pref,dismissed:true});expect(readInstallPreference().dismissed).toBe(true)
  localStorage.setItem('wilo-extension-offer-v1','invalid');expect(readInstallPreference()).toEqual(pref)
 })
 it('only confirms a positive response from the configured extension',async()=>{
  const sendMessage=vi.fn((_id,_message,cb)=>cb({app:'where-i-left-off',installed:true}))
  vi.stubGlobal('chrome',{runtime:{sendMessage}})
  expect(await detectExtension(config.extensionId)).toBe(true)
  expect(sendMessage).toHaveBeenCalledWith(config.extensionId,{type:'WILO_PING'},expect.any(Function))
  vi.stubGlobal('chrome',{runtime:{sendMessage:(_id:unknown,_message:unknown,cb:(v:unknown)=>void)=>cb({installed:true})}})
  expect(await detectExtension(config.extensionId)).toBe(false)
 })
 it('does not hang or claim detection when an older extension does not answer',async()=>{
  vi.useFakeTimers();vi.stubGlobal('chrome',{runtime:{sendMessage:()=>{}}})
  const detected=detectExtension(config.extensionId);await vi.advanceTimersByTimeAsync(1600);expect(await detected).toBe(false)
 })
})
