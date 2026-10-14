import { expect,it } from 'vitest'
import { splitTextLinks } from '../src/lib/textLinks'
import { validateProject } from '../src/lib/projects'
it('recognizes multiple links in Arabic text and preserves punctuation and newlines',()=>{
 const text='راجع https://example.test/page، ثم\nwww.example.org.'
 const parts=splitTextLinks(text)
 expect(parts.filter(p=>p.href).map(p=>p.href)).toEqual(['https://example.test/page','https://www.example.org'])
 expect(parts.map(p=>p.text).join('')).toBe(text)
})
it('keeps scripts and markup as ordinary text',()=>{
 const text='<img onerror=alert(1)> javascript:alert(1) data:text/html,hello'
 expect(splitTextLinks(text).some(p=>p.href)).toBe(false)
 expect(splitTextLinks(text).map(p=>p.text).join('')).toBe(text)
})
it('validates extra links while preserving the two legacy URL fields',()=>{
 expect(()=>validateProject('Card','Next',{projectUrl:'https://example.test',attachmentUrl:'https://example.test/file',links:['https://example.org']})).not.toThrow()
 for(const links of [['javascript:alert(1)'],['https://example.org/a b'],Array(11).fill('https://example.test')])expect(()=>validateProject('Card','Next',{links})).toThrow('invalid-project-url')
})

it('preserves balanced URL parentheses and recognizes local HTTP links',()=>{
 const parts=splitTextLinks('(https://example.test/Topic_(test)) http://localhost:5173')
 expect(parts.filter(p=>p.href).map(p=>p.href)).toEqual(['https://example.test/Topic_(test)','http://localhost:5173'])
})
