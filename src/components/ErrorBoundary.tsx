import { Component, type ReactNode } from 'react'
import { reportError } from '../errors'
import { t } from '../i18n'

/** If a screen crashes: a friendly page with a way back, instead of a blank screen. The problem is reported. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    reportError(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app crash" role="alert">
        <div className="crash-card">
          <span className="crash-emoji" aria-hidden="true">🍿</span>
          <h1 className="title-xl">{t('Oops, something broke')}</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            {t("It's been reported so it gets fixed. Your shows and ratings are safe.")}
          </p>
          <button className="btn primary block" onClick={() => window.location.reload()}>
            {t('Reload Pititi')}
          </button>
        </div>
      </div>
    )
  }
}
