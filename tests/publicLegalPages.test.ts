import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { expect,it } from 'vitest'
it('legal pages render all three languages, keep public links and do not contact third parties',()=>{
 for(const name of ['privacy','terms','support'])for(const lang of ['ar','he','en']){
  const dom=new JSDOM(readFileSync(`public/${name}.html`,'utf8'),{url:`https://where-i-left-off.web.app/${name}.html?lang=${lang}`,runScripts:'dangerously'})
  const doc=dom.window.document
  expect(doc.documentElement.lang).toBe(lang);expect(doc.documentElement.dir).toBe(lang==='en'?'ltr':'rtl')
  expect(doc.querySelector('h1')?.textContent?.length).toBeGreaterThan(5)
  expect(doc.querySelectorAll('main h2').length).toBeGreaterThan(2)
  expect(doc.querySelector('#contact')?.getAttribute('href')).toBe('/#/support')
  expect(doc.querySelectorAll('script[src],iframe,img,link[rel=stylesheet]').length).toBe(0)
  dom.window.close()
 }
})
