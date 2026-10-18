import type { ReactNode } from 'react'
export default function SettingsGroup({ title, children, danger = false }: { title: string; children: ReactNode; danger?: boolean }) {
  return <details className={`settings-group ${danger ? 'settings-group-danger' : ''}`} name="account-settings">
    <summary><span>{title}</span><span className="settings-group-chevron" aria-hidden="true" /></summary>
    <div className="settings-group-body">{children}</div>
  </details>
}
