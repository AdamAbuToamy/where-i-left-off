import { describe, expect, it } from 'vitest'
import { rankForMove, sortedProjects, validateProject } from '../src/lib/projects'
import { translations } from '../src/translations'
import { cloudText, errorText } from '../src/cloudTranslations'
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
})
it('all three languages have complete nonempty keys including account UI', () => {
  for (const dictionary of [translations, cloudText]) {
    for (const lang of ['ar', 'he', 'en'] as const) {
      expect(Object.keys(dictionary[lang]).sort()).toEqual(Object.keys(dictionary.en).sort())
      expect(Object.values(dictionary[lang]).every(v => v.trim().length > 0)).toBe(true)
    }
  }
  expect(errorText(new Error('conflict'), 'ar')).toBe(cloudText.ar.conflict)
})
