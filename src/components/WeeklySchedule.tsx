import { useState } from 'react'
import { localDateKey, validDate } from '../lib/projects'
import type { Project } from '../types'
import type { Language } from '../translations'
import { translations } from '../translations'
import './WeeklySchedule.css'

type Props = { projects: Project[]; language: Language; weekOf?: string }
const weekdays: Record<Language, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  he: ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

export default function WeeklySchedule({ projects, language, weekOf }: Props) {
  const t = translations[language]
  const [offset, setOffset] = useState(0)
  const today = weekOf && validDate(weekOf) ? new Date(Number(weekOf.slice(0,4)), Number(weekOf.slice(5,7))-1, Number(weekOf.slice(8,10))) : new Date()
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + offset * 7)
  const days = weekdays[language]
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + index)
    return { key: localDateKey(date), label: days[index], date }
  })
  const dated = projects.filter(project => project.dueDate)
  const unscheduled = projects.filter(project => !project.dueDate)
  return <section className="weekly-schedule" aria-label={t.schedule}>
    <div className="week-navigation">
      <button className="secondary-button" onClick={() => setOffset(value => value - 1)}>{t.previousWeek}</button>
      <h2>{week[0].date.toLocaleDateString(language === 'ar' ? 'ar' : language === 'he' ? 'he' : 'en', { day: 'numeric', month: 'short' })} – {week[6].date.toLocaleDateString(language === 'ar' ? 'ar' : language === 'he' ? 'he' : 'en', { day: 'numeric', month: 'short', year: 'numeric' })}</h2>
      <button className="secondary-button" onClick={() => setOffset(value => value + 1)}>{t.nextWeek}</button>
    </div>
    <div className="week-grid">
      {week.map(day => <section className="week-day" key={day.key}>
        <h3><span>{day.label}</span><time dateTime={day.key}>{day.date.toLocaleDateString(language === 'ar' ? 'ar' : language === 'he' ? 'he' : 'en', { day: 'numeric', month: 'numeric' })}</time></h3>
        {dated.filter(project => project.dueDate === day.key).map(project => <article className="week-item" key={project.id}>
          <strong dir="auto">{project.name}</strong>
          {project.nextStep && <p dir="auto">{project.nextStep}</p>}
          {project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noopener noreferrer">↗ {t.projectUrl}</a>}
        </article>)}
      </section>)}
    </div>
    {unscheduled.length > 0 && <section className="unscheduled-projects"><h3>{t.unscheduled}</h3><div>{unscheduled.map(project => <span key={project.id}>{project.name}</span>)}</div></section>}
  </section>
}
