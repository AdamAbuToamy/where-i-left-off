import {expect,it,vi} from 'vitest'
import {createClientId} from '../src/lib/clientId'
it('generates distinct valid v4 record IDs when randomUUID is unavailable',()=>{
 const crypto=globalThis.crypto
 vi.stubGlobal('crypto',{getRandomValues:crypto.getRandomValues.bind(crypto)})
 try {
  const ids=Array.from({length:20},()=>createClientId())
  expect(new Set(ids).size).toBe(20)
  for(const id of ids)expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
 } finally {vi.unstubAllGlobals()}
})
