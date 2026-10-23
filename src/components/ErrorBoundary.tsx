import { Component } from 'react'
import type { ReactNode } from 'react'
import { logEvent } from '../lib/logging'
import { pageText } from '../pageText'
export default class ErrorBoundary extends Component<{ children: ReactNode; embedded?: boolean }, { failed: boolean; id: string }> {
  state = { failed: false, id: '' }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.setState({ id: logEvent('react.render', error) }) }
  render() {
    if (!this.state.failed) return this.props.children
    const t = pageText[document.documentElement.lang === 'he' ? 'he' : document.documentElement.lang === 'en' ? 'en' : 'ar']
    const Container = this.props.embedded ? 'section' : 'main'
    return <Container className="empty-state" role="alert"><p>{t.crashed}</p><code>{this.state.id}</code><p><button onClick={() => location.reload()}>{t.reload}</button></p></Container>
  }
}
