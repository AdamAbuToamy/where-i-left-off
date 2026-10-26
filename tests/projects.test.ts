import { describe, expect, it } from 'vitest'
import { rankForMove, sortedProjects, validateProject, matchesView, toggleChecklist } from '../src/lib/projects'
import { translations } from '../src/translations'
import { recallText } from '../src/recallTranslations'
import { cloudText, errorText } from '../src/cloudTranslations'
import { isAdmin, ADMIN_EMAIL } from '../src/lib/admin'
import { parseTabCapture } from '../src/lib/tabCapture'
const projects = ['a', 'b', 'c'].map((id, i) => ({ id, rank: i * 1024, name: id, nextStep: '', status: 'later' as const, revision: 0 }))
describe('project ordering and validation', () => {
  it('moves first to last without changing other records', () => {
    const rank = rankForMove(projects, 'a', 'c')!
    expect(sortedProjects(projects.map(p => p.id === 'a' ? { ...p, rank } : p)).map(p => p.id)).toEqual(['b', 'c', 'a'])
    expect(projects[0].rank).toBe(0)
  })
  it('moves last to first and into the middle', () => {
    expect(rankForMove(projects, 'c', 'a')).toBeLessThan(0)
    expect(rankForMove(projects, 'c', 'b')).toBe(512)
  })
  it('ignores invalid and unchanged drops', () => {
    expect(rankForMove(projects, 'x', 'b')).toBeNull()
    expect(rankForMove(projects, 'a', 'a')).toBeNull()
  })
  it('has a deterministic tie breaker for simultaneous moves', () => {
    expect(sortedProjects([{ ...projects[1], rank: 0 }, projects[0]]).map(p => p.id)).toEqual(['a', 'b'])
  })
  it('rejects blank and oversized content', () => {
    expect(() => validateProject('  ', '')).toThrow()
    expect(() => validateProject('x'.repeat(101), '')).toThrow()
    expect(() => validateProject('Good', 'x'.repeat(1001))).toThrow()
    expect(() => validateProject('مشروع', 'الخطوة القادمة')).not.toThrow()
  })
  it('accepts safe project links and real calendar dates; rejects unsafe URLs and invalid dates', () => {
    expect(() => validateProject('Project', '', { projectUrl: 'https://github.com/example/repo', attachmentUrl: 'https://drive.google.com/file/d/example', dueDate: '2026-10-12' })).not.toThrow()
    expect(() => validateProject('Project', '', { projectUrl: 'javascript:alert(1)' })).toThrow()
    expect(() => validateProject('Project', '', { attachmentUrl: 'file:///etc/passwd' })).toThrow()
    expect(() => validateProject('Project', '', { dueDate: '2026-02-31' })).toThrow()
  })
  it('only grants the limited admin role to the verified admin account', () => {
    expect(isAdmin(ADMIN_EMAIL, true)).toBe(true)
    expect(isAdmin(ADMIN_EMAIL, false)).toBe(false)
    expect(isAdmin('other@example.test', true)).toBe(false)
  })
})
describe('browser tab capture', () => {
  it('prefills a title and safe web link from the extension URL', () => {
    expect(parseTabCapture('?capture=tab&title=ChatGPT%20chat&url=https%3A%2F%2Fchatgpt.com%2Fc%2F123')).toEqual({
      name: 'ChatGPT chat',
      projectUrl: 'https://chatgpt.com/c/123',
    })
  })
  it('ignores absent, incomplete, oversized, and unsafe captures', () => {
    expect(parseTabCapture('')).toBeNull()
    expect(parseTabCapture('?capture=tab&title=Only%20a%20title')).toBeNull()
    expect(parseTabCapture('?capture=tab&title=Unsafe&url=javascript%3Aalert(1)')).toBeNull()
    expect(parseTabCapture(`?capture=tab&title=Long&url=${encodeURIComponent(`https://example.com/${'x'.repeat(500)}`)}`)).toBeNull()
  })
})
it('all three languages have complete nonempty keys including account UI', () => {
  for (const dictionary of [translations, cloudText, recallText]) {
    for (const lang of ['ar', 'he', 'en'] as const) {
      expect(Object.keys(dictionary[lang]).sort()).toEqual(Object.keys(dictionary.en).sort())
      expect(Object.values(dictionary[lang]).every(v => v.trim().length > 0)).toBe(true)
    }
  }
  expect(errorText(new Error('conflict'), 'ar')).toBe(cloudText.ar.conflict)
})

it('smart views use the local calendar day and hide completed reminders', () => {
  const p = { ...projects[0], dueDate: '2026-10-12' }
  expect(matchesView(p, 'today', '2026-10-12')).toBe(true)
  expect(matchesView(p, 'overdue', '2026-10-13')).toBe(true)
  expect(matchesView({ ...p, status: 'done' }, 'today', '2026-10-12')).toBe(false)
  expect(matchesView({ ...p, status: 'waiting' }, 'waiting')).toBe(true)
})
it('checklists toggle one item without changing the other items', () => {
  expect(toggleChecklist('Milk\n[ ] Bread', 0)).toBe('[x] Milk\n[ ] Bread')
  expect(toggleChecklist('[x] Milk\n[ ] Bread', 0)).toBe('[ ] Milk\n[ ] Bread')
})

it('accepts a phone share with a URL inside text and no title', () => {
  expect(parseTabCapture('?capture=tab&text=https%3A%2F%2Fexample.com%2Fassignment')).toEqual({ name: 'example.com', projectUrl: 'https://example.com/assignment' })
})

it('reports invalid links as validation errors instead of blaming Firebase',()=>{
 for(const language of ['ar','en','he'] as const){
  const message=errorText(Object.assign(new Error(),{code:'invalid-project-url'}),language);
  expect(message).toContain('https://');expect(message).toContain('500');expect(message).not.toContain('Firebase');
  expect(errorText(new Error('invalid-attachment-url'),language)).not.toBe(cloudText[language].error);
 }
 for(const projectUrl of ['https:example.com','https:/example.com','HTTPS://example.com'])expect(()=>validateProject('Card','',{projectUrl})).toThrow('invalid-project-url');
 expect(()=>validateProject('Card','',{projectUrl:'https://example.com'})).not.toThrow();
});