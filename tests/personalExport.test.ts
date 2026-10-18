import { expect,it,vi } from 'vitest'
import type { Firestore } from 'firebase/firestore'
const mocks=vi.hoisted(()=>({getDocs:vi.fn().mockResolvedValue({docs:[{id:'card1',data:()=>({name:'Sample'})}]}),getDoc:vi.fn().mockResolvedValue({exists:()=>true,data:()=>({reminders:true})})}))
vi.mock('firebase/firestore',()=>({collection:(_db:unknown,...parts:string[])=>parts.join('/'),doc:(_db:unknown,...parts:string[])=>parts.join('/'),getDocsFromServer:mocks.getDocs,getDocFromServer:mocks.getDoc,limit:vi.fn(),onSnapshot:vi.fn(),orderBy:vi.fn(),query:vi.fn(),runTransaction:vi.fn(),serverTimestamp:vi.fn(),updateDoc:vi.fn(),where:vi.fn()}))
import { exportPersonalData } from '../src/lib/feedback'
it('exports only the signed-in personal collections and the explicitly permitted preference document',async()=>{
 vi.stubGlobal('navigator',{onLine:true})
 const result=await exportPersonalData({} as Firestore,'alice')
 expect(mocks.getDocs.mock.calls.map(c=>c[0])).toEqual(['users/alice/projects','users/alice/sections','users/alice/sessions'])
 expect(mocks.getDoc).toHaveBeenCalledWith('users/alice/preferences/workflow')
 expect(result.preferences.workflow).toEqual({reminders:true});expect(result.uid).toBe('alice')
 vi.unstubAllGlobals()
})
