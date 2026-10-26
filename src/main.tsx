import ErrorBoundary from './components/ErrorBoundary'
import { installLogging } from './lib/logging'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './Experience.css'
import { sharedInvite } from './lib/inviteLink'
const incomingInvite = sharedInvite(location.search, location.origin)
if (incomingInvite) history.replaceState({}, '', `/?groupInvite=${incomingInvite}`)

installLogging()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)

if (import.meta.env.PROD && (import.meta.env.VITE_USE_EMULATORS !== 'true' || import.meta.env.VITE_TEST_OFFLINE === 'true') && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => { /* Capture remains available in the browser. */ }) })
}
