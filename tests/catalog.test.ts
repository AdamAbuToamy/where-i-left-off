import { afterEach,expect,it,vi } from 'vitest'
import { searchCatalog,enrichCatalog } from '../src/lib/catalog'
afterEach(()=>vi.unstubAllGlobals())
it('maps public book results without executing descriptions or requiring an API key',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({docs:[{key:'/works/OL123W',title:'Test book',author_name:['Author'],cover_i:42,number_of_pages_median:300}]})});vi.stubGlobal('fetch',fetcher)
 const [result]=await searchCatalog('Unique book test','book',new AbortController().signal)
 expect(result.name).toBe('Test book');expect(result.totalUnits).toBe(300);expect(result.coverUrl).toContain('covers.openlibrary.org');expect(fetcher.mock.calls[0][0]).not.toContain('key=')
})
it('fetches actual episode counts and strips API markup for series',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{show:{id:123,name:'Example series',url:'https://www.tvmaze.com/shows/123',summary:'<b>Series description</b>',image:null}}]}).mockResolvedValueOnce({ok:true,json:async()=>[{}, {}, {}]});vi.stubGlobal('fetch',fetcher)
 const [result]=await searchCatalog('Unique series test','series',new AbortController().signal)
 expect(result.description).toBe('Series description');expect((await enrichCatalog(result,new AbortController().signal)).totalUnits).toBe(3)
})
it('rejects an invalid response envelope instead of reporting an empty catalog',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>null}))
 await expect(searchCatalog('Malformed envelope test','book',new AbortController().signal)).rejects.toThrow('catalog-invalid-response')
})
it('skips malformed rows, deduplicates IDs, and never stores infinite page counts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({docs:[null,{},
  {key:'/works/OL999W',title:'Valid book',number_of_pages_median:Infinity},
  {key:'/works/OL999W',title:'Duplicate book'},
  {key:'/works/OL888W',title:{unexpected:'object'}}]})}))
 const results=await searchCatalog('Malformed rows test','book',new AbortController().signal)
 expect(results).toHaveLength(1);expect(results[0].totalUnits).toBe(0);expect(results[0].name).toBe('Valid book')
})
it('accepts series without images and rejects unsafe links and malformed IDs',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[null,{show:null},
  {show:{id:456,name:'Valid series',url:'javascript:alert(1)',image:{medium:'https://user:secret@example.test/image.jpg'}}},
  {show:{id:'wrong',name:'Invalid series'}}]}))
 const results=await searchCatalog('Unsafe series test','series',new AbortController().signal)
 expect(results).toHaveLength(1);expect(results[0].url).toBe('');expect(results[0].coverUrl).toBe('')
})
it('honors cancellation even when a matching result is cached',async()=>{
 const controller=new AbortController();controller.abort()
 await expect(searchCatalog('Unique book test','book',controller.signal)).rejects.toThrow()
})
