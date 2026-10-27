import { Bookmark, Check, CornerDownLeft } from 'lucide-react'
import type { Language } from '../translations'
import './LoadingScreen.css'

const copy = {
  ar: { title: 'نجهّز مساحتك', hint: 'لنكمل من حيث توقفت.' },
  en: { title: 'Getting your space ready', hint: 'Let’s pick up where you left off.' },
  he: { title: 'מכינים את המרחב שלך', hint: 'ממשיכים מהמקום שבו עצרת.' },
}

/** Presentation only: the caller supplies the actual loading state and status. */
export default function LoadingScreen({ language, status }: { language: Language; status: string }) {
  const t = copy[language]
  return <section className="wilo-loading" dir={language === 'en' ? 'ltr' : 'rtl'} lang={language}>
    <div className="wilo-loading-art" aria-hidden="true">
      <div className="wilo-loading-orbit" />
      <div className="wilo-loading-card wilo-loading-card-back"><i /><i /><i /></div>
      <div className="wilo-loading-card wilo-loading-card-front">
        <span className="wilo-loading-bookmark"><Bookmark size={27} strokeWidth={1.7} /></span>
        <span className="wilo-loading-card-lines"><i /><i /></span>
        <span className="wilo-loading-check"><Check size={13} strokeWidth={2.5} /></span>
      </div>
      <span className="wilo-loading-return"><CornerDownLeft size={18} strokeWidth={1.6} /></span>
      <span className="wilo-loading-dot" />
    </div>
    <span className="wilo-loading-wordmark" aria-hidden="true">WILO<span> / </span></span>
    <h2>{t.title}</h2>
    <p className="wilo-loading-hint">{t.hint}</p>
    <div className="wilo-loading-track" aria-hidden="true"><span /></div>
    <p className="wilo-loading-status" role="status" aria-atomic="true">{status}</p>
  </section>
}
