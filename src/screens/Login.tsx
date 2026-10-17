import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import type { JoinAs, JoinOptions } from '../store/cloud'
import { popularPosters } from '../tvmaze'
import { inviteCodeFrom } from '../lib/invite'
import { getLang, setLang, t } from '../i18n'

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  /** Resolves false when the account needs email confirmation before signing in. */
  onSignUp: (email: string, password: string, code: string, as: JoinAs) => Promise<boolean>
  loadOptions: (code: string) => Promise<JoinOptions>
  /** Forgot password: emails a link to choose a new one */
  onForgot?: (email: string) => Promise<void>
}

const NEW = '__new__'

/** An invite link (…/?invite=CODE) opens straight on Create account with the code filled in. */
const INVITE_KEY = 'pititi.invite'
const fromUrl = new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase().slice(0, 16) ?? ''
// Remember it: on Android the installed app opens without the link, but shares storage with Chrome
try {
  if (fromUrl) localStorage.setItem(INVITE_KEY, fromUrl)
} catch {
  // Not fatal: the code can be typed or pasted
}
const INVITE = fromUrl || (() => {
  try {
    return localStorage.getItem(INVITE_KEY) ?? ''
  } catch {
    return ''
  }
})()


export function Login({ onSignIn, onSignUp, loadOptions, onForgot }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>(INVITE ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState(INVITE)
  const [options, setOptions] = useState<JoinOptions | null>(null)
  const [checking, setChecking] = useState(false)
  const [pick, setPick] = useState<string>(NEW)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [posters, setPosters] = useState<string[]>([])

  useEffect(() => {
    popularPosters().then(setPosters).catch(() => setPosters([]))
  }, [])

  // Check the invite code as it's typed, then offer the matching profiles
  useEffect(() => {
    const c = code.trim()
    if (mode !== 'signup' || c.length < 6) return
    let alive = true
    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const o = await loadOptions(c)
        if (!alive) return
        setOptions(o)
        setPick(o.profiles[0]?.id ?? NEW)
      } catch {
        if (alive) setOptions(null)
      } finally {
        if (alive) setChecking(false)
      }
    }, 350)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [code, mode, loadOptions])

  const codeOk = options?.valid && code.trim().length >= 6

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError(t('Enter your email and password.'))
    if (mode === 'signup') {
      if (!codeOk) return setError(t('Enter the invite code from the message Leandro sent (8 letters and numbers), or paste the whole message.'))
      if (pick === NEW && !name.trim()) return setError(t('Enter your name.'))
      if (password.length < 6) return setError(t('Use at least 6 characters for the password.'))
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        await onSignIn(email.trim(), password)
      } else {
        const as: JoinAs = pick === NEW ? { name: name.trim() } : { personId: pick }
        const signedIn = await onSignUp(email.trim(), password, code.trim().toUpperCase(), as)
        if (!signedIn) {
          setNotice(t('Account created. Open the confirmation email, then come back and sign in.'))
          setMode('signin')
        }
      }
    } catch (err) {
      setError((err as Error).message || t("Couldn't sign in. Try again."))
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    if (!onForgot) return
    const address = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setNotice(null)
      return setError(t('Type your email above first, then tap "Forgot password?" again.'))
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await onForgot(address)
      setNotice(t('If {email} has an account, a link to choose a new password is on its way. Check your inbox (and spam).', { email: address }))
    } catch (err) {
      setError((err as Error).message || t("Couldn't send the email. Try again."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit} noValidate>
      <div className="segmented login-lang" role="radiogroup" aria-label="Language / Idioma">
        {(['en', 'pt'] as const).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={getLang() === l} className={getLang() === l ? 'on' : ''} lang={l === 'pt' ? 'pt-BR' : 'en'} aria-label={l === 'en' ? 'English' : 'Português'} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="mosaic" aria-hidden="true">
        <div className="mosaic-grid">
          {Array.from({ length: 4 }, (_, col) => (
            <div key={col} className={col % 2 ? 'col2' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }, (_, row) => {
                const src = posters[col * 4 + row]
                return src ? (
                  <img key={row} src={src} alt="" style={{ animationDelay: `${(col + row) * 60}ms` }} />
                ) : (
                  <div key={row} className="ph" />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="login-body">
      <div className="logo" aria-hidden="true">
        <Icon name="tv" size={32} stroke={2.2} />
      </div>
      <h1>
        Pititi <span className="grad-text">Watchers</span>
      </h1>
      <p className="tagline">{t('Everything your family watches. Rated, remembered, together.')}</p>

      <div className="segmented wide" role="tablist" aria-label={t('Account')}>
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'on' : ''}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            {m === 'signin' ? t('Sign in') : t('Create account')}
          </button>
        ))}
      </div>

      {mode === 'signup' && (
        <>
          <label className="stack-field">
            <span className="muted">{t('Invite code')}</span>
            <input
              value={code}
              onChange={(e) => {
                // Pasting the whole invite message or link works too
                setCode(inviteCodeFrom(e.target.value))
                setOptions(null)
                setError(null)
              }}
              placeholder="A1B2C3D4"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              aria-describedby="invite-hint"
            />
            <span id="invite-hint" className="muted small">{t('The 8-character code in the invite message. You can also paste the whole message.')}</span>
            {checking && <span className="muted small">{t('Checking…')}</span>}
            {!checking && options && !options.valid && (
              <span className="error small">{t("That code isn't right. Check Settings → Invite code on a family member's phone.")}</span>
            )}
          </label>

          {codeOk && (
            <div className="stack-field">
              <span className="muted">{t("I'm")}</span>
              <div className="chips" role="radiogroup" aria-label={t('Who are you')}>
                {options!.profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={pick === p.id}
                    className={pick === p.id ? 'on' : ''}
                    onClick={() => setPick(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={pick === NEW}
                  className={pick === NEW ? 'on' : ''}
                  onClick={() => setPick(NEW)}
                >
                  {t('Someone new')}
                </button>
              </div>
              {pick === NEW && (
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Your name')} maxLength={30} aria-label={t('Your name')} />
              )}
            </div>
          )}
        </>
      )}

      <label className="stack-field">
        <span className="muted">{t('Email')}</span>
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('you@example.com')}
        />
      </label>
      <label className="stack-field">
        <span className="muted">{t('Password')}</span>
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {mode === 'signin' && onForgot && (
        <button type="button" className="link-btn forgot" onClick={forgot} disabled={busy}>
          {t('Forgot password?')}
        </button>
      )}
      {notice && <p className="ok" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? t('One moment…') : mode === 'signin' ? t('Sign in') : t('Create account')}
      </button>
      </div>
    </form>
  )
}
