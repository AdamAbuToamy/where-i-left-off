import { it, expect } from 'vitest'
import { groupText } from '../src/groupTranslations'
it('has all group labels in the three languages', () => {
  expect(Object.keys(groupText.ar).sort()).toEqual(Object.keys(groupText.en).sort())
  expect(Object.keys(groupText.he).sort()).toEqual(Object.keys(groupText.en).sort())
})
