import { useEffect, useState, type FormEvent } from 'react'
import { t } from '../i18n'
import { Icon } from './Icon'
import { passwordProblem } from '../lib/password'

interface Props {
  /** change: signed in, needs the current password. reset: opened from the email link. */
  mode: 'change' | 'reset'
  /** Signed-in email, kept in the form so password managers update the right entry */
  email?: string
  onSave: (current: string, next: string) => Promise<void>
  onClose: () => void
}

export function PasswordSheet({ mode, email, onSave, onClose }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'change' && !current) return setError(t('Enter your current password.'))
    const problem = passwordProblem(next, confirm, mode === 'change' ? current : undefined)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await onSave(current, next)
    } catch (err) {
      setError((err as Error).message || t("Couldn't save that. Check your connection."))
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  const title = mode === 'change' ? t('Change password') : t('Choose a new password')

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={() => !busy && onClose()} />
      <form className="sheet" onSubmit={submit} noValidate>
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <div>
            <p className="label-sm">{t('Account')}</p>
            <h2 className="sheet-title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('Close')} onClick={onClose} disabled={busy}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {mode === 'reset' && <p className="muted">{t('You opened the reset link. Pick a new password and you stay signed in.')}</p>}
        {/* Hidden username so the phone's password manager saves the new password for this email */}
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}

        {mode === 'change' && (
          <label className="stack-field">
            <span className="muted">{t('Current password')}</span>
            <input type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          </label>
        )}
        <div className="stack-field">
          <label htmlFor="pw-new" className="muted">{t('New password')}</label>
          <input id="pw-new" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-hint" autoFocus={mode === 'reset'} />
          <span id="pw-hint" className="muted small">{t('At least 6 characters.')}</span>
        </div>
        <label className="stack-field">
          <span className="muted">{t('New password again')}</span>
          <input type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>{t('Show passwords')}</span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? t('One moment…') : t('Save new password')}
        </button>
      </form>
    </div>
  )
}
