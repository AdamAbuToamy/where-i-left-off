import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import type { GroupInfo, GroupMember } from '../types'
import { db } from '../lib/firebase'
import { createGroup, createInvite, deleteGroup, setMemberCreation, joinGroup, previewInvite, removeMember, revokeInvite, watchGroups, watchInvites, watchMembers } from '../lib/groups'
import type { GroupInvite } from '../lib/groups'
import { groupText } from '../groupTranslations'
import { inviteToken } from '../lib/inviteLink'
import { errorText } from '../cloudTranslations'
import './GroupSpaces.css'
import GroupAnnouncements from './GroupAnnouncements'
import { navigate } from '../lib/navigation'
import { pageText } from '../pageText'
import { syncMemberNames } from '../lib/profile'
import { logEvent, traced } from '../lib/logging'
function cached<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback } }
function remember(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Optional metadata cache. */ } }
export default function GroupSpaces({ user, language, children, page, groupId: routeGroupId, profileVersion }: { user: User; language: Language; page: 'personal' | 'groups'; groupId: string; profileVersion: number; children: (group: GroupInfo | undefined, members: GroupMember[]) => ReactNode }) {
  const t = groupText[language], namespace = `groups/${db!.app.options.projectId}/${user.uid}`
  const [groups, setGroups] = useState<GroupInfo[]>(() => cached(namespace, []))
  const selected = page === 'groups' ? routeGroupId : ''
  const [members, setMembers] = useState<GroupMember[]>(() => selected ? cached(`${namespace}/${selected}/members`, []) : [])
  const [membersGroupId, setMembersGroupId] = useState(selected)
  const visibleMembers = membersGroupId === selected ? members : cached<GroupMember[]>(`${namespace}/${selected}/members`, [])
  const [inviteInput, setInviteInput] = useState(''), [deleting, setDeleting] = useState(false)
  const [name, setName] = useState(''), [manage, setManage] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [token, setToken] = useState(() => new URLSearchParams(location.search).get('groupInvite') || '')
  const [invitation, setInvitation] = useState<GroupInvite | null>(null), [invalid, setInvalid] = useState(false)
  const [invites, setInvites] = useState<GroupInvite[]>([]), [copied, setCopied] = useState(''), [removing, setRemoving] = useState('')
  const group = groups.find(g => g.id === selected)
  const groupId = group?.id, groupRole = group?.role
  useEffect(() => { if (online && user.displayName?.trim()) void traced('profile.sync', () => syncMemberNames(db!, user)).catch(setError) }, [user, profileVersion, online])
  useEffect(() => watchGroups(db!, user.uid, (items, fromCache) => {
    if (fromCache) return
    setGroups(items); remember(namespace, items)
    if (routeGroupId && !items.some(g => g.id === routeGroupId)) navigate('groups')
  }, e => { setError(e); logEvent('groups.list', e) }), [user.uid, namespace, routeGroupId])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    if (!selected) return
    const key = `${namespace}/${selected}/members`
    return watchMembers(db!, selected, (items, fromCache) => { if (!fromCache) { setMembers(items); setMembersGroupId(selected); remember(key, items) } }, e => { setError(e); logEvent('groups.members', e); navigate('groups'); setMembers([]) })
  }, [selected, namespace])
  useEffect(() => {
    if (!groupId || groupRole !== 'manager' || !manage) return
    return watchInvites(db!, groupId, setInvites, e => { setError(e); logEvent('groups.invites', e) })
  }, [groupId, groupRole, manage])
  useEffect(() => {
    let cancelled = false
    if (token && online) void previewInvite(db!, token).then(value => { if (!cancelled) { setInvitation(value); setInvalid(false) } }).catch(e => { logEvent('groups.invite.preview', e, 'warn'); if (!cancelled) setInvalid(true) })
    return () => { cancelled = true }
  }, [token, online])
  async function run(action: () => Promise<unknown>) {
    if (busy || !online) return
    setBusy(true); setError(null)
    try { await traced('groups.action', action) } catch (e) { setError(e) } finally { setBusy(false) }
  }
  function changeCreation(member: GroupMember, allowed: boolean) {
    if (!group) return
    void run(async () => {
      setMembers(current => current.map(m => m.uid === member.uid ? { ...m, canCreate: allowed } : m))
      try { await setMemberCreation(db!, group.id, member.uid, allowed) }
      catch (error) { setMembers(current => current.map(m => m.uid === member.uid ? member : m)); throw error }
    })
  }
  function select(id: string) {
    setMembersGroupId(id); setMembers(id ? cached(`${namespace}/${id}/members`, []) : []); setInvites([]); setManage(false); navigate('groups', id); setRemoving(''); setDeleting(false)
  }
  function dismiss() {
    setToken(''); setInvitation(null); setInvalid(false)
    const url = new URL(location.href); url.searchParams.delete('groupInvite'); history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
  const inviteLink = (id: string) => `${location.origin}/?groupInvite=${id}`
  return <>
    {page === 'groups' && <section className="group-spaces" aria-label={t.spaces}>
      <div className="space-heading"><strong>{t.spaces}</strong><span>{t.private}</span></div>
      {group ? <a className="secondary-button" href="#/groups">{pageText[language].back}</a> : <><p>{pageText[language].selectGroup}</p><nav className="space-navigation">{groups.map(g => <button key={g.id} className="secondary-button" onClick={() => select(g.id)}><span dir="auto">{g.name}</span><small>{t[g.role]}</small></button>)}</nav></>}
      {!group && <details className="group-create"><summary>{t.create}</summary><form onSubmit={e => { e.preventDefault(); void run(async () => { const id = await createGroup(db!, user, name); setName(''); select(id) }) }}><label htmlFor="group-name">{t.name}</label><input id="group-name" dir="auto" maxLength={60} required value={name} onChange={e => setName(e.target.value)} /><button className="primary-button" disabled={busy || !online || !name.trim()}>{t.create}</button></form></details>}
      {!group && <details className="group-create"><summary>{t.join}</summary><form onSubmit={e => { e.preventDefault(); const value = inviteToken(inviteInput, location.origin); setInvitation(null); setInvalid(!value); setToken(value || 'invalid'); if (value) { const url = new URL(location.href); url.searchParams.set('groupInvite', value); history.replaceState({}, '', url.pathname + url.search + url.hash) } }}><label htmlFor="invite-link">{t.pasteInvite}</label><input id="invite-link" type="url" required dir="ltr" value={inviteInput} onChange={e => setInviteInput(e.target.value)} /><button className="secondary-button" disabled={!online || !inviteInput.trim()}>{t.reviewInvite}</button></form></details>}
      {!online && <p>{t.needsInternet}</p>}
      {token && <section className="group-invitation" aria-label={t.invitation}><p>{invalid ? t.invalidInvite : <>{t.invitation} <strong dir="auto">{invitation?.groupName || '…'}</strong></>}</p>{invitation && !invalid && <button className="primary-button" disabled={busy || !online} onClick={() => void run(async () => { const id = await joinGroup(db!, user, token); navigate('groups', id); dismiss() })}>{t.join}</button>}<button className="text-button" onClick={dismiss}>{t.dismiss}</button></section>}
      {group && <><GroupAnnouncements key={group.id} group={group} user={user} language={language} /><div className="group-heading"><h2 dir="auto">{group.name}</h2><button className="secondary-button" aria-expanded={manage} onClick={() => setManage(v => !v)}>{t.manage}</button></div>{group.role === 'member' && <p>{t.permission}</p>}
        {manage && <div className="group-management"><h3>{t.members}</h3><ul>{visibleMembers.map(m => <li key={m.uid}><div><strong dir="auto">{m.name}</strong><small>{t[m.role]}</small></div>{group.role === 'manager' && m.role !== 'manager' && <><label className="creation-permission"><input type="checkbox" checked={m.canCreate !== false} disabled={busy || !online} onChange={e => changeCreation(m, e.target.checked)} />{t.allowCreate}</label>{removing === m.uid ? <><button className="card-delete" disabled={busy || !online} onClick={() => void run(async () => { await removeMember(db!, group.id, m.uid); setRemoving('') })}>{t.removeConfirm}</button><button className="text-button" onClick={() => setRemoving('')}>{t.cancel}</button></> : <button className="text-button" disabled={busy || !online} onClick={() => setRemoving(m.uid)}>{t.remove}</button>}</>}</li>)}</ul>
          {group.role === 'manager' && <><p>{t.inviteHint}</p><button className="primary-button" disabled={busy || !online} onClick={() => void run(() => createInvite(db!, user, group))}>{t.invite}</button>{invites.map(invite => <div className="invite-row" key={invite.id}><input aria-label={t.invite} readOnly dir="ltr" value={inviteLink(invite.id)} /><button className="secondary-button" onClick={() => void traced('groups.invite.copy', async () => { await navigator.clipboard.writeText(inviteLink(invite.id)); setCopied(invite.id) }).catch(setError)}>{copied === invite.id ? t.copied : t.copy}</button><button className="text-button" disabled={busy || !online} onClick={() => void run(() => revokeInvite(db!, invite.id))}>{t.revoke}</button></div>)}<div className="group-delete">{deleting ? <><p role="alert">{t.deleteWarning}</p><button className="card-delete" disabled={busy || !online} onClick={() => void run(async () => { await deleteGroup(db!, group.id, user.uid); select('') })}>{t.deleteConfirm}</button><button className="text-button" disabled={busy} onClick={() => setDeleting(false)}>{t.cancel}</button></> : <button className="card-delete" disabled={busy || !online} onClick={() => setDeleting(true)}>{t.deleteGroup}</button>}</div></>}
        </div>}
      </>}
      {error !== null && <p className="notice error" role="alert">{errorText(error, language)}</p>}
    </section>}
    {(page === 'personal' || !!group) && children(page === 'personal' ? undefined : group, page === 'personal' ? [] : visibleMembers)}
  </>
}
