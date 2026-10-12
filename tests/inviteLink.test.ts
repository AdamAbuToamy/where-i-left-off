import { expect, it } from 'vitest'
import { inviteToken, sharedInvite } from '../src/lib/inviteLink'
const origin = 'https://where-i-left-off.web.app', token = 'Abc12345678901234567'
it('accepts only valid invitation URLs for this app', () => {
  expect(inviteToken(`${origin}/?groupInvite=${token}`, origin)).toBe(token)
  for (const link of [`https://evil.test/?groupInvite=${token}`, `${origin}/wrong?groupInvite=${token}`, `${origin}/?groupInvite=short`, 'javascript:alert(1)']) expect(inviteToken(link, origin)).toBeNull()
})
it('recognizes Android-shared invitations without treating other links as invites', () => {
  expect(sharedInvite(`?capture=tab&text=${encodeURIComponent('Join us ' + origin + '/?groupInvite=' + token)}`, origin)).toBe(token)
  expect(sharedInvite('?capture=tab&url=https%3A%2F%2Fexample.test', origin)).toBeNull()
})
