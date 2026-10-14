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
