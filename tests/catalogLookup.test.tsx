// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import CatalogLookup from '../src/components/CatalogLookup'
import { searchCatalog, enrichCatalog } from '../src/lib/catalog'
import type { CatalogResult } from '../src/lib/catalog'
vi.mock('../src/lib/catalog',()=>({searchCatalog:vi.fn(),enrichCatalog:vi.fn()}))
let root:Root,container:HTMLDivElement
const choose=vi.fn()
const result:CatalogResult={id:'OL123W',source:'openlibrary',name:'First book',url:'https://openlibrary.org/works/OL123W',coverUrl:'',description:'Author',totalUnits:100,resourceType:'book'}
function render(name:string,type='book'){act(()=>root.render(<CatalogLookup name={name} type={type} language="en" onChoose={choose}/>))}
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals()})
it('distinguishes debounce/loading from an empty result and hides previous matches immediately',async()=>{
 vi.mocked(searchCatalog).mockResolvedValueOnce([result]).mockResolvedValueOnce([])
 render('First book');expect(container.textContent).toContain('Searching');expect(container.textContent).not.toContain('No results')
 await act(()=>vi.advanceTimersByTimeAsync(1000));expect(container.querySelector('.catalog-result')).not.toBeNull()
 render('Other book');expect(container.querySelector('.catalog-result')).toBeNull();expect(container.textContent).not.toContain('No results')
 await act(()=>vi.advanceTimersByTimeAsync(1000));expect(container.textContent).toContain('No results')
 render('A');expect(container.textContent).not.toContain('No results');expect(container.textContent).not.toContain('Searching')
})
it('offers retry after a failed search without losing the typed title',async()=>{
 vi.mocked(searchCatalog).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([result])
 render('First book');await act(()=>vi.advanceTimersByTimeAsync(1000))
 expect(container.textContent).toContain('Search is unavailable')
 act(()=>container.querySelector<HTMLButtonElement>('button')!.click())
 await act(()=>vi.advanceTimersByTimeAsync(1000))
 expect(container.querySelector('.catalog-result strong')?.textContent).toBe('First book')
 expect(searchCatalog).toHaveBeenLastCalledWith('First book','book',expect.any(AbortSignal))
})
it('ignores late responses when a new query has already completed',async()=>{
 let resolve!:(items:CatalogResult[])=>void
 vi.mocked(searchCatalog).mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValueOnce([])
 render('First book');await act(()=>vi.advanceTimersByTimeAsync(1000))
 render('Other book');await act(()=>vi.advanceTimersByTimeAsync(1000))
 await act(async()=>resolve([result]))
 expect(container.querySelector('.catalog-result')).toBeNull();expect(container.textContent).toContain('No results')
})
it('cancels an in-flight selection when the title changes',async()=>{
 let resolve!:(value:CatalogResult)=>void
 vi.mocked(searchCatalog).mockResolvedValue([result])
 vi.mocked(enrichCatalog).mockReturnValue(new Promise(done=>{resolve=done}))
 render('First book');await act(()=>vi.advanceTimersByTimeAsync(1000))
 act(()=>container.querySelector<HTMLButtonElement>('.catalog-result')!.click())
 render('Other book');await act(async()=>resolve(result))
 expect(choose).not.toHaveBeenCalled()
})
