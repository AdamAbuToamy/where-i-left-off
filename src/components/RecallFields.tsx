import ResourceFields from './ResourceFields'
import type { ResourceDetails } from './ResourceFields'
import type { Language } from '../translations'
import type { Project, Section, GroupMember } from '../types'
import { groupText } from '../groupTranslations'
import { recallText } from '../recallTranslations'
export type RecallDetails = Pick<Project, 'assignedTo' | 'sectionId' | 'kind' | 'checkpoint' | 'checklist' | 'status'> & ResourceDetails
export default function RecallFields({ value, onChange, sections, language, prefix, members, progressOnly = false }: { value: RecallDetails; onChange: (value: RecallDetails) => void; sections: Section[]; language: Language; prefix: string; members?: GroupMember[]; progressOnly?: boolean }) {
  const t = recallText[language], g = groupText[language]
  return <div className="recall-fields"><ResourceFields value={value} onChange={fields=>onChange({...value,...fields})} language={language} prefix={prefix} progressOnly={progressOnly}/>
    <div className="recall-field-row">
      <div><label htmlFor={`${prefix}-section`}>{t.section}</label><select disabled={progressOnly} id={`${prefix}-section`} value={value.sectionId ?? ''} onChange={e => onChange({ ...value, sectionId: e.target.value })}><option value="">{t.noSection}</option>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-kind`}>{t.kind}</label><select disabled={progressOnly} id={`${prefix}-kind`} value={value.kind ?? 'resume'} onChange={e => onChange({ ...value, kind: e.target.value as Project['kind'], status: e.target.value === 'waiting' && value.status !== 'done' ? 'waiting' : value.status })}>{(['resume', 'waiting', 'deadline', 'list'] as const).map(k => <option key={k} value={k}>{t[k]}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-status`}>{t.status}</label><select id={`${prefix}-status`} value={value.status} onChange={e => onChange({ ...value, status: e.target.value as Project['status'] })}>{(['later', 'active', 'waiting', 'done'] as const).map(k => <option key={k} value={k}>{t[k]}</option>)}</select></div>
    </div>
    {members && <div><label htmlFor={`${prefix}-assigned`}>{g.assigned}</label><select id={`${prefix}-assigned`} disabled={progressOnly} value={value.assignedTo ?? ''} onChange={e => onChange({ ...value, assignedTo: e.target.value })}><option value="">{g.unassigned}</option>{value.assignedTo && !members.some(m => m.uid === value.assignedTo) && <option value={value.assignedTo}>{g.removed}</option>}{members.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}</select></div>}
    <label htmlFor={`${prefix}-checkpoint`}>{t.checkpoint}</label><textarea id={`${prefix}-checkpoint`} dir="auto" rows={3} maxLength={1000} value={value.checkpoint ?? ''} onChange={e => onChange({ ...value, checkpoint: e.target.value })} />
    <><label htmlFor={`${prefix}-checklist`}>{t.checklist}</label><textarea id={`${prefix}-checklist`} dir="auto" rows={5} maxLength={3000} value={value.checklist ?? ''} onChange={e => onChange({ ...value, checklist: e.target.value })} /></>
  </div>
}
